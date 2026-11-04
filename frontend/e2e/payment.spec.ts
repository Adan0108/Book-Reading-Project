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
test("fixture checkout confirms membership and donation only through signed webhook; histories and cancellation persist", async ({
  page,
  browser,
  request,
}) => {
  const actor = await login(
    page,
    "publishing-e2e@example.invalid",
    "Publishing-QA-only-2026!",
  );
  const headers = {
    "x-client-id": String(actor.user.id),
    Authorization: `Bearer ${actor.tokens.accessToken}`,
  };
  const base = "http://localhost:3000/v1/api";
  expect(
    (
      await request.put(`${base}/authors/me/tiers/1`, {
        headers,
        data: {
          name: `Payment supporters ${Date.now()}`,
          benefits: ["Member reading"],
          available: true,
        },
      })
    ).ok(),
  ).toBe(true);
  const plans = (
      await (await request.get(`${base}/authors/me/tiers`, { headers })).json()
    ).metadata,
    authorId = plans.authorId,
    tier = plans.tiers.find((t: { level: number }) => t.level === 1);
  const created = await request.post(`${base}/authors/me/books`, {
    headers,
    data: {
      title: `Billing novel ${Date.now()}`,
      genre: "Fantasy",
      synopsis: "A fixture checkout unlocks reading.",
      visibility: "MEMBERS",
      status: "PUBLISHED",
      requestId: crypto.randomUUID(),
    },
  });
  expect(created.ok()).toBe(true);
  const book = (await created.json()).metadata;
  const chapter = await request.post(
    `${base}/authors/me/books/${book.id}/chapters`,
    {
      headers,
      data: {
        title: "Paid chapter",
        contentMd: "A verified fixture invoice unlocked this text.",
        visibility: "PUBLIC",
        isDraft: false,
        requestId: crypto.randomUUID(),
      },
    },
  );
  expect(chapter.ok()).toBe(true);
  const ch = (await chapter.json()).metadata;
  const db = await qaDatabase(),
    email = `payment-${Date.now()}@example.invalid`,
    password = "Payment-QA-only-2026!";
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
    `Payment reader ${Date.now()}`,
  ]);
  await db.end();
  const readerContext = await browser.newContext(),
    readerPage = await readerContext.newPage();
  const reader = await login(readerPage, email, password),
    readerHeaders = {
      "x-client-id": String(reader.user.id),
      Authorization: `Bearer ${reader.tokens.accessToken}`,
    };
  const chapterUrl = `${base}/books/${book.slug}/chapters/${ch.chapterNo}`;
  expect(
    (await request.get(chapterUrl, { headers: readerHeaders })).status(),
  ).toBe(403);
  await readerPage.goto(`/author/${authorId}/memberships`);
  await expect(
    readerPage.getByText("Payment test simulation. No real transaction."),
  ).toBeVisible();
  await readerPage
    .getByRole("button", { name: `Subscribe to ${tier.name}`, exact: true })
    .click();
  await expect(
    readerPage.getByRole("heading", { name: "Payment test simulation" }),
  ).toBeVisible();
  expect(
    (await request.get(chapterUrl, { headers: readerHeaders })).status(),
  ).toBe(403);
  await readerPage
    .getByRole("button", { name: "Confirm fixture payment" })
    .click();
  await expect(readerPage.getByRole("status")).toContainText(
    "Payment confirmed by verified webhook.",
  );
  expect(
    (await request.get(chapterUrl, { headers: readerHeaders })).status(),
  ).toBe(200);
  await readerPage.goto(`/comic/${book.slug}/chapters/${ch.chapterNo}`);
  await expect(
    readerPage.getByText("A verified fixture invoice unlocked this text.", {
      exact: true,
    }),
  ).toBeVisible();
  await readerPage.goto(`/author/${authorId}/donate`);
  await readerPage
    .getByLabel("Donation amount (USD)", { exact: true })
    .fill("7.25");
  await readerPage
    .getByRole("button", { name: "Continue to donation checkout" })
    .click();
  await expect(
    readerPage.getByRole("heading", { name: "Payment test simulation" }),
  ).toBeVisible();
  await readerPage
    .getByRole("button", { name: "Confirm fixture payment" })
    .click();
  await expect(readerPage.getByRole("status")).toContainText(
    "Payment confirmed by verified webhook.",
  );
  await expect(
    readerPage.getByText("Donations after refunds: $7.25", { exact: true }),
  ).toBeVisible();
  await readerPage.goto("/account/memberships");
  await expect(readerPage.getByText(tier.name, { exact: false })).toBeVisible();
  await readerPage
    .getByRole("button", { name: "Cancel renewal", exact: true })
    .click();
  await expect(readerPage.getByRole("status")).toContainText(
    "Renewal canceled. Access continues",
  );
  expect(
    (await request.get(chapterUrl, { headers: readerHeaders })).status(),
  ).toBe(200);
  await readerPage.setViewportSize({ width: 390, height: 844 });
  await readerPage.goto("/account/payments");
  await expect(readerPage.getByRole("heading",{name:"Payment history",exact:true})).toBeVisible();
  await expect(readerPage.getByText("Donations after refunds: $7.25",{exact:true})).toBeVisible();
  expect(
    await readerPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await readerPage.screenshot({
    path: test.info().outputPath("payments-mobile.png"),
    fullPage: false,
  });
  await page.goto("/author/payments");
  await expect(
    page.getByRole("heading", { name: "Author income" }),
  ).toBeVisible();
  await expect(
    page.getByText("Donation · Publishing Browser QA", { exact: true }).first(),
  ).toBeVisible();
  await readerContext.close();
});
