import {
  PROFILE_UNLOCK_CAMPUS_HINT,
  PROFILE_UNLOCK_CAMPUS_TITLE,
  PROFILE_UNLOCK_GO_VERIFY,
  PROFILE_UNLOCK_MERCHANT_HINT,
  PROFILE_UNLOCK_MERCHANT_TITLE,
  PROFILE_UNLOCK_RUNNER_HINT,
  PROFILE_UNLOCK_RUNNER_TITLE,
} from "../../config/brand";
import type { ProfileUser } from "../../types/profile";
import type { VerificationTag } from "../../types/verification";

export interface ProfileUnlockCard {
  key: "campus" | "merchant" | "runner";
  title: string;
  hint: string;
  ctaLabel: string;
  targetView: "verification";
  testId: string;
}

export function hasActiveVerificationTag(
  user: ProfileUser | null | undefined,
  tag: VerificationTag,
): boolean {
  if (!user) return false;
  const record = user.verificationState?.[tag];
  if (record) return Boolean(record.active);
  const tags = new Set<string>([...(user.verificationTags || []), ...(user.tags || [])]);
  return tags.has(tag);
}

export function buildProfileUnlockCards(
  user: ProfileUser | null | undefined,
): ProfileUnlockCard[] {
  const cards: ProfileUnlockCard[] = [];

  if (!hasActiveVerificationTag(user, "campus_verified")) {
    cards.push({
      key: "campus",
      title: PROFILE_UNLOCK_CAMPUS_TITLE,
      hint: PROFILE_UNLOCK_CAMPUS_HINT,
      ctaLabel: PROFILE_UNLOCK_GO_VERIFY,
      targetView: "verification",
      testId: "profile-unlock-campus",
    });
  }

  if (!hasActiveVerificationTag(user, "merchant_verified")) {
    cards.push({
      key: "merchant",
      title: PROFILE_UNLOCK_MERCHANT_TITLE,
      hint: PROFILE_UNLOCK_MERCHANT_HINT,
      ctaLabel: PROFILE_UNLOCK_GO_VERIFY,
      targetView: "verification",
      testId: "profile-unlock-merchant",
    });
  }

  if (!hasActiveVerificationTag(user, "runner")) {
    cards.push({
      key: "runner",
      title: PROFILE_UNLOCK_RUNNER_TITLE,
      hint: PROFILE_UNLOCK_RUNNER_HINT,
      ctaLabel: PROFILE_UNLOCK_GO_VERIFY,
      targetView: "verification",
      testId: "profile-unlock-runner",
    });
  }

  return cards;
}
