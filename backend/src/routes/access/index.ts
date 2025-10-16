import { Router } from "express";
import asyncHandler from "../../helpers/asyncHandler";
import accessController from "../../controllers/access.controller";

const router = Router();

// public
router.post("/register",asyncHandler(accessController.register));
router.post("/login",asyncHandler(accessController.login));

//protected
router.post("/logout",asyncHandler(accessController.logout));

export default router;
