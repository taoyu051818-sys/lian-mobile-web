/**
 * Behavioural coverage for `useErrandOrderDraft` (issue #609 PR2).
 *
 * The draft composable is the heart of the user-side order journey: it pulls
 * `/auth/me` + `/wallet/me` + `/errands/orders/eligibility` together to derive
 * the gate, owns the form draft + validation, and runs the create round-trip.
 *
 * PR1 already pinned the read shape via structure tests; PR2 layers a real
 * vitest run that exercises:
 *   - Pickup-hint seeding from the merchant CTA (so the form opens with
 *     `merchant.name` already filled).
 *   - Local gate evaluation order (auth → verification → balance) and the
 *     anonymous short-circuit that suppresses the inevitable 401s.
 *   - Submit validation (missing pickup / dropoff / merchant fall through to
 *     `ERRAND_ORDER_VALIDATE_*` strings).
 *   - Submit failure folding the gate back into the blocked-state UI.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/api/errands", () => ({
  fetchErrandOrderEligibility: vi.fn(),
  createErrandOrder: vi.fn(),
}));

vi.mock("../../src/api/profile", () => ({
  fetchAuthMe: vi.fn(),
  fetchProfileWallet: vi.fn(),
}));

vi.mock("../../src/api/map", () => ({
  fetchMapV2Items: vi.fn(),
}));

import * as errandsApi from "../../src/api/errands";
import * as mapApi from "../../src/api/map";
import * as profileApi from "../../src/api/profile";
import {
  errandDropoffPlaceId,
  useErrandDropoffPlaces,
  useErrandOrderDraft,
} from "../../src/features/errand/useErrandOrderDraft";
import {
  ERRAND_ORDER_GATE_INSUFFICIENT_BALANCE,
  ERRAND_ORDER_GATE_MERCHANT_PAUSED,
  ERRAND_ORDER_GATE_NOT_LOGGED_IN,
  ERRAND_ORDER_GATE_NOT_VERIFIED,
  ERRAND_ORDER_VALIDATE_DROPOFF,
  ERRAND_ORDER_VALIDATE_MERCHANT,
  ERRAND_ORDER_VALIDATE_PICKUP,
} from "../../src/config/brand/merchant";

const mockEligibility = vi.mocked(errandsApi.fetchErrandOrderEligibility);
const mockCreate = vi.mocked(errandsApi.createErrandOrder);
const mockAuthMe = vi.mocked(profileApi.fetchAuthMe);
const mockWallet = vi.mocked(profileApi.fetchProfileWallet);
const mockMapItems = vi.mocked(mapApi.fetchMapV2Items);

function loggedInUser({ campusVerified = true }: { campusVerified?: boolean } = {}) {
  return {
    id: "u-1",
    username: "tester",
    verificationState: campusVerified
      ? {
          campus_verified: {
            tag: "campus_verified" as const,
            grantedAt: "2026-01-01T00:00:00Z",
            active: true,
          },
        }
      : {},
  };
}

beforeEach(() => {
  mockEligibility.mockReset();
  mockCreate.mockReset();
  mockAuthMe.mockReset();
  mockWallet.mockReset();
  mockMapItems.mockReset();
});

describe("useErrandOrderDraft — pickup hint seeding (#609 PR2)", () => {
  it("seeds the pickup label from the route hint", () => {
    const { draft } = useErrandOrderDraft(123, "海大食堂西餐窗口");
    expect(draft.value.merchantPostId).toBe(123);
    expect(draft.value.pickupLocation?.label).toBe("海大食堂西餐窗口");
    // Coords stay null until the V0.2 picker lands — the hint is a label, not a place.
    expect(draft.value.pickupLocation?.lat).toBeNull();
    expect(draft.value.pickupLocation?.lng).toBeNull();
  });

  it("trims whitespace-only hints back to an empty pickup", () => {
    const { draft } = useErrandOrderDraft(123, "   ");
    // A whitespace hint must NOT pass the validate() non-empty check —
    // otherwise the user would hit submit and see no error before the API
    // rejects the bare-whitespace label.
    expect(draft.value.pickupLocation?.label).toBe("");
  });

  it("reset() re-seeds the pickup label for a new merchant", () => {
    const ctx = useErrandOrderDraft(123, "海大食堂");
    ctx.reset(456, "明德超市");
    expect(ctx.draft.value.merchantPostId).toBe(456);
    expect(ctx.draft.value.pickupLocation?.label).toBe("明德超市");
  });
});

describe("useErrandOrderDraft — stable dropoff place", () => {
  it("adopts a catalog place and clears stale identity after a manual edit", () => {
    const ctx = useErrandOrderDraft(123, "海大食堂");
    const contract = ctx as typeof ctx & {
      setDropoffPlace?: (place: {
        id: string;
        name: string;
        lat: number;
        lng: number;
        place?: { id: string; name: string };
      }) => void;
    };

    expect(typeof contract.setDropoffPlace).toBe("function");
    contract.setDropoffPlace?.({
      id: "location-safe-building",
      name: "明德楼大厅",
      lat: 18.401,
      lng: 110.022,
      place: { id: "place-safe-building", name: "明德楼大厅" },
    });
    expect(ctx.draft.value.dropoffLocation).toEqual({
      placeId: "place-safe-building",
      label: "明德楼大厅",
      lat: 18.401,
      lng: 110.022,
    });

    ctx.setDropoff("明德楼 901（手填）");
    expect(ctx.draft.value.dropoffLocation).toEqual({
      placeId: "",
      label: "明德楼 901（手填）",
      lat: null,
      lng: null,
    });
  });

  it("does not promote a map marker id to a stable dropoff place id", async () => {
    mockMapItems.mockResolvedValue({
      locations: [
        {
          id: "marker-only-location",
          name: "明德楼大厅",
          lat: 18.401,
          lng: 110.022,
        },
      ],
    });

    const places = useErrandDropoffPlaces();
    await places.loadPlaces();

    expect(errandDropoffPlaceId(places.locations.value[0])).toBe("");
    expect(places.selectableLocations.value).toEqual([]);
  });
});

describe("useErrandOrderDraft — gate evaluation (#609 PR2)", () => {
  it("anonymous user collapses to not_logged_in without bubbling wallet/eligibility 401s", async () => {
    mockAuthMe.mockResolvedValue(null);
    // Even though wallet / eligibility would normally 401 for an anonymous
    // user, the gate must not surface that as `gateError` — the localized
    // "请先登录" copy is the right thing to show.
    mockWallet.mockRejectedValue(new Error("401"));
    mockEligibility.mockRejectedValue(new Error("401"));

    const ctx = useErrandOrderDraft(123, "");
    await ctx.refresh(123);

    expect(ctx.gateLoaded.value).toBe(true);
    expect(ctx.gateError.value).toBe("");
    expect(ctx.gate.value.ok).toBe(false);
    expect(ctx.gate.value.reason).toBe("not_logged_in");
    expect(ctx.gate.value.reasonText).toBe(ERRAND_ORDER_GATE_NOT_LOGGED_IN);
  });

  it("logged-in but unverified user is blocked on not_verified before the server gate runs", async () => {
    mockAuthMe.mockResolvedValue(loggedInUser({ campusVerified: false }));
    mockWallet.mockResolvedValue({ points: 100, honor: 0, lockedPoints: 0 });
    // Even if the server says "ok", local verification gate wins first.
    mockEligibility.mockResolvedValue({
      ok: true,
      reason: "",
      reasonText: "",
      availablePoints: 100,
      estimatedFeePoints: 8,
    });

    const ctx = useErrandOrderDraft(123, "");
    await ctx.refresh(123);

    expect(ctx.gate.value.ok).toBe(false);
    expect(ctx.gate.value.reason).toBe("not_verified");
    expect(ctx.gate.value.reasonText).toBe(ERRAND_ORDER_GATE_NOT_VERIFIED);
  });

  it("insufficient wallet balance blocks even when the server gate says ok", async () => {
    mockAuthMe.mockResolvedValue(loggedInUser());
    // available = points - lockedPoints = 5 - 0 = 5; fee is 8 → insufficient.
    mockWallet.mockResolvedValue({ points: 5, honor: 0, lockedPoints: 0 });
    mockEligibility.mockResolvedValue({
      ok: true,
      reason: "",
      reasonText: "",
      availablePoints: 5,
      estimatedFeePoints: 8,
    });

    const ctx = useErrandOrderDraft(123, "");
    await ctx.refresh(123);

    expect(ctx.gate.value.ok).toBe(false);
    expect(ctx.gate.value.reason).toBe("insufficient_balance");
    expect(ctx.gate.value.reasonText).toBe(ERRAND_ORDER_GATE_INSUFFICIENT_BALANCE);
    expect(ctx.gate.value.availablePoints).toBe(5);
    expect(ctx.gate.value.estimatedFeePoints).toBe(8);
  });

  it("local gate ok, server gate blocks → server reason wins", async () => {
    mockAuthMe.mockResolvedValue(loggedInUser());
    mockWallet.mockResolvedValue({ points: 100, honor: 0, lockedPoints: 0 });
    mockEligibility.mockResolvedValue({
      ok: false,
      reason: "merchant_paused",
      reasonText: "",
      availablePoints: 100,
      estimatedFeePoints: 8,
    });

    const ctx = useErrandOrderDraft(123, "");
    await ctx.refresh(123);

    expect(ctx.gate.value.ok).toBe(false);
    expect(ctx.gate.value.reason).toBe("merchant_paused");
    expect(ctx.gate.value.reasonText).toBe(ERRAND_ORDER_GATE_MERCHANT_PAUSED);
  });

  it("happy path: gate.ok=true and canSubmit becomes true once the form has both labels", async () => {
    mockAuthMe.mockResolvedValue(loggedInUser());
    mockWallet.mockResolvedValue({ points: 100, honor: 0, lockedPoints: 0 });
    mockEligibility.mockResolvedValue({
      ok: true,
      reason: "",
      reasonText: "",
      availablePoints: 100,
      estimatedFeePoints: 8,
    });

    const ctx = useErrandOrderDraft(123, "海大食堂西餐窗口");
    await ctx.refresh(123);

    expect(ctx.gate.value.ok).toBe(true);
    // Pickup is seeded, dropoff is empty → canSubmit must still be false.
    expect(ctx.canSubmit.value).toBe(false);

    ctx.setDropoff("明德楼一楼大厅");
    expect(ctx.canSubmit.value).toBe(true);
  });
});

describe("useErrandOrderDraft — submit (#609 PR2)", () => {
  it("validate() rejects missing pickup / dropoff / merchant with the brand strings", async () => {
    mockAuthMe.mockResolvedValue(loggedInUser());
    mockWallet.mockResolvedValue({ points: 100, honor: 0, lockedPoints: 0 });
    mockEligibility.mockResolvedValue({
      ok: true,
      reason: "",
      reasonText: "",
      availablePoints: 100,
      estimatedFeePoints: 8,
    });

    // Missing merchant — gate evaluation skipped, validate() short-circuits.
    const noMerchant = useErrandOrderDraft(0, "");
    expect(await noMerchant.submit()).toBe("");
    expect(noMerchant.submitError.value).toBe(ERRAND_ORDER_VALIDATE_MERCHANT);

    // Missing pickup.
    const noPickup = useErrandOrderDraft(123, "");
    await noPickup.refresh(123);
    expect(await noPickup.submit()).toBe("");
    expect(noPickup.submitError.value).toBe(ERRAND_ORDER_VALIDATE_PICKUP);
    expect(mockCreate).not.toHaveBeenCalled();

    // Pickup OK, dropoff missing.
    const noDropoff = useErrandOrderDraft(123, "海大食堂");
    await noDropoff.refresh(123);
    expect(await noDropoff.submit()).toBe("");
    expect(noDropoff.submitError.value).toBe(ERRAND_ORDER_VALIDATE_DROPOFF);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("submit success returns the new orderId and never trims away required fields", async () => {
    mockAuthMe.mockResolvedValue(loggedInUser());
    mockWallet.mockResolvedValue({ points: 100, honor: 0, lockedPoints: 0 });
    mockEligibility.mockResolvedValue({
      ok: true,
      reason: "",
      reasonText: "",
      availablePoints: 100,
      estimatedFeePoints: 8,
    });
    mockCreate.mockResolvedValue({
      ok: true,
      order: {
        order: {
          orderId: "ord-42",
          requesterUserId: "u-1",
          pickupLocation: { placeId: "", label: "海大食堂", lat: null, lng: null },
          dropoffLocation: { placeId: "", label: "明德楼", lat: null, lng: null },
          mode: "dedicated",
          status: "created",
          feePoints: 3,
          rewardPoints: 5,
          totalLockedPoints: 8,
        },
        timeline: [{ status: "created", at: "2026-05-22T10:00:00Z", actor: "system" }],
        notes: "",
        createdAt: "2026-05-22T10:00:00Z",
      },
    });

    const ctx = useErrandOrderDraft(123, "海大食堂");
    await ctx.refresh(123);
    ctx.setDropoff("明德楼");
    ctx.setNotes("  少冰  "); // Notes get trimmed at submit; body must reflect that.

    const orderId = await ctx.submit();
    expect(orderId).toBe("ord-42");
    expect(ctx.submitError.value).toBe("");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0]?.[0];
    expect(call?.merchantPostId).toBe(123);
    expect(call?.pickupLocation.label).toBe("海大食堂");
    expect(call?.dropoffLocation.label).toBe("明德楼");
    expect(call?.notes).toBe("少冰");
  });

  it("submit failure folds the rejection into the gate so the blocked-state UI shows", async () => {
    mockAuthMe.mockResolvedValue(loggedInUser());
    mockWallet.mockResolvedValue({ points: 100, honor: 0, lockedPoints: 0 });
    mockEligibility.mockResolvedValue({
      ok: true,
      reason: "",
      reasonText: "",
      availablePoints: 100,
      estimatedFeePoints: 8,
    });
    // Race: the pre-flight gate passed but the wallet dropped between probe and submit.
    mockCreate.mockResolvedValue({
      ok: false,
      reason: "insufficient_balance",
      reasonText: "",
    });

    const ctx = useErrandOrderDraft(123, "海大食堂");
    await ctx.refresh(123);
    ctx.setDropoff("明德楼");
    expect(ctx.gate.value.ok).toBe(true);

    const orderId = await ctx.submit();
    expect(orderId).toBe("");
    expect(ctx.gate.value.ok).toBe(false);
    expect(ctx.gate.value.reason).toBe("insufficient_balance");
    expect(ctx.gate.value.reasonText).toBe(ERRAND_ORDER_GATE_INSUFFICIENT_BALANCE);
    // canSubmit must drop too — the form should re-render the gate, not the submit button.
    expect(ctx.canSubmit.value).toBe(false);
  });
});
