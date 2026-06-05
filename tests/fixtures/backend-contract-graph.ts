import type { MetadataComponentV2 } from "../../src/types/post-extensions";

export const backendMetadataComponentsContractFixture = [
  {
    type: "event",
    eventId: "evt_contract_972",
    location: "North Campus Hall",
    capacity: 40,
    joinedCount: 12,
    rewardSummary: "10 points",
    status: "open",
  },
  {
    type: "help",
    helpId: "help_contract_972",
    status: "linked_event",
    voteCount: 7,
    commentCount: 2,
    linkedEventTid: 97201,
  },
  {
    type: "merchant",
    name: "Contract Cafe",
    category: "food",
    hours: "09:00-18:00",
    contact: "campus-cafe@example.test",
    errandSupported: true,
    verifiedAt: "2026-06-01T08:00:00.000Z",
  },
  {
    type: "trade",
    price: "¥25",
    state: "reserved",
    category: "textbooks",
    verifiedAt: "2026-06-01T09:00:00.000Z",
  },
  {
    type: "location",
    placeId: "campus_gate_972",
    label: "East Gate",
    lat: 39.9876,
    lng: 116.321,
  },
  {
    type: "time",
    startsAt: "2026-06-02T09:00:00.000Z",
    endsAt: "2026-06-02T10:30:00.000Z",
  },
  {
    type: "media",
    imageUrls: ["https://cdn.example.test/972/a.jpg"],
    coverUrl: "https://cdn.example.test/972/cover.jpg",
  },
  {
    type: "quality",
    score: 0.98,
    labels: ["backend-contract", "verified"],
  },
  {
    type: "audience",
    visibility: "campus",
    schoolId: "school_972",
    campusId: "campus_972",
  },
  {
    type: "tags",
    tags: ["contract", "metadata-v2"],
  },
] as const satisfies readonly MetadataComponentV2[];

export const backendPostDetailGraphFixture = {
  tid: 97201,
  title: "Backend graph detail",
  contentType: "event",
  metadata: {
    _v: 2,
    components: backendMetadataComponentsContractFixture,
    relations: [
      { type: "help_event_link", target: { kind: "post", id: "97202" }, role: "source" },
      { type: "event_reward", target: { kind: "user", id: "u_972" }, role: "recipient" },
    ],
    availableActions: [
      { type: "join_event", enabled: true },
      {
        type: "claim_reward",
        enabled: false,
        reason: "event_open",
        reasonText: "Complete the event before claiming rewards.",
      },
    ],
  },
} as const;

export const backendFeedGraphFixture = {
  tid: 97203,
  title: "Backend graph feed item",
  contentType: "project",
  visibility: "campus",
  metadata: {
    _v: 2,
    presentationIntent: "text",
    components: [
      backendMetadataComponentsContractFixture[1],
      backendMetadataComponentsContractFixture[3],
      backendMetadataComponentsContractFixture[4],
      backendMetadataComponentsContractFixture[5],
    ],
    relations: [
      { type: "project_submission", target: { kind: "post", id: "97204" }, role: "child" },
      { type: "merchant_errand", target: { kind: "post", id: 97205 } },
    ],
    availableActions: [
      { type: "open_submission", enabled: true },
      { type: "request_review", enabled: false, reason: "needs_identity" },
    ],
  },
} as const;

export const backendProfileGraphFixture = {
  tid: 97206,
  title: "Backend graph profile row",
  metadata: {
    _v: 2,
    components: [
      backendMetadataComponentsContractFixture[3],
      backendMetadataComponentsContractFixture[4],
      backendMetadataComponentsContractFixture[6],
      backendMetadataComponentsContractFixture[8],
      backendMetadataComponentsContractFixture[9],
    ],
    relations: [
      { type: "trade_offer_link", target: { kind: "post", id: 97207 }, role: "offer" },
      { type: "custom_user_relation", target: { kind: "user", id: "u_972" } },
    ],
    availableActions: [
      { type: "trade_reserve", enabled: true },
      {
        type: "message_author",
        enabled: false,
        reason: "blocked",
        reasonText: "Messaging is unavailable for this relation.",
      },
    ],
  },
} as const;
