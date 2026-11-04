import { test, expect, type Page } from "@playwright/test";
import { qaDatabase, qaPasswordHash } from "./qaDatabase";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/access/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  const data = (await (await response).json()).metadata;
  await expect(page).toHaveURL("/");
  return data;
}
test("author tiers, admin pricing, paid parent/chapter/post gates and reader cancellation", async ({
  page,
  request,
  browser,
}) => {
  const stamp = Date.now(),
    one = `Supporters ${stamp}`,
    two = `Patrons ${stamp}`,
    secret = `Exclusive author update ${stamp}`;
  const actor = await login(
    page,
    "publishing-e2e@example.invalid",
    "Publishing-QA-only-2026!",
  );
  const actorHeaders = {
    "x-client-id": String(actor.user.id),
    Authorization: `Bearer ${actor.tokens.accessToken}`,
  };
  await page.goto("/author/memberships");
  for (const [level, name] of [
    [1, one],
    [2, two],
  ] as const) {
    const form = page.getByRole("form", { name: `Tier ${level} settings` });
    await form.getByLabel("Tier name", { exact: true }).fill(name);
    await form
      .getByLabel("Description", { exact: true })
      .fill("Members-only novel chapters and author updates");
    await form
      .getByLabel("Benefits, one per line", { exact: true })
      .fill("Member chapters\nAuthor updates");
    await form
      .getByRole("button", { name: `Save tier ${level}`, exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(`Tier ${level} saved.`);
  }
  const own = await request.get(
      "http://localhost:3000/v1/api/authors/me/tiers",
      { headers: actorHeaders },
    ),
    plans = (await own.json()).metadata;
  const authorId = plans.authorId,
    tierOne = plans.tiers.find((t: { level: number }) => t.level === 1),
    tierTwo = plans.tiers.find((t: { level: number }) => t.level === 2);
  await page.goto("/author/posts");
  await page
    .getByLabel("Post title", { exact: true })
    .fill(`Member update ${stamp}`);
  await page.getByLabel("Post text", { exact: true }).fill(secret);
  await page.getByLabel("Post access", { exact: true }).selectOption("TIERS");
  await page
    .getByLabel("Required tier, when restricted", { exact: true })
    .selectOption(String(tierTwo.id));
  await page.getByLabel("Keep as a draft").uncheck();
  await page.getByRole("button", { name: "Save post", exact: true }).click();
  await expect(page.getByRole("status",{name:"Post save progress"})).toHaveText("Post saved.");
  const bookResponse = await request.post(
    "http://localhost:3000/v1/api/authors/me/books",
    {
      headers: actorHeaders,
      data: {
        title: `Member novel ${stamp}`,
        genre: "Novel",
        status: "PUBLISHED",
        visibility: "MEMBERS",
        requestId: crypto.randomUUID(),
      },
    },
  );
  expect(bookResponse.ok()).toBe(true);
  const book = (await bookResponse.json()).metadata;
  const openingResponse = await request.post(
    `http://localhost:3000/v1/api/authors/me/books/${book.id}/chapters`,
    {
      headers: actorHeaders,
      data: {
        title: "Public child",
        contentMd: "Protected by its member-only book.",
        isDraft: false,
        requestId: crypto.randomUUID(),
      },
    },
  );
  expect(openingResponse.ok()).toBe(true);
  const opening = (await openingResponse.json()).metadata;
  await page.goto(`/author/comic/${book.id}/chapter/create`);
  await page.getByLabel("Title", { exact: true }).fill("Patron chapter");
  await page.getByLabel("Visibility", { exact: true }).selectOption("TIERS");
  await page
    .getByLabel("Minimum membership tier", { exact: true })
    .selectOption(String(tierTwo.id));
  const editor = page.getByRole("textbox", {
    name: "Chapter text",
    exact: true,
  });
  await editor.click();
  await page.keyboard.type("For this author’s patrons.");
  const published = page.waitForResponse(
    (r) =>
      r.url().includes("/chapters") &&
      ["POST", "PATCH"].includes(r.request().method()),
  );
  await page
    .getByRole("button", { name: "Publish Chapter", exact: true })
    .click();
  const patron = (await (await published).json()).metadata;
  await expect(page.getByRole("status", { name: "Save progress" })).toHaveText(
    "Published successfully.",
  );
  expect(
    (
      await request.get(
        `http://localhost:3000/v1/api/books/${book.slug}/chapters/${opening.chapterNo}`,
      )
    ).status(),
  ).toBe(401);
  const guest = await browser.newContext(),
    guestPage = await guest.newPage();
  await guestPage.goto(`http://localhost:8000/author/${authorId}/posts`);
  await expect(guestPage.getByText(secret, { exact: true })).toHaveCount(0);
  await expect(
    guestPage.getByRole("link", { name: "View membership plans" }).first(),
  ).toBeVisible();
  await guest.close();
  const db = await qaDatabase();
  const email = `member-browser-${stamp}@example.invalid`,
    password = "Membership-browser-only-2026!";
  const [u] = await db.query(
    "INSERT INTO users(email,password_hash,state) VALUES (?,?,1)",
    [email, await qaPasswordHash(password)],
  );
  const readerId = u.insertId;
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE code='READER'",
    [readerId],
  );
  await db.query("INSERT INTO user_profiles(user_id,username) VALUES (?,?)", [
    readerId,
    `Member${stamp}`,
  ]);
  const [m] = await db.query(
    "INSERT INTO memberships(user_id,author_id,tier_id,status,current_period_end,provider,auto_renew) VALUES (?,?,?,'ACTIVE',DATE_ADD(NOW(),INTERVAL 1 MONTH),'MANUAL',1)",
    [readerId, authorId, tierOne.id],
  );
  const readerContext = await browser.newContext(),
    readerPage = await readerContext.newPage();
  const reader = await login(readerPage, email, password);
  const readerHeaders = {
    "x-client-id": String(readerId),
    Authorization: `Bearer ${reader.tokens.accessToken}`,
  };
  expect(
    (
      await request.get(
        `http://localhost:3000/v1/api/books/${book.slug}/chapters/${opening.chapterNo}`,
        { headers: readerHeaders },
      )
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.get(
        `http://localhost:3000/v1/api/books/${book.slug}/chapters/${patron.chapterNo}`,
        { headers: readerHeaders },
      )
    ).status(),
  ).toBe(403);
  await readerPage.goto("/account/memberships");
  await expect(readerPage.getByText(one, { exact: false })).toBeVisible();
  await readerPage
    .getByRole("button", { name: "Cancel renewal", exact: true })
    .click();
  await expect(readerPage.getByRole("status")).toHaveText(
    "Renewal canceled. Access continues until the current period ends.",
  );
  await db.query("UPDATE memberships SET tier_id=? WHERE id=?", [
    tierTwo.id,
    m.insertId,
  ]);
  await readerPage.goto(`/author/${authorId}/posts`);
  await expect(readerPage.getByText(secret, { exact: true })).toBeVisible();
  for (const [endpoint, failure] of [
    ["**/access/session", "Session temporarily unavailable"],
    ["**/user/me", "Profile service unavailable"],
  ] as const) {
    await readerPage.route(endpoint, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: failure }),
      }),
    );
    await readerPage.reload();
    await expect(readerPage.getByRole("alert")).toContainText(failure);
    expect(
      await readerPage.evaluate(() => localStorage.getItem("userId")),
    ).toBe(String(readerId));
    await readerPage.unroute(endpoint);
    await readerPage.reload();
    await expect(readerPage.getByText(secret, { exact: true })).toBeVisible();
  }
  await readerPage.setViewportSize({ width: 390, height: 844 });
  expect(
    await readerPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await readerPage.screenshot({
    path: test.info().outputPath("member-post-mobile.png"),
    fullPage: false,
  });
  await readerContext.close();
  await db.end();
  const adminContext = await browser.newContext(),
    adminPage = await adminContext.newPage();
  await login(
    adminPage,
    "admin-e2e@example.invalid",
    "Publishing-QA-only-2026!",
  );
  await adminPage.goto("/admin/membership-policy");
  await adminPage.getByLabel("Platform share (%)", { exact: true }).fill("10");
  await adminPage
    .getByRole("button", { name: "Save membership policy", exact: true })
    .click();
  await expect(adminPage.getByRole("status")).toHaveText(
    "Membership policy saved.",
  );
  await adminContext.close();
});
