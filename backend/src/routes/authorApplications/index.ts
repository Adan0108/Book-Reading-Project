import { Router } from "express";
import asyncHandler from "../../helpers/asyncHandler";
import { authenticationV2 } from "../../auth/checkAuth";
import * as controller from "../../controllers/authorApplication.controller";

const router = Router();

router.use(authenticationV2);

router.post("/", asyncHandler(controller.submit));
router.get("/me/latest", asyncHandler(controller.getMyLatest));
router.patch("/:id/withdraw", asyncHandler(controller.withdraw));

export default router;