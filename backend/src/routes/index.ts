// import { Router } from "express";
// const router = Router();

// // ví dụ route demo
// router.get("/v1/api/health", (_req, res) => res.json({ ok: true }));

// export default router;

import { Router } from 'express';
import userRouter from './user'; // Make sure this line exists

const router = Router();

// This line tells the main router to use your user routes
router.use('/user', userRouter); 

export default router;