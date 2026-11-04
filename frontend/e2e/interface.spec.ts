import { test, expect, type Page } from "@playwright/test";
import { checkAccessibility as scan } from "./accessibility";
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Publishing-QA-only-2026!");
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/access/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  const actor = (await (await pending).json()).metadata;
  await expect(page).toHaveURL("/");
  return actor;
}
test("reader, author and admin layouts support responsive navigation, errors and practical accessibility", async ({
  page,
  request,
  browser,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await scan(page);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.goto("/login");
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await scan(page);
  await page.goto("/signup");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await scan(page);
  await page.goto("/forgot/email");
  await expect(page.getByLabel("Email Address", { exact: true })).toBeVisible();
  await scan(page);
  const actor = await login(page, "publishing-e2e@example.invalid"),
    headers = {
      Authorization: `Bearer ${actor.tokens.accessToken}`,
      "x-client-id": String(actor.user.id),
    },
    base = "http://localhost:3000/v1/api",
    prefix = `Workspace ${Date.now()}`;
  let firstBook = 0,
    firstSlug = "";
  for (let i = 1; i <= 13; i++) {
    const response = await request.post(`${base}/authors/me/books`, {
      headers,
      data: {
        title: `${prefix} story ${i}`,
        genre: "Light novel",
        status: "DRAFT",
        requestId: crypto.randomUUID(),
      },
    });
    expect(response.ok()).toBe(true);
    if (i === 1) {
      const created = (await response.json()).metadata;
      firstBook = created.id;
      firstSlug = created.slug;
    }
  }
  const chapter = await request.post(
    `${base}/authors/me/books/${firstBook}/chapters`,
    {
      headers,
      data: {
        title: "A quiet first draft",
        isDraft: true,
        requestId: crypto.randomUUID(),
      },
    },
  );
  expect(chapter.ok()).toBe(true);
  const chapterId = (await chapter.json()).metadata.chapterId;
  let fail = true;
  await page.route("**/authors/me/books?*", async (route) => {
    if (fail) {
      fail = false;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Temporary story-list outage" }),
      });
    }
    return route.continue();
  });
  await page.goto(`/author/dashboard?query=${encodeURIComponent(prefix)}`);
  await expect(page.getByRole("alert")).toContainText(
    "Temporary story-list outage",
  );
  await page.getByRole("button", { name: "Retry stories" }).click();
  await expect(
    page.getByText("13 matching stories", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("article")
      .filter({
        has: page.getByRole("button", { name: "Chapters", exact: true }),
      }),
  ).toHaveCount(12);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(
    page
      .getByRole("article")
      .filter({
        has: page.getByRole("button", { name: "Chapters", exact: true }),
      }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Chapters", exact: true }).click();
  await expect(
    page.getByText("1. A quiet first draft", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Edit chapter 1", exact: true }),
  ).toBeVisible();
  await scan(page);
  for (const [width, height, label] of [
    [1280, 900, "desktop"],
    [768, 1024, "tablet"],
    [390, 844, "mobile"],
  ] as const) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`author-${label}.png`),
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await scan(page);
  await page.screenshot({
    path: test.info().outputPath("author-dark-mobile.png"),
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe("auto");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  expect(
    (
      await request.patch(`${base}/authors/me/books/${firstBook}`, {
        headers,
        data: { status: "PUBLISHED", requestId: crypto.randomUUID() },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.patch(
        `${base}/authors/me/books/${firstBook}/chapters/${chapterId}`,
        {
          headers,
          data: {
            isDraft: false,
            contentMd: "A quiet chapter is ready to read.",
            requestId: crypto.randomUUID(),
          },
        },
      )
    ).ok(),
  ).toBe(true);
  const authorId = (
    await (await request.get(`${base}/authors/me/profile`, { headers })).json()
  ).metadata.id;
  for (const url of [
    "/account/library",
    "/account/profile",
    "/account/memberships",
    "/account/payments",
    "/account/messages",
    "/author/memberships",
    "/author/posts",
    "/author/profile",
    `/comic/${firstSlug}`,
    `/comic/${firstSlug}/chapters/1`,
    `/author/${authorId}`,
    `/author/${authorId}/memberships`,
    `/author/${authorId}/posts`,
    `/author/${authorId}/donate`,
  ]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: /^Loading|Checking account/ }),
    ).toHaveCount(0);
    await scan(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const adminContext = await browser.newContext(),
    admin = await adminContext.newPage();
  await login(admin, "admin-e2e@example.invalid");
  for (const url of [
    "/admin",
    "/admin/users",
    "/admin/content",
    "/admin/reports",
    "/admin/settings",
    "/admin/audit",
    "/admin/reconciliation",
    "/admin/applications",
    "/admin/membership-policy",
  ]) {
    await admin.goto(url);
    await expect(admin.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      admin.getByRole("status").filter({ hasText: /^Loading/ }),
    ).toHaveCount(0);
    await scan(admin);
  }
  await admin.setViewportSize({ width: 390, height: 844 });
  expect(
    await admin.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await admin.screenshot({
    path: test.info().outputPath("admin-policy-mobile.png"),
    fullPage: true,
  });
  await adminContext.close();
  await page.goto("/this-link-does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await scan(page);
});
