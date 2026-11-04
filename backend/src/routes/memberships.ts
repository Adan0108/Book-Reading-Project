import { Router } from "express";
import { authenticationV2 } from "../auth/checkAuth";
import { optionalAuthenticationV2 } from "../auth/optionalAuth";
import { requireRoles } from "../auth/requireRoles";
import asyncHandler from "../helpers/asyncHandler";
import * as controller from "../controllers/membership.controller";

const router = Router();
const author = [authenticationV2, requireRoles(["AUTHOR", "ADMIN"])];
router.get("/membership-policy", ...author, asyncHandler(controller.policy));
router.put(
  "/admin/membership-policy",
  authenticationV2,
  requireRoles(["ADMIN"]),
  asyncHandler(controller.updatePolicy),
);
router.get("/authors/me/tiers", ...author, asyncHandler(controller.myTiers));
router.put(
  "/authors/me/tiers/:level",
  ...author,
  asyncHandler(controller.saveTier),
);
router.get("/authors/me/members", ...author, asyncHandler(controller.members));
router.get(
  "/memberships/me",
  authenticationV2,
  asyncHandler(controller.subscriptions),
);
router.post(
  "/memberships/:membershipId/cancel",
  authenticationV2,
  asyncHandler(controller.cancel),
);
router.get("/authors/me/posts", ...author, asyncHandler(controller.myPosts));
router.post("/authors/me/posts", ...author, asyncHandler(controller.savePost));
router.patch(
  "/authors/me/posts/:postId",
  ...author,
  asyncHandler(controller.savePost),
);
router.get("/authors/:authorId/tiers", asyncHandler(controller.publicTiers));
router.get(
  "/authors/:authorId/posts",
  optionalAuthenticationV2,
  asyncHandler(controller.publicPosts),
);
router.get(
  "/authors/:authorId/posts/:postId",
  optionalAuthenticationV2,
  asyncHandler(controller.publicPost),
);
export default router;
