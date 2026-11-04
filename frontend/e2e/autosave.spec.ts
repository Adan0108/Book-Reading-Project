import { test, expect } from "@playwright/test";

test("autosave creates one draft without remounting and preserves edits made during a pending save", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("publishing-e2e@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Publishing-QA-only-2026!");
  const loggedIn = page.waitForResponse(
    (r) => r.url().endsWith("/access/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  const login = (await (await loggedIn).json()).metadata;
  await expect(page).toHaveURL("/");
  const bookResponse = await request.post(
    "http://localhost:3000/v1/api/authors/me/books",
    {
      headers: {
        Authorization: `Bearer ${login.tokens.accessToken}`,
        "x-client-id": String(login.user.id),
      },
      data: {
        title: `Autosave novel ${Date.now()}`,
        genre: "Novel",
        requestId: crypto.randomUUID(),
      },
    },
  );
  expect(bookResponse.ok()).toBe(true);
  const book = (await bookResponse.json()).metadata;
  await page.goto(`/author/comic/${book.id}/chapter/create`);
  await page.getByLabel("Title", { exact: true }).fill("A continuous draft");
  const editor = page.getByRole("textbox", {
    name: "Chapter text",
    exact: true,
  });
  await editor.click();
  await page.keyboard.type("The first paragraph.");
  const original = await editor.elementHandle();
  await expect(page).toHaveURL(/\/chapter\/\d+\/edit/, { timeout: 15000 });
  expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
  await expect(editor).toBeFocused();
  let release!: () => void, observed!: () => void;
  const pending = new Promise<void>((resolve) => {
      release = resolve;
    }),
    seen = new Promise<void>((resolve) => {
      observed = resolve;
    });
  let first = true;
  await page.route("**/authors/me/books/*/chapters/*", async (route) => {
    if (route.request().method() === "PATCH" && first) {
      first = false;
      observed();
      await pending;
    }
    await route.continue();
  });
  await page.keyboard.type(" First change.");
  await seen;
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await page.keyboard.type(" During save.");
  const finished = page.waitForResponse(
    (r) => r.url().includes("/chapters/") && r.request().method() === "PATCH",
  );
  release();
  await finished;
  await expect(editor).toContainText("During save.");
  await expect(
    page.getByText("Unsaved changes", { exact: false }).first(),
  ).toBeVisible();
  const latest = page.waitForResponse(
    (r) => r.url().includes("/chapters/") && r.request().method() === "PATCH",
  );
  await latest;
  await expect(page.getByRole("status", { name: "Save progress" })).toHaveText(
    "Draft saved successfully.",
  );
  await page.reload();
  await expect(editor).toContainText("First change. During save.");
  await page.setViewportSize({ width: 390, height: 844 });
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Mobile revision.");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "← My books", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Unsaved changes" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Unsaved changes" }),
  ).toHaveCount(0);
  await expect(editor).toContainText("Mobile revision.");
  await page.screenshot({
    path: test.info().outputPath("studio-mobile.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByRole("status", { name: "Save progress" })).toHaveText(
    "Draft saved successfully.",
  );
  const listing = await request.get(
    `http://localhost:3000/v1/api/authors/me/books/${book.id}`,
    {
      headers: {
        Authorization: `Bearer ${login.tokens.accessToken}`,
        "x-client-id": String(login.user.id),
      },
    },
  );
  expect((await listing.json()).metadata.chapters).toHaveLength(1);
});
