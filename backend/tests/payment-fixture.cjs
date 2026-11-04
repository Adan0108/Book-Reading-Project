// Local test provider only. This file is never copied into dist or selected by production configuration.
const { randomBytes, randomUUID } = require("node:crypto");
const Stripe = require("stripe");
const { StripeProvider } = require("../dist/payments/stripe.provider");
function createFixtureProvider() {
  const signingSecret = `whsec_${randomBytes(32).toString("hex")}`;
  const verifier = new StripeProvider(
    "sk_test_hibook_nonfunctional_fixture",
    signingSecret,
  );
  const sessions = new Map(),
    updates = new Map(),
    subscriptions = new Map();
  const sdk = new Stripe("sk_test_hibook_nonfunctional_fixture");
  return {
    name: "STRIPE",
    fixture: true,
    sessions,
    subscriptions,
    async createCheckout(quote) {
      sessions.set(quote.id, quote);
      return {
        id: `cs_fixture_${quote.id}`,
        url: `http://localhost:3000/__qa/checkout/${quote.id}`,
      };
    },
    verifyEvent: (raw, signature) => verifier.verifyEvent(raw, signature),
    async resolveEvent(event) {
      const update = updates.get(event.objectId);
      if (!update) throw new Error("Unknown fixture event");
      return update;
    },
    async subscription(id) {
      const s = subscriptions.get(id);
      if (!s) throw new Error("Unknown fixture subscription");
      return { ...s };
    },
    async cancelRenewal(id) {
      const s = subscriptions.get(id);
      if (!s) throw new Error("Unknown fixture subscription");
      s.autoRenew = false;
      return { ...s };
    },
    event(
      update,
      type = "invoice.paid",
      eventId = `evt_fixture_${randomUUID()}`,
    ) {
      const objectId = `fixture_${randomUUID()}`;
      updates.set(objectId, update);
      const raw = Buffer.from(
        JSON.stringify({
          id: eventId,
          object: "event",
          type,
          livemode: false,
          created: Math.floor(Date.now() / 1000),
          data: { object: { id: objectId, object: "invoice" } },
        }),
      );
      return {
        raw,
        signature: sdk.webhooks.generateTestHeaderString({
          payload: raw.toString(),
          secret: signingSecret,
        }),
      };
    },
  };
}
module.exports = { createFixtureProvider };
