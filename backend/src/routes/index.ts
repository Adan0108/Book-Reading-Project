import { Router } from "express";
import accessRouter from "./access";
import userRouter from "./user";

const router = Router();

router.use("/v1/api/access", accessRouter);

router.use("/v1/api/user", userRouter);

export default router;
