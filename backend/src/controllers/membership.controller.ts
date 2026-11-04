import type { Request, Response } from "express";
import { OK } from "../core/success.response";
import * as membership from "../services/membership.service";
import * as posts from "../services/post.service";

export const policy = async (_req: Request, res: Response) =>
  new OK("Membership policy", await membership.getMembershipPolicy()).send(res);
export const updatePolicy = async (req: Request, res: Response) =>
  new OK(
    "Policy saved",
    await membership.updateMembershipPolicy(req.user!.uid, req.body ?? {}),
  ).send(res);
export const publicTiers = async (req: Request, res: Response) =>
  new OK(
    "Author tiers",
    await membership.publicAuthorTiers(req.params.authorId),
  ).send(res);
export const myTiers = async (req: Request, res: Response) =>
  new OK("Your tiers", await membership.myTiers(req.user!.uid)).send(res);
export const saveTier = async (req: Request, res: Response) =>
  new OK(
    "Tier saved",
    await membership.saveTier(req.user!.uid, req.params.level, req.body ?? {}),
  ).send(res);
export const members = async (req: Request, res: Response) =>
  new OK(
    "Your members",
    await membership.myMembers(req.user!.uid, req.query.cursor),
  ).send(res);
export const subscriptions = async (req: Request, res: Response) =>
  new OK(
    "Your memberships",
    await membership.myMemberships(req.user!.uid),
  ).send(res);
export const cancel = async (req: Request, res: Response) =>
  new OK(
    "Renewal canceled; access remains until the current period ends",
    await membership.cancelMembership(req.user!.uid, req.params.membershipId),
  ).send(res);
export const myPosts = async (req: Request, res: Response) =>
  new OK("Your posts", await posts.myPosts(req.user!.uid)).send(res);
export const savePost = async (req: Request, res: Response) =>
  new OK(
    "Post saved",
    await posts.savePost(req.user!.uid, req.body ?? {}, req.params.postId),
  ).send(res);
export const publicPosts = async (req: Request, res: Response) =>
  new OK(
    "Author posts",
    await posts.listPublicPosts(
      req.params.authorId,
      req.user?.uid,
      req.query.cursor,
    ),
  ).send(res);
export const publicPost = async (req: Request, res: Response) =>
  new OK(
    "Author post",
    await posts.getPublicPost(
      req.params.authorId,
      req.params.postId,
      req.user?.uid,
    ),
  ).send(res);
