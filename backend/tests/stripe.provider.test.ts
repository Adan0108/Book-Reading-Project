import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import { StripeProvider } from "../src/payments/stripe.provider";

describe("Stripe sandbox adapter contract", () => {
  const secret = "whsec_nonfunctional_signature_fixture";
  function adapter(
    objects: Record<string, unknown>,
    requests: { url: string; body: string; headers: Headers }[] = [],
  ) {
    const client = new Stripe("sk_test_nonfunctional_fixture", {
      apiVersion: "2026-10-28.endive",
      maxNetworkRetries: 0,
      httpClient: Stripe.createFetchHttpClient(async (url, init) => {
        requests.push({
          url: String(url),
          body: String(init?.body ?? ""),
          headers: new Headers(init?.headers),
        });
        const key = new URL(String(url)).pathname;
        const object = objects[key];
        if (!object) throw new Error(`Unexpected provider request ${key}`);
        return new Response(JSON.stringify(object), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    });
    return new StripeProvider("sk_test_nonfunctional_fixture", secret, client);
  }
  it("sends fixed monthly prices, card-only sandbox checkout, metadata and stable provider idempotency", async () => {
    const requests: { url: string; body: string; headers: Headers }[] = [];
    const provider = adapter(
      {
        "/v1/checkout/sessions": {
          id: "cs_test_fixture",
          url: "https://checkout.stripe.com/c/pay/cs_test_fixture",
          livemode: false,
        },
      },
      requests,
    );
    await provider.createCheckout({
      id: "quote",
      kind: "MEMBERSHIP",
      cents: 1234,
      currency: "USD",
      label: "Readers",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      returnUrl: "http://localhost:8000/account/payments",
    });
    const body = new URLSearchParams(requests[0].body);
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("1234");
    expect(body.get("line_items[0][price_data][recurring][interval]")).toBe(
      "month",
    );
    expect(body.get("subscription_data[metadata][hibook_intent]")).toBe(
      "quote",
    );
    expect(body.get("allowed_payment_method_types[0]")).toBe("card");
    expect(requests[0].headers.get("Idempotency-Key")).toBe(
      "hibook-checkout-quote",
    );
    expect(requests[0].headers.get("Stripe-Version")).toBe("2026-10-28.endive");
  });
  it("uses paid invoice lines and invoice payments from the pinned current API", async () => {
    const provider = adapter({
      "/v1/subscriptions/sub_fixture": {
        id: "sub_fixture",
        status: "active",
        cancel_at_period_end: false,
        cancel_at: null,
        livemode: false,
        metadata: { hibook_intent: "quote" },
      },
      "/v1/invoices/in_fixture": {
        id: "in_fixture",
        parent: {
          type: "subscription_details",
          subscription_details: { subscription: "sub_fixture" },
        },
        status: "paid",
        livemode: false,
        billing_reason: "subscription_cycle",
        currency: "usd",
        amount_paid: 500,
        total: 500,
        lines: {
          data: [{ quantity: 1, period: { start: 100, end: 200 } }],
          has_more: false,
        },
        payments: {
          data: [
            {
              status: "paid",
              payment: { type: "payment_intent", payment_intent: "pi_fixture" },
            },
          ],
          has_more: false,
        },
      },
    });
    expect(
      await provider.resolveEvent({
        id: "evt_fixture",
        type: "invoice.paid",
        objectId: "in_fixture",
        live: false,
      }),
    ).toEqual({
      kind: "PAID",
      intentId: "quote",
      subscriptionId: "sub_fixture",
      paymentId: "in_fixture",
      paymentIntentId: "pi_fixture",
      cents: 500,
      currency: "usd",
      start: 100,
      end: 200,
    });
  });
  it("does not grant from a subscription checkout redirect or unpaid donation", async () => {
    const provider = adapter({
      "/v1/checkout/sessions/cs_fixture": {
        id: "cs_fixture",
        mode: "subscription",
        payment_status: "paid",
        livemode: false,
        metadata: { hibook_intent: "quote" },
      },
    });
    expect(
      await provider.resolveEvent({
        id: "evt_fixture",
        type: "checkout.session.completed",
        objectId: "cs_fixture",
        live: false,
      }),
    ).toEqual({ kind: "IGNORE" });
  });
  it("rejects live configuration and fresh valid signatures on live events", () => {
    expect(
      () => new StripeProvider("sk_live_nonfunctional_fixture", secret),
    ).toThrow();
    const provider = adapter({}),
      sdk = new Stripe("sk_test_nonfunctional_fixture");
    const raw = Buffer.from(
      JSON.stringify({
        id: "evt_live_fixture",
        type: "invoice.paid",
        livemode: true,
        data: { object: { id: "in_fixture" } },
      }),
    );
    const signature = sdk.webhooks.generateTestHeaderString({
      payload: raw.toString(),
      secret,
    });
    expect(() => provider.verifyEvent(raw, signature)).toThrow();
    const old = sdk.webhooks.generateTestHeaderString({
      payload: raw.toString(),
      secret,
      timestamp: 1,
    });
    expect(() => provider.verifyEvent(raw, old)).toThrow();
  });
});
