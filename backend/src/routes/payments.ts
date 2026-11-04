import { Router, raw } from "express";
import type { PaymentService } from "../payments/payment.service";
import { authenticationV2 } from "../auth/checkAuth";
import { requireRoles } from "../auth/requireRoles";
import { OK } from "../core/success.response";
import asyncHandler from "../helpers/asyncHandler";
import { BadRequestError } from "../core/error.response";

/** Mounted before JSON parsing. Signature verification needs the original bytes. */
export function createWebhookRouter(service: PaymentService) {
  const router = Router();
  router.post(
    "/v1/api/payments/stripe/webhook",
    raw({ type: "application/json", limit: "256kb" }),
    asyncHandler(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      if (!Buffer.isBuffer(req.body))
        throw new BadRequestError("Raw JSON webhook body required");
      res.json(
        await service.webhook(req.body, req.get("stripe-signature") ?? ""),
      );
    }),
  );
  return router;
}
export function createPaymentRouter(service: PaymentService) {
  const router = Router();
  router.get("/payments/configuration", (_req, res) =>
    new OK("Billing configuration", service.configuration()).send(res),
  );
  router.post(
    "/payments/checkout",
    authenticationV2,
    asyncHandler(async (req, res) =>
      new OK(
        "Checkout",
        await service.checkout(req.user!.uid, req.body ?? {}),
      ).send(res),
    ),
  );
  router.get(
    "/payments/me",
    authenticationV2,
    asyncHandler(async (req, res) =>
      new OK(
        "Payment history",
        await service.history(req.user!.uid, req.query.cursor),
      ).send(res),
    ),
  );
  router.get(
    "/payments/checkout/:checkoutId",
    authenticationV2,
    asyncHandler(async (req, res) =>
      new OK(
        "Checkout status",
        await service.checkoutStatus(
          req.user!.uid,
          String(req.params.checkoutId),
        ),
      ).send(res),
    ),
  );
  router.post(
    "/payments/memberships/:membershipId/cancel",
    authenticationV2,
    asyncHandler(async (req, res) =>
      new OK(
        "Renewal canceled",
        await service.cancel(req.user!.uid, req.params.membershipId),
      ).send(res),
    ),
  );
  router.get(
    "/authors/me/payments",
    authenticationV2,
    requireRoles(["AUTHOR", "ADMIN"]),
    asyncHandler(async (req, res) =>
      new OK(
        "Author income",
        await service.history(req.user!.uid, req.query.cursor, true),
      ).send(res),
    ),
  );
  router.get(
    "/admin/payments/reconciliation",
    authenticationV2,
    requireRoles(["ADMIN"]),
    asyncHandler(async (_req, res) =>
      new OK("Billing reconciliation", await service.reconciliation()).send(
        res,
      ),
    ),
  );
  return router;
}
