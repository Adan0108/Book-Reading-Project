import { test, expect } from "@playwright/test";

test("inline illustrations stay local, replace/remove/reorder and publish in document order", async ({
  page,
  request,
}) => {
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
  const loggedIn = page.waitForResponse(
    (r) => r.url().endsWith("/access/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  const login = (await (await loggedIn).json()).metadata;
  await expect(page).toHaveURL("/");
  const created = await request.post(
    "http://localhost:3000/v1/api/authors/me/books",
    {
      headers: {
        Authorization: `Bearer ${login.tokens.accessToken}`,
        "x-client-id": String(login.user.id),
      },
      data: {
        title: `Illustrated novel ${Date.now()}`,
        genre: "Novel",
        status: "PUBLISHED",
        requestId: crypto.randomUUID(),
      },
    },
  );
  expect(created.ok()).toBe(true);
  const book = (await created.json()).metadata;
  await page.goto(`/author/comic/${book.id}/chapter/create`);
  await page.getByLabel("Title", { exact: true }).fill("Crossing the bridge");
  const editor = page.getByRole("textbox", {
    name: "Chapter text",
    exact: true,
  });
  await editor.click();
  await page.keyboard.type("Before the bridge.");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ioAAAAASUVORK5CYII=",
    "base64",
  );
  const file = (name: string) => ({ name, mimeType: "image/png", buffer: png });
  async function illustration(caption: string) {
    await page.getByRole("button", { name: "Add block", exact: true }).click();
    await page.getByRole("option", { name: /^Illustration/ }).click();
    await page
      .getByLabel("Choose illustration", { exact: true })
      .last()
      .setInputFiles(file(`${caption}.png`));
    await page
      .getByLabel("Illustration caption", { exact: true })
      .last()
      .fill(caption);
  }
  await illustration("Bridge");
  await page.getByRole("button", { name: "Add block", exact: true }).click();
  await page.getByRole("option", { name: /^Paragraph/ }).click();
  await page.keyboard.type("Between the illustrations.");
  await illustration("Station");
  const dropped = await page.evaluateHandle((base64) => {
    const transfer = new DataTransfer();
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    transfer.items.add(new File([bytes], "removed.png", { type: "image/png" }));
    return transfer;
  }, png.toString("base64"));
  await editor.dispatchEvent("drop", { dataTransfer: dropped });
  await page
    .getByLabel("Illustration caption", { exact: true })
    .last()
    .fill("Removed");
  await expect(page.locator(".studio-illustration")).toHaveCount(3);
  await page
    .locator(".studio-illustration")
    .last()
    .getByRole("button", { name: "Remove illustration", exact: true })
    .click();
  await expect(page.locator(".studio-illustration")).toHaveCount(2);
  await editor.focus();
  await page.keyboard.press("Control+Z");
  await expect(page.locator(".studio-illustration")).toHaveCount(3);
  await editor.focus();
  await page.keyboard.press("Control+Y");
  await expect(page.locator(".studio-illustration")).toHaveCount(2);
  await page
    .getByLabel("Replace illustration", { exact: true })
    .first()
    .setInputFiles({
      name: "invalid.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    });
  await expect(page.getByRole("alert")).toContainText("use JPEG");
  await page
    .getByLabel("Replace illustration", { exact: true })
    .first()
    .setInputFiles(file("replacement.png"));
  await expect(page.locator(".studio-illustration")).toHaveCount(2);
  expect(uploads).toBe(0);
  const blocks = page.locator('[data-content-type="illustration"]');
  await blocks.last().hover();
  const handle = page
    .locator('button[draggable="true"]')
    .filter({ has: page.locator('[data-test="dragHandle"]') });
  const from = await handle.boundingBox(),
    to = await blocks.first().boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    from!.x + from!.width / 2 + 12,
    from!.y + from!.height / 2,
    { steps: 4 },
  );
  await page.mouse.move(to!.x + 10, to!.y - 8, { steps: 20 });
  await page.mouse.up();
  await expect(
    page.getByLabel("Illustration caption", { exact: true }).first(),
  ).toHaveValue("Station");
  const saved = page.waitForResponse(
    (r) => r.url().endsWith("/chapters") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  const chapter = (await (await saved).json()).metadata;
  await expect(page).toHaveURL(/\/chapter\/\d+\/edit/);
  await expect(page.locator(".studio-illustration")).toHaveCount(2);
  expect(uploads).toBe(2);
  await page
    .getByRole("button", { name: "Publish Chapter", exact: true })
    .click();
  await expect(page.getByRole("status", { name: "Save progress" })).toHaveText(
    "Published successfully.",
  );
  expect(uploads).toBe(2);
  await page.goto(`/comic/${book.slug}/chapters/${chapter.chapterNo}`);
  const prose = page.locator("#chapter-content");
  await expect(prose).toContainText("Before the bridge.");
  await expect(prose).toContainText("Between the illustrations.");
  await expect(prose.locator("figcaption")).toHaveText(["Station", "Bridge"]);
  await expect(prose.locator("img")).toHaveCount(2);
});
