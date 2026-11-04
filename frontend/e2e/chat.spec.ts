import { test, expect, type Page } from "@playwright/test";
import { qaDatabase, qaPasswordHash } from "./qaDatabase";
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const wait = page.waitForResponse(
    (r) => r.url().endsWith("/access/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  const actor = (await (await wait).json()).metadata;
  await expect(page).toHaveURL("/");
  return actor;
}
test("member and author exchange persisted messages, recover reconnects/retries and lose access on expiry", async ({
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
    },
    base = "http://localhost:3000/v1/api";
  expect(
    (
      await request.put(`${base}/authors/me/tiers/1`, {
        headers,
        data: {
          name: `Chat supporters ${Date.now()}`,
          benefits: ["Private member chat"],
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
  const db = await qaDatabase(),
    stamp = Date.now(),
    email = `chat-${stamp}@example.invalid`,
    password = "Chat-QA-only-2026!",
    username = `Chat reader ${stamp}`;
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
    username,
  ]);
  const [grant] = await db.query(
    "INSERT INTO memberships(user_id,author_id,tier_id,status,current_period_end,provider) VALUES (?,?,?,'ACTIVE',DATE_ADD(NOW(),INTERVAL 1 DAY),'MANUAL')",
    [u.insertId, authorId, tier.id],
  );
  await page.goto("/account/messages");
  await expect(
    page.getByRole("heading", { name: "Member messages" }),
  ).toBeVisible();
  const context = await browser.newContext(),
    readerPage = await context.newPage();
  const reader = await login(readerPage, email, password),
    readerHeaders = {
      "x-client-id": String(reader.user.id),
      Authorization: `Bearer ${reader.tokens.accessToken}`,
    };
  let sockets = 0;
  readerPage.on("websocket", (socket) => {
    if (socket.url().includes("/socket.io/")) sockets++;
  });
  await readerPage.goto(`/account/messages?author=${authorId}`);
  await expect(readerPage.getByRole("status")).toHaveText("Connected");
  await readerPage
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Hello from a member.");
  await readerPage
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: new RegExp(username) }),
  ).toBeVisible();
  await page.getByRole("button", { name: new RegExp(username) }).click();
  await expect(page.getByRole("log")).toContainText("Hello from a member.");
  await readerPage
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("This arrives through the live socket.");
  await readerPage
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(page.getByRole("log")).toContainText(
    "This arrives through the live socket.",
  );
  expect(sockets).toBeGreaterThan(0);
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("An author reply.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(readerPage.getByRole("log")).toContainText("An author reply.");
  await context.setOffline(true);
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Persisted while the member was offline.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("log")).toContainText(
    "Persisted while the member was offline.",
  );
  await context.setOffline(false);
  await expect(readerPage.getByRole("log")).toContainText(
    "Persisted while the member was offline.",
  );
  const attempts: string[] = [];
  await readerPage.route("**/chat/conversations/*/messages", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    attempts.push(route.request().postDataJSON().clientId);
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Simulated lost acknowledgment" }),
    });
  });
  await readerPage
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Retry this message once.");
  await readerPage
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(readerPage.getByRole("alert")).toContainText(
    "Simulated lost acknowledgment",
  );
  await expect(
    readerPage.getByRole("textbox", { name: "Message", exact: true }),
  ).toHaveValue("Retry this message once.");
  await readerPage.unroute("**/chat/conversations/*/messages");
  const retry = readerPage.waitForRequest(
    (r) =>
      r.url().includes("/chat/conversations/") &&
      r.url().endsWith("/messages") &&
      r.method() === "POST",
  );
  await readerPage
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  expect((await retry).postDataJSON().clientId).toBe(attempts[0]);
  await expect(
    readerPage.getByRole("textbox", { name: "Message", exact: true }),
  ).toHaveValue("");
  await expect(
    readerPage
      .getByRole("log")
      .getByText("Retry this message once.", { exact: true }),
  ).toHaveCount(1);
  const [[count]] = await db.query(
    "SELECT COUNT(*) AS total FROM member_messages WHERE sender_user_id=? AND client_id=?",
    [u.insertId, attempts[0]],
  );
  expect(count.total).toBe(1);
  await readerPage.reload();
  await expect(
    readerPage.getByRole("button", { name: /Publishing Browser QA/ }),
  ).toBeVisible();
  await readerPage
    .getByRole("button", { name: /Publishing Browser QA/ })
    .click();
  await expect(readerPage.getByRole("log")).toContainText(
    "Retry this message once.",
  );
  await readerPage.setViewportSize({ width: 390, height: 844 });
  expect(
    await readerPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await readerPage.screenshot({
    path: test.info().outputPath("chat-mobile.png"),
    fullPage: false,
  });
  const [convs] = await db.query(
    "SELECT id FROM member_conversations WHERE author_id=? AND member_user_id=?",
    [authorId, u.insertId],
  );
  const id = convs[0].id;
  await db.query(
    "UPDATE memberships SET current_period_end=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE id=?",
    [grant.insertId],
  );
  expect(
    (
      await request.get(`${base}/chat/conversations/${id}/messages`, {
        headers: readerHeaders,
      })
    ).status(),
  ).toBe(403);
  await expect(readerPage.getByRole("alert")).toContainText(
    "active membership",
  );
  await expect(
    readerPage.getByRole("textbox", { name: "Message", exact: true }),
  ).toBeDisabled();
  await expect(readerPage.getByRole("log")).not.toContainText(
    "Retry this message once.",
  );
  expect(
    (
      await request.post(`${base}/chat/conversations/${id}/messages`, {
        headers,
        data: {
          text: "Expired reader cannot receive this.",
          clientId: crypto.randomUUID(),
        },
      })
    ).status(),
  ).toBe(403);
  await db.end();
  await context.close();
});
