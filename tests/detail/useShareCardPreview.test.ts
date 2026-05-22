import { describe, expect, it, vi } from "vitest";

import { ShareCardError, type ShareCard } from "../../src/api/share-card";
import { useShareCardPreview } from "../../src/features/detail/useShareCardPreview";

const happyCard: ShareCard = {
  tid: 115,
  title: "这段路今天有施工",
  summary: "施工时间从下午两点到傍晚六点。",
  thumbnailUrl: "https://cdn.example/x.jpg",
  url: "https://lian.example/posts/115",
  kind: "post",
  authorName: "小李",
  audienceLabel: "公开",
  channel: {
    wechat: {
      title: "这段路今天有施工",
      description: "施工时间从下午两点到傍晚六点。",
      imageUrl: "https://cdn.example/x.jpg",
    },
  },
};

function flush() {
  // Allow microtasks (loader promise resolution) to settle.
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe("useShareCardPreview", () => {
  it("starts in idle state", () => {
    const preview = useShareCardPreview({ loader: vi.fn() });
    expect(preview.open.value).toBe(false);
    expect(preview.status.value).toBe("idle");
    expect(preview.card.value).toBeNull();
    expect(preview.canRetry.value).toBe(false);
  });

  it("transitions through loading → ready on a successful fetch", async () => {
    const loader = vi.fn().mockResolvedValue(happyCard);
    const preview = useShareCardPreview({ loader });

    preview.start(115);
    expect(preview.open.value).toBe(true);
    expect(preview.status.value).toBe("loading");
    expect(loader).toHaveBeenCalledWith(115);

    await flush();
    expect(preview.status.value).toBe("ready");
    expect(preview.card.value).toEqual(happyCard);
    expect(preview.errorReason.value).toBe("");
  });

  it("maps a not-found error to the deleted/不存在 copy and hides retry", async () => {
    const loader = vi.fn().mockRejectedValue(new ShareCardError("not-found", 404));
    const preview = useShareCardPreview({ loader });

    preview.start(999);
    await flush();

    expect(preview.status.value).toBe("error");
    expect(preview.errorReason.value).toBe("not-found");
    expect(preview.errorMessage.value).toContain("已删除或不存在");
    expect(preview.canRetry.value).toBe(false);
  });

  it("maps a network error to retryable copy and exposes a retry path", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new ShareCardError("network", 503))
      .mockResolvedValueOnce(happyCard);
    const preview = useShareCardPreview({ loader });

    preview.start(115);
    await flush();
    expect(preview.status.value).toBe("error");
    expect(preview.errorReason.value).toBe("network");
    expect(preview.canRetry.value).toBe(true);

    preview.retry();
    expect(preview.status.value).toBe("loading");
    await flush();

    expect(loader).toHaveBeenCalledTimes(2);
    expect(preview.status.value).toBe("ready");
    expect(preview.card.value).toEqual(happyCard);
  });

  it("ignores stale responses when a newer load supersedes an in-flight one", async () => {
    let resolveFirst: ((value: ShareCard) => void) | null = null;
    const loader = vi.fn().mockImplementation((tid: number) => {
      if (tid === 1) {
        return new Promise<ShareCard>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve(happyCard);
    });
    const preview = useShareCardPreview({ loader });

    preview.start(1);
    expect(preview.status.value).toBe("loading");

    preview.start(2);
    await flush();
    expect(preview.status.value).toBe("ready");
    expect(preview.card.value).toEqual(happyCard);

    // Now the stale first-call resolution arrives — should be ignored.
    resolveFirst?.({ ...happyCard, tid: 1, title: "stale" });
    await flush();
    expect(preview.card.value?.title).toBe("这段路今天有施工");
  });

  it("close() resets state and prevents in-flight responses from leaking", async () => {
    let resolveFirst: ((value: ShareCard) => void) | null = null;
    const loader = vi.fn().mockImplementation(
      () =>
        new Promise<ShareCard>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const preview = useShareCardPreview({ loader });

    preview.start(1);
    preview.close();
    expect(preview.open.value).toBe(false);
    expect(preview.status.value).toBe("idle");

    resolveFirst?.(happyCard);
    await flush();
    expect(preview.status.value).toBe("idle");
    expect(preview.card.value).toBeNull();
  });
});
