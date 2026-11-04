import { test, expect } from "@playwright/test";

test("long-form block writing, autosave, publication and responsive reading without images", async ({
  page,
  context,
}) => {
  const title = `Text novel ${Date.now()}`;
  let uploads = 0;
  page.on("request", (r) => {
    if (r.url().includes("api.cloudinary.com") && r.method() === "POST")
      uploads++;
  });
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("publishing-e2e@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Publishing-QA-only-2026!");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/author/comic/create");
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Genre", { exact: true }).fill("Light novel");
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith("/authors/me/books") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Publish Book", exact: true }).click();
  const book = (await (await created).json()).metadata;
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByRole("link", { name: "Create Chapter", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("The valley train");
  const editor = page.getByRole("textbox", {
    name: "Chapter text",
    exact: true,
  });
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.type("/heading");
  await page.getByRole("option", { name: /^Heading 1/ }).click();
  await page.keyboard.type("A distant light");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Opening line.");
  await page.keyboard.press("Shift+Home");
  await page.getByRole("button", { name: "Bold", exact: true }).first().click();
  await expect(editor.locator("strong")).toContainText("Opening line.");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Control+B"); // New paragraphs inherit marks; return to regular prose.
  const source = Array.from(
    { length: 70 },
    (_, i) =>
      `Paragraph ${i + 1}. ` +
      "The distant train crossed the quiet valley. ".repeat(40),
  ).join("\n\n");
  expect(Buffer.byteLength(source)).toBeGreaterThan(100 * 1024);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate((text) => navigator.clipboard.writeText(text), source);
  await page.keyboard.press("Control+V");
  await expect(editor).toContainText("Paragraph 70.");
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/author note");
  await page.getByRole("option", { name: /Author note/ }).click();
  await page.keyboard.type("Thank you for reading.");
  await page.keyboard.press("Alt+Shift+ArrowUp");
  await page
    .getByRole("button", { name: "Move selected block down", exact: true })
    .click();
  await page.screenshot({
    path: test.info().outputPath("studio-desktop.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page).toHaveURL(/\/chapter\/\d+\/edit/);
  await expect(editor).toContainText("Paragraph 70.");
  const autosaved = page.waitForResponse(
    (r) => r.url().includes("/chapters/") && r.request().method() === "PATCH",
  );
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Revised ending.");
  await autosaved;
  await expect(page.getByRole("status", { name: "Save progress" })).toHaveText(
    "Draft saved successfully.",
  );
  await page.reload();
  await expect(editor).toContainText("Revised ending.");
  const published = page.waitForResponse(
    (r) => r.url().includes("/chapters/") && r.request().method() === "PATCH",
  );
  await page
    .getByRole("button", { name: "Publish Chapter", exact: true })
    .click();
  const chapter = (await (await published).json()).metadata;
  await expect(page.getByRole("status", { name: "Save progress" })).toHaveText(
    "Published successfully.",
  );
  await page.goto(`/comic/${book.slug}/chapters/${chapter.chapterNo}`);
  const prose = page.locator("#chapter-content");
  await expect(prose).toContainText("Paragraph 70.");
  await expect(prose).toContainText("Revised ending.");
  expect((await prose.innerText()).split(/\s+/).length).toBeGreaterThan(5000);
  await expect(
    prose.getByRole("heading", { name: "A distant light" }),
  ).toBeVisible();
  await expect(prose.locator("img")).toHaveCount(0);
  expect(uploads).toBe(0);
  await page.getByLabel("Text size", { exact: true }).selectOption("24");
  await page.getByRole("button", { name: "Dark reading theme" }).click();
  await page.reload();
  await expect(page.getByLabel("Text size", { exact: true })).toHaveValue("24");
  await expect(page.locator(".novel-reader")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(prose).toContainText("Paragraph 70.");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("reader-mobile.png"),
    fullPage: false,
  });
  await page.mouse.wheel(0, 1800);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.values(
          JSON.parse(localStorage.getItem("hibook.reader.progress.v1") || "{}"),
        ).some((v) => (v as { position: number }).position > 0),
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(prose).toContainText("Paragraph 70.");
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
});
