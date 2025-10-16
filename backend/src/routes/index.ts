import { Router } from "express";
import accessRouter from "./access";

const router = Router();

router.use("/v1/api/access", accessRouter);

export default router;
