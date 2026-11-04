/** Provider-neutral application contracts. Card details never enter HiBook. */
export interface CheckoutQuote {
  id: string;
  kind: "MEMBERSHIP" | "DONATION";
  cents: number;
  currency: "USD";
  label: string;
  expiresAt: number;
  returnUrl: string;
}
export interface VerifiedPaymentEvent {
  id: string;
  type: string;
  objectId: string;
  live: boolean;
}
export interface SubscriptionSnapshot {
  id: string;
  intentId: string;
  status: string;
  autoRenew: boolean;
}
export type PaymentUpdate =
  | { kind: "IGNORE" }
  | { kind: "SUBSCRIPTION"; intentId: string; subscriptionId: string }
  | {
      kind: "PAID";
      intentId: string;
      paymentId: string;
      paymentIntentId: string;
      cents: number;
      currency: string;
      subscriptionId?: string;
      start?: number;
      end?: number;
    }
  | {
      kind: "REFUND";
      paymentIntentId: string;
      refundedCents: number;
      currency: string;
    };
export interface PaymentProvider {
  readonly name: "STRIPE";
  readonly fixture?: boolean;
  createCheckout(quote: CheckoutQuote): Promise<{ id: string; url: string }>;
  verifyEvent(raw: Buffer, signature: string): VerifiedPaymentEvent;
  resolveEvent(event: VerifiedPaymentEvent): Promise<PaymentUpdate>;
  subscription(id: string): Promise<SubscriptionSnapshot>;
  cancelRenewal(id: string): Promise<SubscriptionSnapshot>;
}
