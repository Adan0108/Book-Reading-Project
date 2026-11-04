import Stripe from "stripe";
import { BadRequestError, ErrorResponse } from "../core/error.response";
import type {
  CheckoutQuote,
  PaymentProvider,
  PaymentUpdate,
  VerifiedPaymentEvent,
} from "./provider";

function reference(value: string | { id: string } | null | undefined): string {
  return typeof value === "string" ? value : (value?.id ?? "");
}
export class StripeProvider implements PaymentProvider {
  readonly name = "STRIPE" as const;
  private readonly client: Stripe;
  constructor(
    secret: string,
    private readonly webhookSecret: string,
    client?: Stripe,
  ) {
    if (!secret.startsWith("sk_test_") || !webhookSecret.startsWith("whsec_"))
      throw new ErrorResponse(
        "Stripe sandbox configuration is unavailable",
        503,
      );
    // The pinned SDK and webhook endpoint must use this same version.
    this.client =
      client ??
      new Stripe(secret, {
        apiVersion: "2026-10-28.endive",
        timeout: 10000,
        maxNetworkRetries: 1,
      });
  }
  async createCheckout(quote: CheckoutQuote) {
    const recurring = quote.kind === "MEMBERSHIP";
    const metadata = { hibook_intent: quote.id };
    const session = await this.client.checkout.sessions.create(
      {
        mode: recurring ? "subscription" : "payment",
        allowed_payment_method_types: ["card"],
        client_reference_id: quote.id,
        metadata,
        ...(recurring
          ? { subscription_data: { metadata } }
          : { payment_intent_data: { metadata } }),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: quote.cents,
              product_data: { name: quote.label },
              ...(recurring
                ? { recurring: { interval: "month" as const } }
                : {}),
            },
          },
        ],
        expires_at: quote.expiresAt,
        success_url: `${quote.returnUrl}?checkout=${quote.id}`,
        cancel_url: `${quote.returnUrl}?checkout=${quote.id}&canceled=1`,
      },
      { idempotencyKey: `hibook-checkout-${quote.id}` },
    );
    if (
      !session.url ||
      !session.url.startsWith("https://checkout.stripe.com/") ||
      session.livemode
    )
      throw new ErrorResponse("Sandbox checkout unavailable", 503);
    return { id: session.id, url: session.url };
  }
  verifyEvent(raw: Buffer, signature: string): VerifiedPaymentEvent {
    try {
      const event = this.client.webhooks.constructEvent(
        raw,
        signature,
        this.webhookSecret,
        300,
      );
      if (event.livemode) throw new Error("Live events are disabled");
      const object = event.data.object;
      const objectId =
        "id" in object && typeof object.id === "string" ? object.id : "";
      return { id: event.id, type: event.type, objectId, live: false };
    } catch {
      throw new BadRequestError("Invalid Stripe webhook signature or mode");
    }
  }
  async subscription(id: string) {
    const s = await this.client.subscriptions.retrieve(id);
    if (s.livemode) throw new BadRequestError("Live billing is disabled");
    return {
      id: s.id,
      intentId: s.metadata.hibook_intent ?? "",
      status: s.status,
      autoRenew:
        !s.cancel_at_period_end && !s.cancel_at && s.status !== "canceled",
    };
  }
  async cancelRenewal(id: string) {
    const current = await this.subscription(id);
    if (current.status !== "canceled")
      await this.client.subscriptions.update(
        id,
        { cancel_at_period_end: true },
        { idempotencyKey: `hibook-cancel-${id}` },
      );
    return this.subscription(id);
  }
  async resolveEvent(event: VerifiedPaymentEvent): Promise<PaymentUpdate> {
    if (event.type.startsWith("customer.subscription.")) {
      const s = await this.subscription(event.objectId);
      return s.intentId
        ? { kind: "SUBSCRIPTION", intentId: s.intentId, subscriptionId: s.id }
        : { kind: "IGNORE" };
    }
    if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_failed"
    ) {
      const invoice = await this.client.invoices.retrieve(event.objectId, {
        expand: ["payments"],
      });
      const subId = reference(
        invoice.parent?.subscription_details?.subscription,
      );
      if (!subId) return { kind: "IGNORE" };
      const s = await this.subscription(subId);
      if (!s.intentId) return { kind: "IGNORE" };
      if (event.type !== "invoice.paid" || invoice.status !== "paid")
        return {
          kind: "SUBSCRIPTION",
          intentId: s.intentId,
          subscriptionId: s.id,
        };
      // One fixed-price monthly item: no trials, coupons, prorations or externally edited invoices.
      const lines = invoice.lines.data;
      const payments =
        invoice.payments?.data.filter((p) => p.status === "paid") ?? [];
      if (
        invoice.livemode ||
        lines.length !== 1 ||
        invoice.lines.has_more ||
        lines[0].quantity !== 1 ||
        payments.length !== 1 ||
        invoice.payments?.has_more ||
        invoice.amount_paid !== invoice.total ||
        Boolean(invoice.discounts?.length) ||
        Boolean(invoice.total_taxes?.length) ||
        Boolean(lines[0].discounts?.length) ||
        Boolean(lines[0].parent?.subscription_item_details?.proration) ||
        !["subscription_create", "subscription_cycle"].includes(
          invoice.billing_reason ?? "",
        )
      )
        throw new BadRequestError("Invoice needs manual reconciliation");
      const pi = reference(payments[0].payment.payment_intent);
      if (!pi) throw new BadRequestError("Unsupported invoice payment method");
      return {
        kind: "PAID",
        intentId: s.intentId,
        subscriptionId: subId,
        paymentId: invoice.id,
        paymentIntentId: pi,
        cents: invoice.amount_paid,
        currency: invoice.currency,
        start: lines[0].period.start,
        end: lines[0].period.end,
      };
    }
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = await this.client.checkout.sessions.retrieve(
        event.objectId,
      );
      if (session.livemode)
        throw new BadRequestError("Live billing is disabled");
      // Subscription access is granted only from a validated paid invoice.
      if (
        session.mode !== "payment" ||
        session.payment_status !== "paid" ||
        !session.metadata?.hibook_intent
      )
        return { kind: "IGNORE" };
      return {
        kind: "PAID",
        intentId: session.metadata.hibook_intent,
        paymentId: session.id,
        paymentIntentId: reference(session.payment_intent),
        cents: session.amount_total ?? 0,
        currency: session.currency ?? "",
      };
    }
    if (event.type === "charge.refunded") {
      // Cumulative provider amount makes partial refunds and differently identified duplicate events idempotent.
      const charge = await this.client.charges.retrieve(event.objectId);
      if (charge.livemode)
        throw new BadRequestError("Live billing is disabled");
      return {
        kind: "REFUND",
        paymentIntentId: reference(charge.payment_intent),
        refundedCents: charge.amount_refunded,
        currency: charge.currency,
      };
    }
    return { kind: "IGNORE" };
  }
}
export function configuredPaymentProvider(): PaymentProvider | undefined {
  const secret = process.env.STRIPE_SECRET_KEY,
    webhook = process.env.STRIPE_WEBHOOK_SECRET;
  return secret && webhook ? new StripeProvider(secret, webhook) : undefined;
}
