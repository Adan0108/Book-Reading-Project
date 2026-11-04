import { Router } from "express";
import { authenticationV2 } from "../auth/checkAuth";
import { requireRoles } from "../auth/requireRoles";
import asyncHandler from "../helpers/asyncHandler";
import { OK } from "../core/success.response";
import * as moderation from "../services/moderation.service";
const router = Router();
router.post(
  "/reports",
  authenticationV2,
  asyncHandler(async (req, res) =>
    new OK(
      "Report received",
      await moderation.createReport(req.user!.uid, req.body ?? {}),
    ).send(res),
  ),
);
const admin = Router();
admin.use(authenticationV2, requireRoles(["ADMIN"]));
admin.get(
  "/dashboard",
  asyncHandler(async (_req, res) =>
    new OK("Dashboard", await moderation.dashboard()).send(res),
  ),
);
admin.get(
  "/users",
  asyncHandler(async (req, res) =>
    new OK("Accounts", await moderation.listUsers(req.query)).send(res),
  ),
);
admin.patch(
  "/users/:id/state",
  asyncHandler(async (req, res) =>
    new OK(
      "Account updated",
      await moderation.setAccountState(
        req.user!.uid,
        req.params.id,
        req.body ?? {},
      ),
    ).send(res),
  ),
);
admin.get(
  "/content",
  asyncHandler(async (req, res) =>
    new OK("Content", await moderation.listContent(req.query)).send(res),
  ),
);
admin.get(
  "/content/:kind/:id",
  asyncHandler(async (req, res) =>
    new OK(
      "Content review",
      await moderation.contentDetail(req.params.kind, req.params.id),
    ).send(res),
  ),
);
admin.patch(
  "/content/:kind/:id",
  asyncHandler(async (req, res) =>
    new OK(
      "Moderation saved",
      await moderation.setContentHidden(
        req.user!.uid,
        req.params.kind,
        req.params.id,
        req.body ?? {},
      ),
    ).send(res),
  ),
);
admin.get(
  "/reports",
  asyncHandler(async (req, res) =>
    new OK("Report queue", await moderation.listReports(req.query)).send(res),
  ),
);
admin.patch(
  "/reports/:id",
  asyncHandler(async (req, res) =>
    new OK(
      "Report reviewed",
      await moderation.reviewReport(
        req.user!.uid,
        req.params.id,
        req.body ?? {},
      ),
    ).send(res),
  ),
);
admin.get(
  "/moderation-policy",
  asyncHandler(async (_req, res) =>
    new OK("Moderation policy", await moderation.moderationPolicy()).send(res),
  ),
);
admin.put(
  "/moderation-policy",
  asyncHandler(async (req, res) =>
    new OK(
      "Settings saved",
      await moderation.saveModerationPolicy(req.user!.uid, req.body ?? {}),
    ).send(res),
  ),
);
admin.get(
  "/audit",
  asyncHandler(async (req, res) =>
    new OK(
      "Administrative audit",
      await moderation.auditHistory(req.query.cursor),
    ).send(res),
  ),
);
router.use("/admin", admin);
export default router;
