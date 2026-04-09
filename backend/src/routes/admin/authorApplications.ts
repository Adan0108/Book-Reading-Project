import { Router } from "express";
import asyncHandler from "../../helpers/asyncHandler";
import { authenticationV2 } from "../../auth/checkAuth";
import { requireRoles } from "../../auth/requireRoles";
import * as controller from "../../controllers/adminAuthorApplication.controller";

const router = Router();

router.use(authenticationV2);
router.use(requireRoles(["ADMIN"]));

router.get("/", asyncHandler(controller.list));
router.get("/:id", asyncHandler(controller.detail));
router.patch("/:id/mark-under-review", asyncHandler(controller.markUnderReview));
router.post("/:id/approve", asyncHandler(controller.approve));
router.post("/:id/reject", asyncHandler(controller.reject));

export default router;