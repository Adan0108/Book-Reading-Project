import { Router } from "express";
import asyncHandler from "../../helpers/asyncHandler";
import userController from "../../controllers/user.controller";
import { authenticationV2  } from "../../auth/checkAuth";

const router = Router();

router.get("/me", authenticationV2 ,asyncHandler(userController.getMe));

export default router;