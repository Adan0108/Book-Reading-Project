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
test("reader report, audited admin hide/restore, author notice and account suspension affect real access", async ({
  page,
  browser,
  request,
}) => {
  const owner = await login(
      page,
      "publishing-e2e@example.invalid",
      "Publishing-QA-only-2026!",
    ),
    headers = {
      "x-client-id": String(owner.user.id),
      Authorization: `Bearer ${owner.tokens.accessToken}`,
    },
    base = "http://localhost:3000/v1/api",
    stamp = Date.now(),
    title = `Moderation chapter ${stamp}`,
    body = `Visible chapter reviewed by moderation ${stamp}.`,
    reportReason = `Please review this chapter ${stamp}.`;
  const bookResponse = await request.post(`${base}/authors/me/books`, {
    headers,
    data: {
      title: `Moderation story ${stamp}`,
      genre: "Fantasy",
      status: "PUBLISHED",
      requestId: crypto.randomUUID(),
    },
  });
  expect(bookResponse.ok()).toBe(true);
  const book = (await bookResponse.json()).metadata;
  const chapterResponse = await request.post(
    `${base}/authors/me/books/${book.id}/chapters`,
    {
      headers,
      data: {
        title,
        contentMd: body,
        isDraft: false,
        requestId: crypto.randomUUID(),
      },
    },
  );
  expect(chapterResponse.ok()).toBe(true);
  const chapter = (await chapterResponse.json()).metadata,
    readerUrl = `/comic/${book.slug}/chapters/${chapter.chapterNo}`;
  const db = await qaDatabase(),
    email = `moderation-${stamp}@example.invalid`,
    password = "Moderation-QA-only-2026!";
  const [u] = await db.query(
    "INSERT INTO users(email,password_hash,state) VALUES (?,?,1)",
    [email, await qaPasswordHash(password)],
  );
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE code='READER'",
    [u.insertId],
  );
  await db.query("INSERT INTO user_profiles(user_id,username) VALUES (?,?)", [
    u.insertId,
    `Moderation reader ${stamp}`,
  ]);
  await db.end();
  const readerContext = await browser.newContext(),
    readerPage = await readerContext.newPage(),
    reader = await login(readerPage, email, password),
    readerHeaders = {
      "x-client-id": String(reader.user.id),
      Authorization: `Bearer ${reader.tokens.accessToken}`,
    };
  await readerPage.goto(readerUrl);
  await expect(readerPage.getByText(body, { exact: true })).toBeVisible();
  const reporting = readerPage.getByRole("region", {
    name: "Report content",
    exact: true,
  });
  await reporting
    .getByRole("button", { name: "Report this chapter", exact: true })
    .click();
  await reporting
    .getByLabel("Report reason", { exact: true })
    .fill(reportReason);
  await reporting
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(reporting.getByRole("status")).toContainText(
    "Your report was received",
  );
  const adminContext = await browser.newContext(),
    adminPage = await adminContext.newPage();
  await login(
    adminPage,
    "admin-e2e@example.invalid",
    "Publishing-QA-only-2026!",
  );
  await adminPage.goto("/admin/reports");
  const report = adminPage
    .getByRole("article")
    .filter({ hasText: reportReason });
  await expect(report).toBeVisible();
  await report
    .getByRole("button", { name: "Review report", exact: true })
    .click();
  const review = adminPage.getByRole("form", { name: "Report review" });
  await review
    .getByLabel("Review status", { exact: true })
    .selectOption("RESOLVED");
  await review
    .getByLabel("Review reason", { exact: true })
    .fill("Reviewed this report; content decision recorded separately.");
  await review
    .getByRole("button", { name: "Save report review", exact: true })
    .click();
  await expect(adminPage.getByRole("status")).toContainText(
    "Report review recorded.",
  );
  const contentUrl = `/admin/content?kind=CHAPTER&query=${chapter.chapterId}`;
  const comparisonTitle = `Moderation comparison ${stamp}`,
    comparisonBody = `Second review text ${stamp}.`;
  const comparisonResponse = await request.post(
    `${base}/authors/me/books/${book.id}/chapters`,
    {
      headers,
      data: {
        title: comparisonTitle,
        contentMd: comparisonBody,
        isDraft: false,
        requestId: crypto.randomUUID(),
      },
    },
  );
  expect(comparisonResponse.ok()).toBe(true);
  await adminPage.goto(`/admin/content?kind=CHAPTER&query=${stamp}`);
  let release = () => {},
    arrived = () => {};
  const held = new Promise<void>((resolve) => {
      release = resolve;
    }),
    started = new Promise<void>((resolve) => {
      arrived = resolve;
    });
  const heldPreview = `**/admin/content/CHAPTER/${chapter.chapterId}`;
  await adminPage.route(heldPreview, async (route) => {
    const response = await route.fetch();
    arrived();
    await held;
    await route.fulfill({ response });
  });
  await adminPage
    .getByRole("row")
    .filter({ hasText: title })
    .getByRole("button", { name: "Review content", exact: true })
    .click();
  await started;
  await adminPage
    .getByRole("row")
    .filter({ hasText: comparisonTitle })
    .getByRole("button", { name: "Review content", exact: true })
    .click();
  await expect(
    adminPage.getByText(comparisonBody, { exact: true }),
  ).toBeVisible();
  const releasedResponse = adminPage.waitForResponse((r) =>
    r.url().endsWith(`/admin/content/CHAPTER/${chapter.chapterId}`),
  );
  release();
  await releasedResponse;
  await adminPage.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(
    adminPage.getByText(comparisonBody, { exact: true }),
  ).toBeVisible();
  await expect(adminPage.getByText(body, { exact: true })).toHaveCount(0);
  await adminPage.unroute(heldPreview);
  await adminPage.goto(contentUrl);
  await adminPage
    .getByRole("row")
    .filter({ hasText: title })
    .getByRole("button", { name: "Review content", exact: true })
    .click();
  await expect(adminPage.getByText(body, { exact: true })).toBeVisible();
  const moderation = adminPage.getByRole("form", {
    name: "Content moderation",
    exact: true,
  });
  await moderation.getByLabel("Hidden by moderation", { exact: true }).check();
  await moderation
    .getByLabel("Action reason", { exact: true })
    .fill("Temporary visibility review from browser QA.");
  await moderation
    .getByRole("button", { name: "Save moderation decision", exact: true })
    .click();
  await expect(adminPage.getByRole("status")).toContainText(
    "Content hidden. Public access is blocked.",
  );
  expect(
    (
      await request.get(
        `${base}/books/${book.slug}/chapters/${chapter.chapterNo}`,
        { headers: readerHeaders },
      )
    ).status(),
  ).toBe(404);
  await readerPage.reload();
  await expect(
    readerPage.getByRole("heading", { name: "This chapter is unavailable" }),
  ).toBeVisible();
  await page.goto(`/author/comic/${book.id}/chapter/${chapter.chapterId}/edit`);
  await expect(page.getByRole("note")).toContainText(
    "This content is hidden by moderation. Saving does not restore public access.",
  );
  await adminPage.goto(contentUrl);
  await adminPage
    .getByRole("row")
    .filter({ hasText: title })
    .getByRole("button", { name: "Review content", exact: true })
    .click();
  await adminPage
    .getByRole("form", { name: "Content moderation", exact: true })
    .getByLabel("Hidden by moderation", { exact: true })
    .uncheck();
  await adminPage
    .getByLabel("Action reason", { exact: true })
    .fill("Review complete; restore visibility.");
  await adminPage
    .getByRole("button", { name: "Save moderation decision", exact: true })
    .click();
  await expect(adminPage.getByRole("status")).toContainText(
    "Content restored.",
  );
  await readerPage.reload();
  await expect(readerPage.getByText(body, { exact: true })).toBeVisible();
  await adminPage.goto(`/admin/users?query=${encodeURIComponent(email)}`);
  let row = adminPage.getByRole("row").filter({ hasText: email });
  await row.getByRole("button", { name: "Suspend", exact: true }).click();
  await adminPage
    .getByLabel("Action reason", { exact: true })
    .fill("Suspension/session QA.");
  await adminPage
    .getByRole("button", { name: "Confirm account action", exact: true })
    .click();
  await expect(adminPage.getByRole("status")).toContainText(
    "Account state updated.",
  );
  expect(
    (await request.get(`${base}/user/me`, { headers: readerHeaders })).status(),
  ).toBe(401);
  row = adminPage.getByRole("row").filter({ hasText: email });
  await row.getByRole("button", { name: "Restore", exact: true }).click();
  await adminPage
    .getByLabel("Action reason", { exact: true })
    .fill("Restore after QA; require new login.");
  await adminPage
    .getByRole("button", { name: "Confirm account action", exact: true })
    .click();
  await expect(row).toContainText("Active");
  expect(
    (await request.get(`${base}/user/me`, { headers: readerHeaders })).status(),
  ).toBe(401);
  await adminPage.goto("/admin/settings");
  await adminPage
    .getByLabel("Change reason", { exact: true })
    .fill("Record settings verification from headed browser.");
  await adminPage
    .getByRole("button", { name: "Save moderation settings", exact: true })
    .click();
  await expect(adminPage.getByRole("status")).toContainText(
    "Moderation settings saved and audited.",
  );
  await adminPage.goto("/admin/audit");
  await expect(
    adminPage
      .locator("summary")
      .filter({ hasText: `CONTENT_HIDDEN · CHAPTER:${chapter.chapterId}` }),
  ).toBeVisible();
  await adminPage.setViewportSize({ width: 390, height: 844 });
  await adminPage.goto(contentUrl);
  await expect(
    adminPage.getByRole("row").filter({ hasText: title }),
  ).toBeVisible();
  expect(
    await adminPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await adminPage.screenshot({
    path: test.info().outputPath("admin-content-mobile.png"),
    fullPage: false,
  });
  await adminPage.goto("/admin");
  await expect(
    adminPage.getByRole("heading", { name: "Administration", exact: true }),
  ).toBeVisible();
  await expect(
    adminPage.getByRole("heading", {
      name: "Eligible memberships",
      exact: true,
    }),
  ).toBeVisible();
  await adminContext.close();
  await readerContext.close();
});
