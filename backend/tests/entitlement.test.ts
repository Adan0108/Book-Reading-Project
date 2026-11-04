import { describe, expect, it } from "vitest";
import {
  assertEntitled,
  canJoinAuthorChat,
  canReadChapter,
  canViewPost,
  type EntitlementContext,
} from "../src/services/entitlement.service";

const context = (level?: number): EntitlementContext => ({
  authorId: 1,
  userId: level === undefined ? undefined : 10,
  authorAvailable: true,
  privileged: false,
  isAuthor: false,
  memberships: level ? [{ id: 5, tierId: level, level }] : [],
});
describe("central author entitlement policy", () => {
  it("applies parent-book restrictions before public chapter visibility", () => {
    const result = canReadChapter(
      context(),
      { visibility: "MEMBERS", rules: [] },
      { visibility: "PUBLIC", released: true, rules: [] },
    );
    expect(result).toEqual({ allowed: false, reason: "LOGIN_REQUIRED" });
    expect(() => assertEntitled(result)).toThrow();
  });
  it.each([
    { member: 1, required: 1, allowed: true },
    { member: 1, required: 2, allowed: false },
    { member: 2, required: 1, allowed: true },
    { member: 2, required: 2, allowed: true },
  ])("enforces managed hierarchy %j", ({ member, required, allowed }) => {
    const result = canReadChapter(
      context(member),
      { visibility: "PUBLIC", rules: [] },
      {
        visibility: "TIERS",
        released: true,
        rules: [{ tierId: required, level: required }],
      },
    );
    expect(result.allowed).toBe(allowed);
  });
  it("retains exact-match access for legacy tiers without inventing a hierarchy", () => {
    const legacy = {
      ...context(1),
      memberships: [{ id: 5, tierId: 17, level: null }],
    };
    expect(
      canViewPost(legacy, {
        released: true,
        visibility: "TIERS",
        rules: [{ tierId: 17, level: null }],
      }).allowed,
    ).toBe(true);
    expect(
      canViewPost(legacy, {
        released: true,
        visibility: "TIERS",
        rules: [{ tierId: 18, level: null }],
      }).allowed,
    ).toBe(false);
  });
  it("shares membership decisions across posts and chat, including unavailable authors", () => {
    for (const viewer of [context(), context(0), context(1), context(2)])
      expect(canJoinAuthorChat(viewer).allowed).toBe(
        canViewPost(viewer, {
          released: true,
          visibility: "MEMBERS",
          rules: [],
        }).allowed,
      );
    const owner = { ...context(0), privileged: true, isAuthor: true };
    expect(canJoinAuthorChat(owner).allowed).toBe(true);
    expect(canJoinAuthorChat({ ...context(0), privileged: true }).allowed).toBe(
      false,
    );
    expect(
      canViewPost(owner, { released: false, visibility: "PUBLIC", rules: [] })
        .allowed,
    ).toBe(false);
    expect(
      canJoinAuthorChat({ ...owner, authorAvailable: false }).allowed,
    ).toBe(false);
  });
});
