import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import type { PaymentProvider, PaymentUpdate } from "../src/payments/provider";
import type { PaymentService } from "../src/payments/payment.service";
import { configureQaEnvironment } from "./qa-environment";
import { StripeProvider } from "../src/payments/stripe.provider";
import Stripe from "stripe";

const enabled = process.env.PUBLISHING_TEST_DATABASE === "publishing_qa";
// Independent of built dist: real SDK signature verification, deterministic external API boundary.
function fixture() {
  const secret = `whsec_${randomUUID()}`,
    sdk = new Stripe("sk_test_nonfunctional_fixture");
  const verifier = new StripeProvider("sk_test_nonfunctional_fixture", secret);
  const subscriptions = new Map<
      string,
      { id: string; intentId: string; status: string; autoRenew: boolean }
    >(),
    updates = new Map<string, PaymentUpdate>();
  let checkouts = 0,
    failCheckout = false;
  const provider: PaymentProvider = {
    name: "STRIPE",
    fixture: true,
    async createCheckout(q) {
      checkouts++;
      if (failCheckout) {
        failCheckout = false;
        throw new Error("Simulated ambiguous provider timeout");
      }
      return {
        id: `cs_${q.id}`,
        url: `http://localhost:3000/__qa/checkout/${q.id}`,
      };
    },
    verifyEvent: (raw, sig) => verifier.verifyEvent(raw, sig),
    async resolveEvent(e) {
      return updates.get(e.objectId) ?? { kind: "IGNORE" };
    },
    async subscription(id) {
      const s = subscriptions.get(id);
      if (!s) throw new Error("Unknown subscription");
      return { ...s };
    },
    async cancelRenewal(id) {
      const s = subscriptions.get(id)!;
      s.autoRenew = false;
      return { ...s };
    },
  };
  return {
    provider,
    subscriptions,
    failNextCheckout() {
      failCheckout = true;
    },
    get checkouts() {
      return checkouts;
    },
    event(update: PaymentUpdate, id = `evt_${randomUUID()}`) {
      const objectId = `obj_${randomUUID()}`;
      updates.set(objectId, update);
      const raw = Buffer.from(
        JSON.stringify({
          id,
          type: "invoice.paid",
          livemode: false,
          created: Math.floor(Date.now() / 1000),
          data: { object: { id: objectId } },
        }),
      );
      return {
        raw,
        signature: sdk.webhooks.generateTestHeaderString({
          payload: raw.toString(),
          secret,
        }),
      };
    },
  };
}
describe.skipIf(!enabled)("real MySQL verified sandbox billing", () => {
  let pool: Pool,
    service: PaymentService,
    authorUser: number,
    authorId: number,
    reader: number,
    outsider: number,
    tierId: number;
  let configured: typeof import("../src/payments/payment.service").createPaymentService;
  let redis: typeof import("../src/dbs/init.redis");
  let sessions: typeof import("../src/services/session.service");
  const external = fixture(),
    app = express();
  const subId = `sub_${randomUUID()}`;
  let intentId: string, invoice: PaymentUpdate;
  async function rows(sql: string, args: unknown[] = []) {
    const [r] = await pool.query<RowDataPacket[]>(sql, args);
    return r;
  }
  async function seedUser(role: string) {
    const [u] = await pool.query<ResultSetHeader>(
      "INSERT INTO users(email,password_hash,state) VALUES (?,'fixture-only',1)",
      [`billing-${randomUUID()}@example.invalid`],
    );
    await pool.query(
      "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE code=?",
      [u.insertId, role],
    );
    return u.insertId;
  }
  async function deliver(update: PaymentUpdate, id?: string) {
    const e = external.event(update, id);
    return service.webhook(e.raw, e.signature);
  }
  beforeAll(async () => {
    configureQaEnvironment();
    ({ pool } = await import("../src/dbs/init.mysql"));
    await (await import("../src/dbs/migrate")).runMigrationsOnce();
    await (await import("../src/dbs/migrate")).runMigrationsOnce();
    ({ createPaymentService: configured } = await import(
      "../src/payments/payment.service"
    ));
    service = configured(external.provider);
    redis = await import("../src/dbs/init.redis");
    await redis.initRedis();
    sessions = await import("../src/services/session.service");
    authorUser = await seedUser("AUTHOR");
    reader = await seedUser("READER");
    outsider = await seedUser("READER");
    const [a] = await pool.query<ResultSetHeader>(
      "INSERT INTO authors(user_id,pen_name,is_approved) VALUES (?,'Billing QA',1)",
      [authorUser],
    );
    authorId = a.insertId;
    const m = await import("../src/services/membership.service");
    tierId = (
      await m.saveTier(authorUser, 1, {
        name: "Paid readers",
        benefits: ["Member chapters"],
      })
    ).tier!.id;
    const { createWebhookRouter, createPaymentRouter } = await import(
      "../src/routes/payments"
    );
    app.use(createWebhookRouter(service));
    app.use(express.json());
    app.use("/v1/api", createPaymentRouter(service));
    app.use(
      (
        e: { status?: number; message: string },
        _q: express.Request,
        r: express.Response,
        _n: express.NextFunction,
      ) => r.status(e.status ?? 500).json({ message: e.message }),
    );
  }, 30000);
  afterAll(async () => {
    await pool?.end();
    await redis?.closeRedis();
  });
  it("reports unavailable configuration without making any provider calls", async () => {
    expect(configured().configuration().configured).toBe(false);
    await expect(configured().checkout(reader, {})).rejects.toMatchObject({
      status: 503,
    });
  });
  it("rejects foreign tiers, client pricing, own-author support and invalid amounts", async () => {
    const base = {
      kind: "MEMBERSHIP",
      authorId,
      tierId,
      requestId: randomUUID(),
    };
    await expect(
      service.checkout(reader, { ...base, tierId: 99999999 }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.checkout(reader, { ...base, priceCents: 1 }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(service.checkout(authorUser, base)).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      service.checkout(reader, {
        kind: "DONATION",
        authorId,
        amountCents: 0,
        requestId: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("replays stable checkout keys, rejects conflicting and duplicate open purchases, grants nothing from redirect", async () => {
    const body = {
      kind: "MEMBERSHIP",
      authorId,
      tierId,
      requestId: randomUUID(),
    };
    const first = await service.checkout(reader, body);
    intentId = first.id;
    expect((await service.checkout(reader, body)).id).toBe(intentId);
    expect(external.checkouts).toBe(1);
    await expect(
      service.checkout(reader, { ...body, kind: "DONATION", amountCents: 500 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.checkout(reader, { ...body, requestId: randomUUID() }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await service.checkoutStatus(reader, intentId)).state).toBe(
      "PENDING",
    );
    expect(
      await rows("SELECT id FROM memberships WHERE user_id=?", [reader]),
    ).toHaveLength(0);
    await expect(
      service.checkoutStatus(outsider, intentId),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("rejects forged/stale signatures and mutated bytes before any grant", async () => {
    const e = external.event({ kind: "IGNORE" });
    await expect(service.webhook(e.raw, "t=1,v1=forged")).rejects.toMatchObject(
      { status: 400 },
    );
    await expect(
      service.webhook(Buffer.concat([e.raw, Buffer.from(" ")]), e.signature),
    ).rejects.toMatchObject({ status: 400 });
    const response = await request(app)
      .post("/v1/api/payments/stripe/webhook")
      .set("stripe-signature", e.signature)
      .set("Content-Type", "application/json")
      .send(e.raw.toString());
    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
  });
  it("rolls back mismatched amounts then atomically records a paid invoice and one entitlement under duplicate delivery", async () => {
    external.subscriptions.set(subId, {
      id: subId,
      intentId,
      status: "active",
      autoRenew: true,
    });
    const [quote] = await rows("SELECT cents FROM billing_intents WHERE id=?", [
      intentId,
    ]);
    const now = Math.floor(Date.now() / 1000);
    invoice = {
      kind: "PAID",
      intentId,
      paymentId: `in_${randomUUID()}`,
      paymentIntentId: `pi_${randomUUID()}`,
      cents: Number(quote.cents),
      currency: "usd",
      subscriptionId: subId,
      start: now - 10,
      end: now + 30 * 86400,
    };
    await expect(deliver({ ...invoice, cents: 1 })).rejects.toMatchObject({
      status: 400,
    });
    expect(
      await rows("SELECT id FROM billing_payments WHERE intent_id=?", [
        intentId,
      ]),
    ).toHaveLength(0);
    await expect(
      deliver({ ...invoice, subscriptionId: "sub_unavailable_fixture" }),
    ).rejects.toThrow("Unknown subscription");
    expect(
      await rows("SELECT id FROM billing_payments WHERE intent_id=?", [
        intentId,
      ]),
    ).toHaveLength(0);
    const e = external.event(invoice);
    await Promise.all([
      service.webhook(e.raw, e.signature),
      service.webhook(e.raw, e.signature),
    ]);
    await deliver(invoice); // Different event ID, same invoice/payment ID.
    const memberships = await rows(
      "SELECT * FROM memberships WHERE user_id=?",
      [reader],
    );
    expect(memberships).toHaveLength(1);
    expect(memberships[0].status).toBe("ACTIVE");
    expect(
      await rows("SELECT id FROM billing_payments WHERE intent_id=?", [
        intentId,
      ]),
    ).toHaveLength(1);
    expect((await service.checkoutStatus(reader, intentId)).state).toBe("PAID");
  });
  it("preserves price snapshots and absolute renewal periods despite duplicate old invoices", async () => {
    if (invoice.kind !== "PAID") throw new Error();
    const renewal = {
      ...invoice,
      paymentId: `in_${randomUUID()}`,
      paymentIntentId: `pi_${randomUUID()}`,
      start: invoice.end!,
      end: invoice.end! + 30 * 86400,
    };
    await deliver(renewal);
    await deliver(invoice);
    const [member] = await rows(
      "SELECT UNIX_TIMESTAMP(current_period_end) AS end FROM memberships WHERE user_id=?",
      [reader],
    );
    expect(Number(member.end)).toBe(renewal.end);
    expect(
      await rows("SELECT id FROM billing_payments WHERE intent_id=?", [
        intentId,
      ]),
    ).toHaveLength(2);
  });
  it("handles partial/full refunds idempotently without revoking a later unrefunded period", async () => {
    if (invoice.kind !== "PAID") throw new Error();
    const update = {
      kind: "REFUND" as const,
      paymentIntentId: invoice.paymentIntentId,
      currency: "usd",
      refundedCents: invoice.cents,
    };
    await deliver({ ...update, refundedCents: 100 });
    await deliver(update);
    await deliver(update);
    await deliver({ ...update, refundedCents: 100 });
    const [payment] = await rows(
      "SELECT * FROM billing_payments WHERE payment_intent_id=?",
      [invoice.paymentIntentId],
    );
    expect(Number(payment.refunded_cents)).toBe(invoice.cents);
    expect(payment.platform_cents).toBe(0);
    expect(payment.author_cents).toBe(0);
    const adjustments = await rows(
      "SELECT delta_cents FROM billing_refund_adjustments WHERE payment_id=?",
      [payment.id],
    );
    expect(adjustments).toHaveLength(2);
    expect(
      adjustments.reduce((sum, row) => sum + Number(row.delta_cents), 0),
    ).toBe(invoice.cents);
    const [member] = await rows(
      "SELECT status FROM memberships WHERE user_id=?",
      [reader],
    );
    expect(member.status).toBe("ACTIVE");
    // A future paid renewal remains valid evidence, but cannot bridge a fully refunded current period.
    const access = await import("../src/models/repositories/membership.repo");
    expect(await access.getActiveMemberships(reader, authorId)).toHaveLength(0);
    expect(
      (
        await (
          await import("../src/services/membership.service")
        ).myMemberships(reader)
      ).items[0].hasAccess,
    ).toBe(false);
    const [latest] = await rows(
      "SELECT payment_intent_id,gross_cents FROM billing_payments WHERE intent_id=? ORDER BY period_end DESC LIMIT 1",
      [intentId],
    );
    await pool.query(
      "UPDATE billing_payments SET period_start=DATE_SUB(NOW(),INTERVAL 5 SECOND) WHERE payment_intent_id=?",
      [latest.payment_intent_id],
    );
    expect(await access.getActiveMemberships(reader, authorId)).toHaveLength(1);
    await deliver({
      kind: "REFUND",
      paymentIntentId: latest.payment_intent_id,
      currency: "usd",
      refundedCents: Number(latest.gross_cents),
    });
    expect(
      (
        await rows("SELECT status FROM memberships WHERE user_id=?", [reader])
      )[0].status,
    ).toBe("EXPIRED");
  });
  it("enforces current provider cancellation/past-due state and cancellation ownership", async () => {
    const [member] = await rows("SELECT id FROM memberships WHERE user_id=?", [
      reader,
    ]);
    await expect(service.cancel(outsider, member.id)).rejects.toMatchObject({
      status: 404,
    });
    await service.cancel(reader, member.id);
    expect(
      (
        await rows("SELECT auto_renew FROM memberships WHERE id=?", [member.id])
      )[0].auto_renew,
    ).toBe(0);
    external.subscriptions.get(subId)!.status = "past_due";
    await deliver({ kind: "SUBSCRIPTION", intentId, subscriptionId: subId });
    expect(
      (await rows("SELECT status FROM memberships WHERE id=?", [member.id]))[0]
        .status,
    ).toBe("PAST_DUE");
    external.subscriptions.get(subId)!.status = "canceled";
    await deliver(invoice);
    expect(
      (await rows("SELECT status FROM memberships WHERE id=?", [member.id]))[0]
        .status,
    ).toBe("CANCELED");
  });
  it("records donation splits once, updates both histories and never grants a membership", async () => {
    const donation = await service.checkout(outsider, {
      kind: "DONATION",
      authorId,
      amountCents: 1234,
      requestId: randomUUID(),
    });
    const update = {
      kind: "PAID" as const,
      intentId: donation.id,
      paymentId: `cs_${donation.id}`,
      paymentIntentId: `pi_${randomUUID()}`,
      cents: 1234,
      currency: "usd",
    };
    await deliver(update);
    await deliver(update);
    const history = await service.history(outsider);
    expect(history.items).toHaveLength(1);
    expect(Number(history.totals.donationCents)).toBe(1234);
    const p = history.items[0];
    expect(p.platformCents + p.authorCents).toBe(1234);
    expect(
      await rows("SELECT id FROM memberships WHERE user_id=?", [outsider]),
    ).toHaveLength(0);
    const income = await service.history(authorUser, undefined, true);
    expect(income.items.some((p) => p.checkoutId === donation.id)).toBe(true);
    await deliver({
      kind: "REFUND",
      paymentIntentId: update.paymentIntentId,
      currency: "usd",
      refundedCents: 234,
    });
    expect(Number((await service.history(outsider)).totals.donationCents)).toBe(
      1000,
    );
    await expect(
      deliver({
        kind: "REFUND",
        paymentIntentId: "pi_not_recorded",
        currency: "usd",
        refundedCents: 100,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("recovers an ambiguous checkout using the same persisted intent and rejects an expired replay", async () => {
    const body = {
      kind: "DONATION",
      authorId,
      amountCents: 555,
      requestId: randomUUID(),
    };
    external.failNextCheckout();
    await expect(service.checkout(outsider, body)).rejects.toThrow(
      "Simulated ambiguous provider timeout",
    );
    const [intent] = await rows(
      "SELECT id FROM billing_intents WHERE user_id=? AND request_id=?",
      [outsider, body.requestId],
    );
    const recovered = await service.checkout(outsider, body);
    expect(recovered.id).toBe(intent.id);
    expect(
      await rows(
        "SELECT id FROM billing_intents WHERE user_id=? AND request_id=?",
        [outsider, body.requestId],
      ),
    ).toHaveLength(1);
    await pool.query(
      "UPDATE billing_intents SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE id=?",
      [intent.id],
    );
    await expect(service.checkout(outsider, body)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("keeps history, checkout status, cancellation and reconciliation behind real authentication and roles", async () => {
    expect(
      (await request(app).post("/v1/api/payments/checkout").send({})).status,
    ).toBe(401);
    const pair = await sessions.issueSession(reader);
    const headers = {
      "x-client-id": String(reader),
      Authorization: `Bearer ${pair.accessToken}`,
    };
    expect(
      (
        await request(app)
          .get("/v1/api/admin/payments/reconciliation")
          .set(headers)
      ).status,
    ).toBe(403);
    expect(
      (await request(app).get("/v1/api/payments/me").set(headers)).status,
    ).toBe(200);
    const admin = await seedUser("ADMIN"),
      adminPair = await sessions.issueSession(admin);
    const report = await request(app)
      .get("/v1/api/admin/payments/reconciliation")
      .set({
        "x-client-id": String(admin),
        Authorization: `Bearer ${adminPair.accessToken}`,
      });
    expect(report.status).toBe(200);
    expect(report.body.metadata.currency).toBe("USD");
    const totals = report.body.metadata.totals;
    expect(Number(totals.grossCents) - Number(totals.refundedCents)).toBe(
      Number(totals.platformCents) + Number(totals.authorCents),
    );
  });
});
