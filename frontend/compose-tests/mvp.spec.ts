import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
const project =
  process.env.COMPOSE_QA_PROJECT || "hibook-mvp-verification-20261105";
const docker = promisify(execFile);
test.skip(
  process.env.COMPOSE_QA_ALLOW_WRITES !== "1",
  "Explicit opt-in required for the isolated Compose fixture",
);
test("built application registers through local mail, provisions author, publishes and survives service recreation", async ({
  page,
  browser,
  request,
}) => {
  if (!/^hibook-mvp-verification-[a-z0-9-]+$/.test(project))
    throw new Error("A dedicated verification project is required");
  const stamp = Date.now(),
    password = "Compose-QA-only-2026!",
    writerEmail = `compose-writer-${stamp}@example.invalid`,
    adminEmail = `compose-admin-${stamp}@example.invalid`,
    bookTitle = `Compose novel ${stamp}`,
    chapterText =
      "A train crossed the valley as the last light faded. This text was published through the built application.";
  const compose = (...args: string[]) =>
    docker(
      "docker",
      [
        "compose",
        "-p",
        project,
        "--env-file",
        path.resolve("../.env.compose.qa"),
        ...args,
      ],
      { cwd: path.resolve(".."), timeout: 60000 },
    );
  async function otp(email: string, client: APIRequestContext) {
    let value = "";
    await expect
      .poll(async () => {
        const list = await client.get(
          `${process.env.COMPOSE_QA_MAILBOX || "http://localhost:8027"}/api/v1/messages`,
        );
        const body = await list.json();
        const mail = body.messages.find((m: { To: { Address: string }[] }) =>
          m.To.some((to) => to.Address === email),
        );
        if (!mail) return "";
        const detail = await (
          await client.get(
            `${process.env.COMPOSE_QA_MAILBOX || "http://localhost:8027"}/api/v1/message/${mail.ID}`,
          )
        ).json();
        value = detail.HTML.match(/class="code">\s*(\d{6})\s*</)?.[1] ?? "";
        return value;
      })
      .toMatch(/^\d{6}$/);
    return value;
  }
  async function register(actor: Page, email: string, name: string) {
    await actor.goto("/signup");
    await actor.getByLabel("Email", { exact: true }).fill(email);
    await actor.locator('button[type="submit"]').click();
    await expect(actor).toHaveURL(/\/OTP$/);
    const code = await otp(email, request),
      inputs = actor.locator(
        'input[inputmode="numeric"],input[aria-label^="Please enter OTP"]',
      );
    for (let i = 0; i < 6; i++) await inputs.nth(i).fill(code[i]);
    await expect(actor).toHaveURL(/\/setPassword$/);
    await actor.getByLabel("Username", { exact: true }).fill(name);
    await actor.getByLabel("Password", { exact: true }).fill(password);
    await actor.getByLabel("Confirm Password", { exact: true }).fill(password);
    await actor.locator('button[type="submit"]').click();
    await expect(actor).toHaveURL(/\/login$/);
  }
  async function login(actor: Page, email: string) {
    await actor.goto("/login");
    await actor.getByLabel("Email", { exact: true }).fill(email);
    await actor.getByLabel("Password", { exact: true }).fill(password);
    await actor.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(actor).toHaveURL(/:\d+\/$/);
  }
  const cloud: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("cloudinary.com")) cloud.push(r.url());
  });
  const adminContext = await browser.newContext(),
    admin = await adminContext.newPage();
  await register(admin, adminEmail, `ComposeAdmin${stamp}`);
  await compose(
    "exec",
    "-T",
    "backend",
    "node",
    "dist/operations/grantAdmin.js",
    adminEmail,
  );
  await login(admin, adminEmail);
  await register(page, writerEmail, `ComposeWriter${stamp}`);
  await login(page, writerEmail);
  await page.goto("/account/author-application");
  await page.getByLabel("Pen name", { exact: true }).fill("Compose writer");
  await page.getByLabel("Application title", { exact: true }).fill(bookTitle);
  await page.getByLabel("Sample title", { exact: true }).fill("A beginning");
  await page
    .getByLabel("Writing sample")
    .fill("The night train crossed the river. ".repeat(40));
  await page
    .getByRole("button", { name: "Submit application", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Status: PENDING");
  await admin.goto("/admin/applications");
  const application = admin
    .getByRole("listitem")
    .filter({ hasText: bookTitle });
  await application.getByRole("button", { name: /Review application/ }).click();
  await admin
    .getByRole("button", { name: "Approve author", exact: true })
    .click();
  await expect(
    admin.getByRole("region", { name: "Review application" }),
  ).toHaveCount(0);
  await page.goto("/author/comic/create");
  await page.getByLabel("Title", { exact: true }).fill(bookTitle);
  await page.getByLabel("Genre", { exact: true }).fill("Light novel");
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith("/authors/me/books") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Publish Book", exact: true }).click();
  const book = (await (await created).json()).metadata;
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByRole("link", { name: "Create Chapter", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("The last light");
  await page
    .getByRole("textbox", { name: "Chapter text", exact: true })
    .fill(chapterText);
  await page
    .getByRole("button", { name: "Publish Chapter", exact: true })
    .click();
  await expect(page.getByRole("status", { name: "Save progress" })).toHaveText(
    "Published successfully.",
  );
  expect(cloud).toHaveLength(0);
  const readerContext = await browser.newContext(),
    reader = await readerContext.newPage();
  await reader.goto(`/comic/${book.slug}/chapters/1`);
  await expect(reader.locator("#chapter-content")).toContainText(chapterText);
  await reader.setViewportSize({ width: 390, height: 844 });
  expect(
    await reader.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await reader.screenshot({
    path: test.info().outputPath("compose-reader-mobile.png"),
    fullPage: true,
  });
  const health = await request.get("/health/ready");
  expect(health.status()).toBe(200);
  const spec = await request.get("/api-docs/openapi.json");
  expect(spec.ok()).toBe(true);
  expect((await spec.json()).paths["/v1/api/payments/checkout"]).toBeDefined();
  await admin.goto("/api-docs/");
  await expect(
    admin.getByRole("heading", { name: /HiBook API/ }),
  ).toBeVisible();
  try {
    await compose("stop", "redis");
    await expect
      .poll(async () => (await request.get("/health/ready")).status())
      .toBe(503);
    expect((await request.get("/v1/api/books?limit=1")).status()).toBe(200);
    const blocked = await request.post("/v1/api/access/login", {
      data: { email: writerEmail, password },
    });
    expect(blocked.status()).toBe(503);
  } finally {
    await compose("start", "redis");
  }
  await expect
    .poll(async () => (await request.get("/health/ready")).status(), {
      timeout: 30000,
    })
    .toBe(200);
  await compose("up", "-d", "--no-deps", "--force-recreate", "backend");
  await expect
    .poll(async () => (await request.get("/health/ready")).status(), {
      timeout: 30000,
    })
    .toBe(200);
  await reader.reload();
  await expect(reader.locator("#chapter-content")).toContainText(chapterText);
  await page.goto("/account/profile");
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
    `ComposeWriter${stamp}`,
  );
  expect(cloud).toHaveLength(0);
  await readerContext.close();
  await adminContext.close();
});
