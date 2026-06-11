import { describe, expect, it } from "vitest";
import { buildPublishPayload, createManualLocationDraft } from "../../src/api/publish";

describe("buildPublishPayload actionable post constraints", () => {
  it("keeps actionable preview details out of the publish API payload", () => {
    const payload = buildPublishPayload({
      title: "咖啡团购",
      body: "三人成团",
      tag: "商家",
      identityTag: "verified",
      imageUrls: ["/coffee.jpg"],
      placeName: "",
      visibility: "public",
      kind: "merchant",
      locationDraft: createManualLocationDraft("东门"),
      merchant: {
        contentType: "merchant_food",
        input: {
          name: "东门咖啡",
          category: "咖啡",
          address: "东门",
          phone: "123",
        },
      },
    });

    expect(payload).not.toHaveProperty("actionablePost");
    expect(payload.kind).toBe("merchant");
    expect(payload.metadata.presentationIntent).toBe("merchant");
  });
});
