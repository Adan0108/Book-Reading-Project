import { test, expect } from "@playwright/test";
test("optional post artwork uploads only on save, retries once, and respects spoilers and access", async ({
  page,
  browser,
  request,
}) => {
  const title = `Post artwork QA ${Date.now()}`,
    text = "A surprising ending for readers who choose to reveal it.";
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ioAAAAASUVORK5CYII=",
    "base64",
  );
  const file = (name: string) => ({ name, mimeType: "image/png", buffer: png }),
    cloud: string[] = [],
    keys: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("api.cloudinary.com") && r.method() === "POST")
      cloud.push(r.url());
  });
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("publishing-e2e@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Publishing-QA-only-2026!");
  const login = page.waitForResponse(
    (r) => r.url().endsWith("/access/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  const actor = (await (await login).json()).metadata;
  await expect(page).toHaveURL("/");
  const headers = {
      Authorization: `Bearer ${actor.tokens.accessToken}`,
      "x-client-id": String(actor.user.id),
    },
    base = "http://localhost:3000/v1/api";
  const profile = await request.get(`${base}/authors/me/profile`, { headers });
  expect(profile.ok()).toBe(true);
  const authorId = (await profile.json()).metadata.id;
  await page.goto("/author/posts");
  await page.getByLabel("Post title", { exact: true }).fill(title);
  await page.getByLabel("Post text", { exact: true }).fill(text);
  await page.getByLabel("Contains spoilers").check();
  await page.getByLabel("Keep as a draft").uncheck();
  await page
    .getByLabel("Add post artwork")
    .setInputFiles([file("one.png"), file("two.png"), file("removed.png")]);
  await expect(page.getByAltText("Page 1 preview")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await page
    .getByRole("button", { name: "Remove page 3", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Move page 2 up", exact: true })
    .click();
  expect(cloud).toHaveLength(0);
  await page.getByRole("link", { name: "My books", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Unsaved changes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(page.getByLabel("Post text", { exact: true })).toHaveValue(text);
  let lose = true;
  await page.route("**/authors/me/posts", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().postDataJSON().requestId);
    if (lose) {
      lose = false;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save post", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry same save" }),
  ).toBeVisible();
  await expect(page.getByLabel("Post title", { exact: true })).toBeDisabled();
  expect(cloud).toHaveLength(2);
  await page.getByRole("button", { name: "Retry same save" }).click();
  await expect(
    page.getByRole("status", { name: "Post save progress" }),
  ).toHaveText("Post saved.");
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect(cloud).toHaveLength(2);
  const list = await request.get(`${base}/authors/me/posts`, { headers }),
    posts = (await list.json()).metadata.items.filter(
      (p: { title: string }) => p.title === title,
    );
  expect(posts).toHaveLength(1);
  const post = posts[0];
  expect(post.images).toHaveLength(2);
  await page.reload();
  await page
    .getByRole("button", { name: `Edit ${title}`, exact: true })
    .click();
  await expect(page.getByLabel("Contains spoilers")).toBeChecked();
  await expect(page.getByAltText("Page 1 preview")).toHaveAttribute(
    "src",
    post.images[0].imageUrl,
  );
  await page
    .getByRole("button", { name: "Move page 2 up", exact: true })
    .click();
  await page.getByRole("button", { name: "Save post", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Post save progress" }),
  ).toHaveText("Post saved.");
  expect(cloud).toHaveLength(2);
  const guest = await browser.newContext(),
    view = await guest.newPage();
  await view.goto(`/author/${authorId}/posts`);
  const article = view
    .getByRole("article")
    .filter({ has: view.getByRole("heading", { name: title, exact: true }) });
  await expect(article.getByText(text, { exact: true })).toHaveCount(0);
  await article.locator("summary").click();
  await expect(article.getByText(text, { exact: true })).toBeVisible();
  await expect(article.getByAltText("Post artwork 1")).toHaveAttribute(
    "src",
    post.images[1].imageUrl,
  );
  await view.setViewportSize({ width: 390, height: 844 });
  expect(
    await view.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await view.screenshot({
    path: test.info().outputPath("post-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: `Edit ${title}`, exact: true })
    .click();
  await page.getByLabel("Post access", { exact: true }).selectOption("MEMBERS");
  await page.getByRole("button", { name: "Save post", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Post save progress" }),
  ).toHaveText("Post saved.");
  await view.reload();
  await expect(
    article.getByText(/available to eligible members/),
  ).toBeVisible();
  await expect(article.getByAltText("Post artwork 1")).toHaveCount(0);
  await expect(article.getByText(text, { exact: true })).toHaveCount(0);
  const teaser = await request.get(`${base}/authors/${authorId}/posts`);
  const locked = (await teaser.json()).metadata.items.find(
    (p: { id: number }) => p.id === post.id,
  );
  expect(locked).not.toHaveProperty("images");
  expect(locked).not.toHaveProperty("body");
  await guest.close();
});
