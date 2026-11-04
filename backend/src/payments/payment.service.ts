import { createHash, randomUUID } from "node:crypto";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { pool } from "../dbs/init.mysql";
import { withTransaction } from "../dbs/transaction";
import {
  BadRequestError,
  ConflictRequestError,
  ErrorResponse,
  NotFoundError,
} from "../core/error.response";
import { integerRange, positiveId } from "../domain/validation";
import {
  getMembershipPolicy,
  listAuthorTiers,
  ownedAuthor,
} from "../services/membership.service";
import { findAvailableAuthor } from "../models/repositories/membership.repo";
import type { PaymentProvider, SubscriptionSnapshot } from "./provider";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function unavailable(): never {
  throw new ErrorResponse("Sandbox billing is not configured", 503);
}
function money(value: number, expected: number, currency: string) {
  if (
    !Number.isSafeInteger(value) ||
    value !== expected ||
    currency.toUpperCase() !== "USD"
  )
    throw new BadRequestError(
      "Payment amount or currency does not match its quote",
    );
}
function status(snapshot: SubscriptionSnapshot, paid: boolean) {
  if (snapshot.status === "active") return paid ? "ACTIVE" : "EXPIRED";
  if (["past_due", "unpaid", "incomplete", "paused"].includes(snapshot.status))
    return "PAST_DUE";
  return "CANCELED";
}

/** Small application service with a provider boundary; MySQL is authoritative for money and grants. */
export function createPaymentService(provider?: PaymentProvider) {
  async function refreshSubscription(
    db: PoolConnection,
    intent: RowDataPacket,
    subId: string,
  ) {
    if (!provider) return unavailable();
    // Deliberately inside the intent lock: concurrent old notifications cannot overwrite a newer provider snapshot.
    // Bounded provider timeouts limit this low-volume MVP trade-off; there is no asynchronous event bus.
    const snapshot = await provider.subscription(subId);
    if (
      snapshot.id !== subId ||
      snapshot.intentId !== intent.id ||
      intent.kind !== "MEMBERSHIP"
    )
      throw new BadRequestError("Subscription quote mismatch");
    const [bindings] = await db.query<RowDataPacket[]>(
      "SELECT * FROM billing_subscriptions WHERE intent_id=?",
      [intent.id],
    );
    const binding = bindings[0];
    if (binding && binding.provider_sub_id !== subId)
      throw new ConflictRequestError("Subscription identity changed");
    const [periods] = await db.query<RowDataPacket[]>(
      "SELECT UNIX_TIMESTAMP(period_start) AS start,UNIX_TIMESTAMP(period_end) AS end FROM billing_payments WHERE intent_id=? AND refunded_cents<gross_cents AND period_end IS NOT NULL ORDER BY period_end DESC,id DESC LIMIT 1",
      [intent.id],
    );
    const period = periods[0];
    let membershipId = binding?.membership_id;
    const memberStatus = status(snapshot, Boolean(period));
    if (period && !membershipId) {
      const [created] = await db.query<ResultSetHeader>(
        "INSERT INTO memberships(user_id,author_id,tier_id,status,started_at,current_period_end,auto_renew,provider,provider_sub_id,last_payment_at) VALUES (?,?,?,?,FROM_UNIXTIME(?),FROM_UNIXTIME(?),?,'STRIPE',?,NOW())",
        [
          intent.user_id,
          intent.author_id,
          intent.tier_id,
          memberStatus,
          period.start,
          period.end,
          Number(snapshot.autoRenew),
          subId,
        ],
      );
      membershipId = created.insertId;
    } else if (membershipId) {
      await db.query(
        "UPDATE memberships SET status=?,current_period_end=IF(? IS NULL,NOW(),FROM_UNIXTIME(?)),auto_renew=?,last_payment_at=IF(? IS NULL,last_payment_at,NOW()) WHERE id=?",
        [
          memberStatus,
          period?.end ?? null,
          period?.end ?? null,
          Number(snapshot.autoRenew),
          period?.end ?? null,
          membershipId,
        ],
      );
    }
    if (binding)
      await db.query(
        "UPDATE billing_subscriptions SET membership_id=?,provider_status=?,auto_renew=? WHERE intent_id=?",
        [
          membershipId ?? null,
          snapshot.status,
          Number(snapshot.autoRenew),
          intent.id,
        ],
      );
    else
      await db.query(
        "INSERT INTO billing_subscriptions(provider_sub_id,intent_id,membership_id,provider_status,auto_renew) VALUES (?,?,?,?,?)",
        [
          subId,
          intent.id,
          membershipId ?? null,
          snapshot.status,
          Number(snapshot.autoRenew),
        ],
      );
    return snapshot;
  }
  return {
    configuration() {
      return {
        configured: Boolean(provider),
        provider: "STRIPE",
        mode: provider?.fixture ? "fixture" : "sandbox",
        currency: "USD",
      };
    },
    async checkout(userId: number, body: Record<string, unknown>) {
      if (!provider) return unavailable();
      if (typeof body.requestId !== "string" || !uuid.test(body.requestId))
        throw new BadRequestError("A stable UUID v4 requestId is required");
      if (body.kind !== "MEMBERSHIP" && body.kind !== "DONATION")
        throw new BadRequestError("Invalid checkout kind");
      const authorId = positiveId(body.authorId, "author"),
        tierId =
          body.kind === "MEMBERSHIP" ? positiveId(body.tierId, "tier") : null,
        donation =
          body.kind === "DONATION"
            ? integerRange(body.amountCents, "Donation cents", 100, 100000)
            : null;
      if (
        body.price !== undefined ||
        body.priceCents !== undefined ||
        (body.currency !== undefined && body.currency !== "USD")
      )
        throw new BadRequestError("Pricing is controlled by the server");
      const payloadHash = createHash("sha256")
        .update(JSON.stringify([body.kind, authorId, tierId, donation]))
        .digest("hex");
      const intent = await withTransaction(async (db) => {
        const [users] = await db.query<RowDataPacket[]>(
          "SELECT id FROM users WHERE id=? AND state=1 FOR UPDATE",
          [userId],
        );
        if (!users.length) throw new NotFoundError("Account unavailable");
        const [replays] = await db.query<RowDataPacket[]>(
          "SELECT *,UNIX_TIMESTAMP(expires_at) AS expiresEpoch,(expires_at>NOW()) AS valid FROM billing_intents WHERE user_id=? AND request_id=?",
          [userId, body.requestId],
        );
        if (replays[0]) {
          if (replays[0].payload_hash !== payloadHash)
            throw new ConflictRequestError(
              "Checkout requestId was reused with different content",
            );
          if (!replays[0].valid)
            throw new ConflictRequestError(
              "Checkout expired. Start a new checkout.",
            );
          return replays[0];
        }
        const author = await findAvailableAuthor(authorId, db);
        if (!author || Number(author.user_id) === userId)
          throw new BadRequestError("Choose another available author");
        const [quota] = await db.query<RowDataPacket[]>(
          "SELECT SUM(created_at>DATE_SUB(NOW(),INTERVAL 1 MINUTE)) AS recent,COUNT(*) AS daily FROM billing_intents WHERE user_id=? AND created_at>DATE_SUB(NOW(),INTERVAL 1 DAY)",
          [userId],
        );
        if (Number(quota[0].recent) >= 10 || Number(quota[0].daily) >= 100)
          throw new ErrorResponse(
            "Too many checkout attempts. Try again later.",
            429,
          );
        const policy = await getMembershipPolicy(db);
        let cents = donation!,
          label = `Donation to ${author.pen_name || "author"}`;
        if (tierId) {
          const tier = (await listAuthorTiers(authorId, false, db)).find(
            (t) => t.id === tierId && t.available,
          );
          if (!tier)
            throw new BadRequestError("This membership plan is unavailable");
          cents = tier.priceCents;
          label = `${tier.name} membership`;
          const [open] = await db.query<RowDataPacket[]>(
            `SELECT id FROM billing_intents i WHERE i.user_id=? AND i.author_id=? AND i.kind='MEMBERSHIP' AND
            ((i.expires_at>NOW() AND i.completed_at IS NULL) OR EXISTS(SELECT 1 FROM billing_subscriptions s WHERE s.intent_id=i.id AND s.provider_status NOT IN ('canceled','incomplete_expired')))
            LIMIT 1`,
            [userId, authorId],
          );
          if (open.length)
            throw new ConflictRequestError(
              "An author subscription or checkout already exists. Manage it before starting another.",
            );
        }
        const id = randomUUID();
        await db.query(
          "INSERT INTO billing_intents(id,user_id,author_id,tier_id,request_id,payload_hash,kind,cents,currency,policy_version,share_bps,label,expires_at) VALUES (?,?,?,?,?,?,?,?,'USD',?,?,?,DATE_ADD(NOW(),INTERVAL 1 HOUR))",
          [
            id,
            userId,
            authorId,
            tierId,
            body.requestId,
            payloadHash,
            body.kind,
            cents,
            policy.version,
            policy.revenueShareBps,
            label,
          ],
        );
        const [created] = await db.query<RowDataPacket[]>(
          "SELECT *,UNIX_TIMESTAMP(expires_at) AS expiresEpoch FROM billing_intents WHERE id=?",
          [id],
        );
        return created[0];
      });
      if (!intent.checkout_url) {
        const frontend = process.env.FRONTEND_URL ?? "http://localhost:8000";
        const session = await provider.createCheckout({
          id: intent.id,
          kind: intent.kind,
          cents: Number(intent.cents),
          currency: "USD",
          label: intent.label,
          expiresAt: Number(intent.expiresEpoch),
          returnUrl: `${frontend.replace(/\/$/, "")}/account/payments`,
        });
        await pool.query(
          "UPDATE billing_intents SET checkout_id=?,checkout_url=? WHERE id=? AND checkout_id IS NULL",
          [session.id, session.url, intent.id],
        );
        return {
          id: intent.id,
          url: session.url,
          mode: provider.fixture ? "fixture" : "sandbox",
        };
      }
      return {
        id: intent.id,
        url: intent.checkout_url,
        mode: provider.fixture ? "fixture" : "sandbox",
      };
    },
    async webhook(raw: Buffer, signature: string) {
      if (!provider) return unavailable();
      const event = provider.verifyEvent(raw, signature);
      if (event.live) throw new BadRequestError("Live payments are disabled");
      const [seen] = await pool.query<RowDataPacket[]>(
        "SELECT event_id FROM billing_events WHERE event_id=?",
        [event.id],
      );
      if (seen.length) return { received: true, duplicate: true };
      const update = await provider.resolveEvent(event);
      return withTransaction(async (db) => {
        let intent: RowDataPacket | undefined;
        if (update.kind !== "IGNORE") {
          if (update.kind === "REFUND") {
            const [payments] = await db.query<RowDataPacket[]>(
              "SELECT intent_id FROM billing_payments WHERE payment_intent_id=?",
              [update.paymentIntentId],
            );
            if (!payments[0])
              throw new ErrorResponse(
                "Refund payment is not recorded yet; retry delivery",
                503,
              );
            const [rows] = await db.query<RowDataPacket[]>(
              "SELECT * FROM billing_intents WHERE id=? FOR UPDATE",
              [payments[0].intent_id],
            );
            intent = rows[0];
          } else {
            const [rows] = await db.query<RowDataPacket[]>(
              "SELECT * FROM billing_intents WHERE id=? FOR UPDATE",
              [update.intentId],
            );
            intent = rows[0];
          }
          if (!intent) throw new NotFoundError("Payment quote unavailable");
        }
        const [duplicates] = await db.query<RowDataPacket[]>(
          "SELECT event_id FROM billing_events WHERE event_id=?",
          [event.id],
        );
        if (duplicates.length) return { received: true, duplicate: true };
        if (update.kind === "PAID" && intent) {
          money(update.cents, Number(intent.cents), update.currency);
          if (
            !update.paymentId ||
            !update.paymentIntentId ||
            (intent.kind === "MEMBERSHIP") !== Boolean(update.subscriptionId)
          )
            throw new BadRequestError("Payment identity or purpose mismatch");
          if (
            update.subscriptionId &&
            (!Number.isSafeInteger(update.start) ||
              !Number.isSafeInteger(update.end) ||
              update.start! >= update.end! ||
              update.end! - update.start! > 370 * 86400)
          )
            throw new BadRequestError("Invalid paid period");
          const [existing] = await db.query<RowDataPacket[]>(
            "SELECT * FROM billing_payments WHERE provider_payment_id=? OR payment_intent_id=?",
            [update.paymentId, update.paymentIntentId],
          );
          if (
            existing.length &&
            (existing[0].intent_id !== intent.id ||
              existing[0].provider_payment_id !== update.paymentId ||
              existing[0].payment_intent_id !== update.paymentIntentId)
          )
            throw new ConflictRequestError(
              "Payment identity already belongs to another quote",
            );
          if (!existing.length) {
            const cut = Math.floor(
              (update.cents * Number(intent.share_bps)) / 10000,
            );
            await db.query(
              "INSERT INTO billing_payments(intent_id,provider_payment_id,payment_intent_id,gross_cents,platform_cents,author_cents,currency,period_start,period_end) VALUES (?,?,?,?,?,?,'USD',FROM_UNIXTIME(?),FROM_UNIXTIME(?))",
              [
                intent.id,
                update.paymentId,
                update.paymentIntentId,
                update.cents,
                cut,
                update.cents - cut,
                update.start ?? null,
                update.end ?? null,
              ],
            );
          }
          await db.query(
            "UPDATE billing_intents SET completed_at=COALESCE(completed_at,NOW()) WHERE id=?",
            [intent.id],
          );
          if (update.subscriptionId)
            await refreshSubscription(db, intent, update.subscriptionId);
        } else if (update.kind === "SUBSCRIPTION" && intent) {
          await refreshSubscription(db, intent, update.subscriptionId);
        } else if (update.kind === "REFUND" && intent) {
          const [payments] = await db.query<RowDataPacket[]>(
            "SELECT * FROM billing_payments WHERE payment_intent_id=? FOR UPDATE",
            [update.paymentIntentId],
          );
          const p = payments[0];
          integerRange(
            update.refundedCents,
            "Refund cents",
            0,
            Number(p.gross_cents),
          );
          if (update.currency.toUpperCase() !== p.currency)
            throw new BadRequestError("Refund currency mismatch");
          if (update.refundedCents > Number(p.refunded_cents)) {
            await db.query(
              "INSERT INTO billing_refund_adjustments(payment_id,provider_event_id,delta_cents,cumulative_cents) VALUES (?,?,?,?)",
              [
                p.id,
                event.id,
                update.refundedCents - Number(p.refunded_cents),
                update.refundedCents,
              ],
            );
            const net = Number(p.gross_cents) - update.refundedCents,
              cut = Math.floor((net * Number(intent.share_bps)) / 10000);
            await db.query(
              "UPDATE billing_payments SET refunded_cents=?,platform_cents=?,author_cents=? WHERE id=?",
              [update.refundedCents, cut, net - cut, p.id],
            );
          }
          const [bindings] = await db.query<RowDataPacket[]>(
            "SELECT provider_sub_id FROM billing_subscriptions WHERE intent_id=?",
            [intent.id],
          );
          if (bindings[0])
            await refreshSubscription(db, intent, bindings[0].provider_sub_id);
        }
        await db.query(
          "INSERT INTO billing_events(event_id,event_type,intent_id,result) VALUES (?,?,?,?)",
          [event.id, event.type, intent?.id ?? null, update.kind],
        );
        return { received: true, duplicate: false };
      }).catch(async (e: { code?: string }) => {
        if (e.code === "ER_DUP_ENTRY") {
          const [committed] = await pool.query<RowDataPacket[]>(
            "SELECT event_id FROM billing_events WHERE event_id=?",
            [event.id],
          );
          if (committed.length) return { received: true, duplicate: true };
        }
        throw e;
      });
    },
    async cancel(userId: number, value: unknown) {
      if (!provider) return unavailable();
      const id = positiveId(value, "membership");
      const [bindings] = await pool.query<RowDataPacket[]>(
        "SELECT s.provider_sub_id,s.intent_id FROM billing_subscriptions s JOIN memberships m ON m.id=s.membership_id WHERE m.id=? AND m.user_id=?",
        [id, userId],
      );
      if (!bindings[0])
        throw new NotFoundError("Billing membership unavailable");
      const canceled = await provider.cancelRenewal(
        bindings[0].provider_sub_id,
      );
      if (canceled.autoRenew)
        throw new ErrorResponse(
          "Cancellation is not confirmed. Try again later.",
          503,
        );
      return withTransaction(async (db) => {
        const [intents] = await db.query<RowDataPacket[]>(
          "SELECT * FROM billing_intents WHERE id=? FOR UPDATE",
          [bindings[0].intent_id],
        );
        const current = await refreshSubscription(
          db,
          intents[0],
          bindings[0].provider_sub_id,
        );
        if (current.autoRenew)
          throw new ConflictRequestError(
            "Renewal changed again. Reload billing status.",
          );
        return { id, autoRenew: false };
      });
    },
    async history(userId: number, cursorValue?: unknown, author = false) {
      const owner = author ? Number((await ownedAuthor(userId)).id) : userId;
      const cursor =
        cursorValue === undefined
          ? Number.MAX_SAFE_INTEGER
          : positiveId(cursorValue, "cursor");
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT p.id,i.id AS checkoutId,i.kind,i.author_id AS authorId,a.pen_name AS authorName,p.gross_cents AS grossCents,p.refunded_cents AS refundedCents,p.platform_cents AS platformCents,p.author_cents AS authorCents,p.currency,UNIX_TIMESTAMP(p.created_at) AS createdEpoch
        FROM billing_payments p JOIN billing_intents i ON i.id=p.intent_id JOIN authors a ON a.id=i.author_id WHERE i.${author ? "author_id" : "user_id"}=? AND p.id<? ORDER BY p.id DESC LIMIT 51`,
        [owner, cursor],
      );
      const [totals] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(p.gross_cents-p.refunded_cents),0) AS netCents,COALESCE(SUM(p.author_cents),0) AS authorCents,COALESCE(SUM(IF(i.kind='DONATION',p.gross_cents-p.refunded_cents,0)),0) AS donationCents FROM billing_payments p JOIN billing_intents i ON i.id=p.intent_id WHERE i.${author ? "author_id" : "user_id"}=?`,
        [owner],
      );
      return {
        items: rows.slice(0, 50).map((r) => ({
          ...r,
          createdAt: new Date(Number(r.createdEpoch) * 1000).toISOString(),
        })),
        totals: totals[0],
        nextCursor: rows.length > 50 ? Number(rows[49].id) : null,
      };
    },
    async checkoutStatus(userId: number, id: string) {
      if (!uuid.test(id)) throw new BadRequestError("Invalid checkout ID");
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT i.id,i.kind,(i.completed_at IS NOT NULL) AS paid,(i.expires_at<=NOW()) AS expired,(SELECT COALESCE(SUM(refunded_cents),0) FROM billing_payments p WHERE p.intent_id=i.id) AS refunded,(SELECT COALESCE(SUM(gross_cents),0) FROM billing_payments p WHERE p.intent_id=i.id) AS gross FROM billing_intents i WHERE i.id=? AND i.user_id=?",
        [id, userId],
      );
      if (!rows[0]) throw new NotFoundError("Checkout unavailable");
      return {
        id,
        kind: rows[0].kind,
        state: rows[0].paid
          ? Number(rows[0].refunded) > 0
            ? Number(rows[0].refunded) === Number(rows[0].gross)
              ? "REFUNDED"
              : "PARTIALLY_REFUNDED"
            : "PAID"
          : rows[0].expired
            ? "EXPIRED"
            : "PENDING",
      };
    },
    async reconciliation() {
      const [totals] = await pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS payments,COALESCE(SUM(gross_cents),0) AS grossCents,COALESCE(SUM(refunded_cents),0) AS refundedCents,COALESCE(SUM(platform_cents),0) AS platformCents,COALESCE(SUM(author_cents),0) AS authorCents FROM billing_payments",
      );
      const [pending] = await pool.query<RowDataPacket[]>(
        "SELECT id,kind,checkout_id AS checkoutId,cents,currency,UNIX_TIMESTAMP(created_at) AS createdEpoch FROM billing_intents WHERE completed_at IS NULL AND expires_at<NOW() ORDER BY created_at,id LIMIT 100",
      );
      return {
        currency: "USD",
        mode: provider?.fixture ? "fixture" : "sandbox",
        totals: totals[0],
        unconfirmedExpired: pending,
        note: "Read-only reconciliation; expired quotes are not proof of a charge. Verify provider records before manual action. Author payouts and provider fees are not implemented.",
      };
    },
  };
}
export type PaymentService = ReturnType<typeof createPaymentService>;
