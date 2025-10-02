import { Router } from "express";
const router = Router();

// ví dụ route demo
router.get("/v1/api/health", (_req, res) => res.json({ ok: true }));

export default router;
