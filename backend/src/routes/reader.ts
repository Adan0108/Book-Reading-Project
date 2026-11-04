import { Router } from "express";
import { authenticationV2 } from "../auth/checkAuth";
import { optionalAuthenticationV2 } from "../auth/optionalAuth";
import { requireRoles } from "../auth/requireRoles";
import asyncHandler from "../helpers/asyncHandler";
import { OK } from "../core/success.response";
import * as reader from "../services/reader.service";
const router = Router(),
  author = [authenticationV2, requireRoles(["AUTHOR", "ADMIN"])];
router.get(
  "/discovery/filters",
  asyncHandler(async (_req, res) =>
    new OK("Story filters", await reader.discoveryFilters()).send(res),
  ),
);
router.get(
  "/authors/me/profile",
  ...author,
  asyncHandler(async (req, res) =>
    new OK("Author profile", await reader.authorProfile(req.user!.uid)).send(
      res,
    ),
  ),
);
router.patch(
  "/authors/me/profile",
  ...author,
  asyncHandler(async (req, res) =>
    new OK(
      "Author profile saved",
      await reader.saveAuthorProfile(req.user!.uid, req.body ?? {}),
    ).send(res),
  ),
);
router.get(
  "/authors/me/analytics",
  ...author,
  asyncHandler(async (req, res) =>
    new OK(
      "Author statistics",
      await reader.authorAnalytics(req.user!.uid),
    ).send(res),
  ),
);
router.get(
  "/authors/:id/profile",
  optionalAuthenticationV2,
  asyncHandler(async (req, res) =>
    new OK(
      "Author profile",
      await reader.publicAuthor(req.params.id, req.user?.uid),
    ).send(res),
  ),
);
router.put(
  "/authors/:id/follow",
  authenticationV2,
  asyncHandler(async (req, res) =>
    new OK(
      "Following updated",
      await reader.setFollowing(req.user!.uid, req.params.id, req.body ?? {}),
    ).send(res),
  ),
);
router.get(
  "/user/me/profile",
  authenticationV2,
  asyncHandler(async (req, res) =>
    new OK("Account profile", await reader.accountProfile(req.user!.uid)).send(
      res,
    ),
  ),
);
router.patch(
  "/user/me/profile",
  authenticationV2,
  asyncHandler(async (req, res) =>
    new OK(
      "Profile saved",
      await reader.saveAccountProfile(req.user!.uid, req.body ?? {}),
    ).send(res),
  ),
);
router.get(
  "/library/bookmarks",
  authenticationV2,
  asyncHandler(async (req, res) =>
    new OK(
      "Bookmarks",
      await reader.bookmarks(req.user!.uid, req.query.cursor),
    ).send(res),
  ),
);
router.put(
  "/library/bookmarks/:id",
  authenticationV2,
  asyncHandler(async (req, res) =>
    new OK(
      "Bookmark updated",
      await reader.setBookmark(req.user!.uid, req.params.id, req.body ?? {}),
    ).send(res),
  ),
);
router.get(
  "/library/follows",
  authenticationV2,
  asyncHandler(async (req, res) =>
    new OK(
      "Following",
      await reader.follows(req.user!.uid, req.query.cursor),
    ).send(res),
  ),
);
router.get(
  "/library/books/:id",
  authenticationV2,
  asyncHandler(async (req, res) =>
    new OK(
      "Library state",
      await reader.bookLibraryState(req.user!.uid, req.params.id),
    ).send(res),
  ),
);
router.get(
  "/library/history",
  authenticationV2,
  asyncHandler(async (req, res) =>
    new OK(
      "Reading history",
      await reader.readingHistory(req.user!.uid, req.query.cursor),
    ).send(res),
  ),
);
router.post(
  "/library/history",
  authenticationV2,
  asyncHandler(async (req, res) =>
    new OK(
      "Reading position saved",
      await reader.recordReading(req.user!.uid, req.body ?? {}),
    ).send(res),
  ),
);
router.delete(
  "/library/history/:id",
  authenticationV2,
  asyncHandler(async (req, res) =>
    new OK(
      "Reading history removed",
      await reader.removeHistory(req.user!.uid, req.params.id),
    ).send(res),
  ),
);
export default router;
