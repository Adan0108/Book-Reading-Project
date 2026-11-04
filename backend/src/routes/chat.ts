import { Router } from "express";
import { authenticationV2 } from "../auth/checkAuth";
import { OK } from "../core/success.response";
import asyncHandler from "../helpers/asyncHandler";
import * as chat from "../chat/chat.service";
const router = Router();
router.get(
  "/chat/conversations",
  authenticationV2,
  asyncHandler(async (req, res) =>
    new OK(
      "Conversations",
      await chat.listConversations(req.user!.uid, req.query.cursor),
    ).send(res),
  ),
);
router.post(
  "/chat/conversations",
  authenticationV2,
  asyncHandler(async (req, res) =>
    new OK(
      "Conversation",
      await chat.createConversation(req.user!.uid, req.body ?? {}),
    ).send(res),
  ),
);
router.get(
  "/chat/conversations/:id/messages",
  authenticationV2,
  asyncHandler(async (req, res) =>
    new OK(
      "Messages",
      await chat.messageHistory(req.user!.uid, req.params.id, req.query.cursor),
    ).send(res),
  ),
);
router.post(
  "/chat/conversations/:id/messages",
  authenticationV2,
  asyncHandler(async (req, res) =>
    new OK(
      "Message persisted",
      await chat.sendMessage(req.user!.uid, req.params.id, req.body ?? {}),
    ).send(res),
  ),
);
router.post(
  "/chat/conversations/:id/read",
  authenticationV2,
  asyncHandler(async (req, res) =>
    new OK(
      "Read state",
      await chat.markRead(req.user!.uid, req.params.id, req.body ?? {}),
    ).send(res),
  ),
);
export default router;
