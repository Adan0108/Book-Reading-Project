export interface MembershipPolicy {
  currency: "USD";
  tierOneName: string;
  tierTwoName: string;
  tierOneCents: number;
  tierTwoCents: number;
  tierTwoEnabled: boolean;
  revenueShareBps: number;
  version: number;
}
export interface AuthorTier {
  id: number;
  authorId: number;
  level: number | null;
  name: string;
  description: string;
  benefits: string[];
  priceCents: number;
  currency: string;
  available: boolean;
  pricingVersion: number;
}
export interface Membership {
  id: number;
  authorId: number;
  authorName: string;
  tierName: string;
  status: string;
  autoRenew: boolean;
  currentPeriodEnd: string;
  hasAccess: boolean;
  provider: string;
}
export interface AuthorPost {
  isSpoiler?: boolean;
  images?: { id: string; imageUrl: string; pageOrder: number }[];
  moderationHidden?: boolean;
  moderationReason?: string | null;
  id: number;
  authorId?: number;
  title: string;
  body?: string;
  visibility: "PUBLIC" | "MEMBERS" | "TIERS";
  minimumTierId?: number | null;
  isDraft?: boolean;
  isLocked?: boolean;
}
