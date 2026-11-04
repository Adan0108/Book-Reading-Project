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
  const actor = (await (await response).json()).metadata;
  await expect(page).toHaveURL("/");
  return actor;
}
test("real catalog filters, profiles, follows, bookmarks and synchronized reading history", async ({
  page,
  browser,
  request,
}) => {
  const stamp = Date.now(),
    password = "Discovery-QA-only-2026!",
    authorEmail = `discovery-author-${stamp}@example.invalid`,
    readerEmail = `discovery-reader-${stamp}@example.invalid`,
    penName = `Discovery writer ${stamp}`,
    prefix = `A discovery ${stamp}`,
    title = `${prefix} beginning`,
    genre = `Discovery genre ${stamp}`,
    tag = `Discovery tag ${stamp}`;
  const db = await qaDatabase(),
    hash = await qaPasswordHash(password);
  const [a] = await db.query(
      "INSERT INTO users(email,password_hash,state) VALUES (?,?,1)",
      [authorEmail, hash],
    ),
    [r] = await db.query(
      "INSERT INTO users(email,password_hash,state) VALUES (?,?,1)",
      [readerEmail, hash],
    );
  for (const [id, role, username] of [
    [a.insertId, "AUTHOR", `Writer${stamp}`],
    [r.insertId, "READER", `Reader${stamp}`],
  ]) {
    await db.query(
      "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE code=?",
      [id, role],
    );
    await db.query("INSERT INTO user_profiles(user_id,username) VALUES (?,?)", [
      id,
      username,
    ]);
  }
  const [author] = await db.query(
    "INSERT INTO authors(user_id,pen_name,is_approved) VALUES (?,'Discovery author',1)",
    [a.insertId],
  );
  await db.end();
  const authorId = author.insertId;
  const actor = await login(page, authorEmail, password),
    headers = {
      "x-client-id": String(actor.user.id),
      Authorization: `Bearer ${actor.tokens.accessToken}`,
    },
    base = "http://localhost:3000/v1/api";
  await page.goto("/author/profile");
  await page.getByLabel("Pen name", { exact: true }).fill(penName);
  await page
    .getByLabel("Public author biography", { exact: true })
    .fill("Original novels and new worlds, shared one chapter at a time.");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
  await page.goto("/author/comic/create");
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Genre", { exact: true }).fill(genre);
  await page
    .getByLabel("Synopsis", { exact: true })
    .fill("An original text-first story discovered through the live catalog.");
  await page.getByLabel("Tags", { exact: true }).fill(tag);
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/authors/me/books") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Publish Book", exact: true }).click();
  const book = (await (await created).json()).metadata;
  await expect(page).toHaveURL(new RegExp(`/author/comic/${book.id}/edit`));
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);
  const text =
    "The first page of a new world.\n\n" +
    Array.from(
      { length: 100 },
      (_, i) =>
        `Paragraph ${i + 1}. ` +
        "The night train crossed a quiet valley, and a traveller began a new story. ".repeat(
          8,
        ),
    ).join("\n\n");
  const chapterResponse = await request.post(
    `${base}/authors/me/books/${book.id}/chapters`,
    {
      headers,
      data: {
        title: "Opening",
        contentMd: text,
        isDraft: false,
        requestId: crypto.randomUUID(),
      },
    },
  );
  expect(chapterResponse.ok()).toBe(true);
  const chapter = (await chapterResponse.json()).metadata;
  for (let i = 0; i < 12; i++)
    expect(
      (
        await request.post(`${base}/authors/me/books`, {
          headers,
          data: {
            title: `${prefix} story ${i}`,
            genre,
            tags: [tag],
            status: "PUBLISHED",
            requestId: crypto.randomUUID(),
          },
        })
      ).ok(),
    ).toBe(true);
  const publicBook = (
      await (await request.get(`${base}/books/${book.slug}`)).json()
    ).metadata,
    tagSlug = publicBook.tags.find(
      (t: { name: string }) => t.name === tag,
    ).slug;
  const context = await browser.newContext(),
    readerPage = await context.newPage();
  let cloud = 0;
  readerPage.on("request", (req) => {
    if (req.method() === "POST" && req.url().includes("api.cloudinary.com"))
      cloud++;
  });
  await login(readerPage, readerEmail, password);
  await readerPage.goto("/account/profile");
  await readerPage
    .getByLabel("Display name", { exact: true })
    .fill("A novel reader");
  await readerPage
    .getByLabel("Account biography", { exact: true })
    .fill("Private reading notes.");
  await readerPage
    .getByLabel("Keep account profile private", { exact: true })
    .check();
  await readerPage
    .getByRole("button", { name: "Save profile", exact: true })
    .click();
  await expect(readerPage.getByRole("status")).toHaveText("Profile saved.");
  await readerPage.reload();
  await expect(
    readerPage.getByLabel("Account biography", { exact: true }),
  ).toHaveValue("Private reading notes.");
  await readerPage.goto(`/?query=${encodeURIComponent(prefix)}`);
  const discovery = readerPage.getByRole("search", { name: "Story discovery" });
  await expect(
    readerPage.getByText("13 matching stories", { exact: true }),
  ).toBeVisible();
  await discovery
    .getByLabel("Genre filter", { exact: true })
    .selectOption(genre);
  await discovery
    .getByLabel("Tag filter", { exact: true })
    .selectOption(tagSlug);
  await expect(
    readerPage.getByText("13 matching stories", { exact: true }),
  ).toBeVisible();
  await readerPage
    .getByRole("button", { name: "Next page", exact: true })
    .click();
  await expect(
    readerPage.getByText("Page 2 of 2", { exact: true }),
  ).toBeVisible();
  await readerPage
    .getByRole("link", { name: `Read ${title}`, exact: true })
    .click();
  await expect(
    readerPage.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await readerPage
    .getByRole("button", { name: "Save to library", exact: true })
    .click();
  await expect(readerPage.getByRole("status")).toHaveText(
    "Saved to your library.",
  );
  const recorded = readerPage.waitForResponse(
    (response) =>
      response.url().endsWith("/library/history") &&
      response.request().method() === "POST",
  );
  await readerPage
    .getByRole("link", { name: "Start reading", exact: true })
    .click();
  await expect(
    readerPage.getByRole("heading", { name: "Opening", exact: true }),
  ).toBeVisible();
  expect((await recorded).ok()).toBe(true);
  const advanced = readerPage.waitForResponse(
    (response) =>
      response.url().endsWith("/library/history") &&
      response.request().method() === "POST" &&
      response.request().postDataJSON().progress > 30,
  );
  await readerPage.evaluate(() =>
    window.scrollTo(
      0,
      (document.documentElement.scrollHeight - window.innerHeight) * 0.55,
    ),
  );
  expect((await advanced).ok()).toBe(true);
  await readerPage.goto("/account/library?tab=history");
  await expect(
    readerPage.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await readerPage
    .getByRole("link", { name: "Continue reading", exact: true })
    .click();
  await expect(readerPage).toHaveURL(
    new RegExp(`chapters/${chapter.chapterNo}\\?resume=`),
  );
  await expect
    .poll(() => readerPage.evaluate(() => window.scrollY))
    .toBeGreaterThan(100);
  await readerPage.goto(`/author/${authorId}`);
  await expect(
    readerPage.getByRole("heading", { name: penName, exact: true }),
  ).toBeVisible();
  await readerPage
    .getByRole("button", { name: "Follow author", exact: true })
    .click();
  await expect(
    readerPage.getByRole("button", { name: "Unfollow author", exact: true }),
  ).toBeVisible();
  await expect(
    readerPage.getByText("13 published stories · 1 followers", { exact: true }),
  ).toBeVisible();
  await readerPage.goto("/account/library?tab=follows");
  await expect(
    readerPage.getByRole("heading", { name: penName, exact: true }),
  ).toBeVisible();
  await readerPage
    .getByRole("button", { name: "Unfollow author", exact: true })
    .click();
  await expect(
    readerPage.getByText("No entries in this section yet.", { exact: true }),
  ).toBeVisible();
  await readerPage.goto("/account/library");
  await readerPage
    .getByRole("button", { name: "Remove bookmark", exact: true })
    .click();
  await expect(
    readerPage.getByText("No entries in this section yet.", { exact: true }),
  ).toBeVisible();
  await readerPage.setViewportSize({ width: 390, height: 844 });
  await readerPage.goto(`/?query=${encodeURIComponent(penName)}&sort=popular`);
  await expect(
    readerPage.getByText("13 matching stories", { exact: true }),
  ).toBeVisible();
  expect(
    await readerPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await readerPage.screenshot({
    path: test.info().outputPath("discovery-mobile.png"),
    fullPage: false,
  });
  await readerPage
    .getByRole("button", { name: "Switch to dark theme", exact: true })
    .click();
  await expect(readerPage.locator("html")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  await readerPage.reload();
  await expect(readerPage.locator("html")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  expect(cloud).toBe(0);
  await readerPage.goto("/account/profile");
  await expect(
    readerPage.getByLabel("Account biography", { exact: true }),
  ).toHaveValue("Private reading notes.");
  await readerPage
    .locator("summary")
    .filter({ hasText: `Reader${stamp}` })
    .click();
  await readerPage
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(
    readerPage.getByLabel("Account biography", { exact: true }),
  ).toHaveCount(0);
  await expect(
    readerPage.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(
    await readerPage.evaluate(() => localStorage.getItem("userId")),
  ).toBeNull();
  await page.goto("/author/dashboard");
  await expect(
    page.getByRole("region", { name: "Author statistics" }),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: `Writer${stamp}` })
    .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Sign in with an approved author account",
  );
  await context.close();
});

test("rejected profile bootstrap terminates restoration and clears the saved account without recursion", async ({
  page,
}) => {
  await login(
    page,
    "publishing-e2e@example.invalid",
    "Publishing-QA-only-2026!",
  );
  await page.route("**/user/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Profile authorization rejected" }),
    }),
  );
  await page.goto("/account/profile");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("userId")), {
      timeout: 5000,
    })
    .toBeNull();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Account biography", { exact: true }),
  ).toHaveCount(0);
});
