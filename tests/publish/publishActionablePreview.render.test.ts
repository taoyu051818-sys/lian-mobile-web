import { renderToString } from "@vue/server-renderer";
import { createSSRApp, h } from "vue";
import { describe, expect, it } from "vitest";

import PublishActionablePreview from "../../src/features/publish/PublishActionablePreview.vue";
import type { PublishKind } from "../../src/features/publish/usePublishDraft";
import type { EventJoinPolicy } from "../../src/types/post-extensions";
import type { PublishActionablePostPreview } from "../../src/types/publish";
import type { InferredKind, SuggestedComponent } from "../../src/types/publishSuggestion";

interface PreviewProps {
  title: string;
  body: string;
  kind: PublishKind;
  suggestedComponents: SuggestedComponent[];
  locationLabel: string;
  normalizedTag: string;
  normalizedIdentityTag: string;
  eventStartsAt: string;
  eventJoinPolicy: EventJoinPolicy;
  llmInferredKind: InferredKind | null;
  uploadedImageCount: number;
  merchantName: string;
  merchantCategory: string;
  tradePrice: string;
  tradeCategory: string;
  actionablePost: PublishActionablePostPreview | null;
}

const resetLiveProps: PreviewProps = {
  title: "",
  body: "",
  kind: "regular" as const,
  suggestedComponents: [],
  locationLabel: "",
  normalizedTag: "",
  normalizedIdentityTag: "",
  eventStartsAt: "",
  eventJoinPolicy: "open" as const,
  llmInferredKind: null,
  uploadedImageCount: 0,
  merchantName: "",
  merchantCategory: "",
  tradePrice: "",
  tradeCategory: "",
  actionablePost: null,
};

function publishedResult(kind: InferredKind, marker: string): PublishActionablePostPreview {
  return {
    kind,
    action: `${marker}行动`,
    structure: [`${marker}结构`],
    components: [{ kind: "tags", label: `${marker}组件` }],
  };
}

async function renderPreview(overrides: Partial<PreviewProps> = {}) {
  return renderToString(
    createSSRApp({
      render: () => h(PublishActionablePreview, { ...resetLiveProps, ...overrides }),
    }),
  );
}

describe("PublishActionablePreview result ownership rendering", () => {
  it("renders a stored result after the live draft has reset without a fake live shell", async () => {
    const html = await renderPreview({
      actionablePost: publishedResult("event", "A已发布"),
    });

    expect(html).toContain('data-testid="publish-actionable-preview"');
    expect(html).toContain('data-testid="publish-preview-published-structure"');
    expect(html).toContain("A已发布行动");
    expect(html).toContain("A已发布组件");
    expect(html).toContain("A已发布结构");
    expect(html).toContain("已发布为");
    expect(html).toContain("活动");
    expect(html).not.toContain('data-testid="publish-preview-kind"');
    expect(html).not.toContain('data-testid="publish-preview-wire-kind"');
    expect(html).not.toContain("普通帖子");
    expect(html).not.toContain("当前只会发布为自由文本");
  });

  it("stays hidden when neither a live draft nor a stored result exists", async () => {
    const html = await renderPreview();

    expect(html).not.toContain('data-testid="publish-actionable-preview"');
    expect(html).not.toContain('data-testid="publish-preview-published-structure"');
  });

  it("preserves the existing live-draft-only preview", async () => {
    const html = await renderPreview({
      title: "B草稿标题",
      body: "B草稿正文",
      suggestedComponents: [{ kind: "location", label: "B待补地点", payload: {} }],
    });

    expect(html).toContain('data-testid="publish-actionable-preview"');
    expect(html).toContain('data-testid="publish-preview-kind"');
    expect(html).toContain('data-testid="publish-preview-wire-kind"');
    expect(html).toContain("B草稿标题");
    expect(html).toContain("B草稿正文");
    expect(html).toContain("B待补地点");
    expect(html).not.toContain('data-testid="publish-preview-published-structure"');
  });

  it("keeps live B and stored A in independent regions", async () => {
    const html = await renderPreview({
      title: "B仍在编辑",
      body: "B正文",
      actionablePost: publishedResult("trade", "A已发布"),
    });

    expect(html).toContain("B仍在编辑");
    expect(html).toContain("B正文");
    expect(html).toContain("A已发布行动");
    expect(html).toContain("A已发布结构");
    expect(html.indexOf("B仍在编辑")).toBeLessThan(html.indexOf("A已发布结构"));
  });

  it.each([
    ["text", "文字"],
    ["image", "图片"],
    ["help", "求助"],
    ["place", "地点"],
    ["event", "活动"],
    ["merchant", "商家"],
    ["trade", "交易"],
  ] satisfies Array<[InferredKind, string]>)(
    "renders stored kind %s as the user-facing label %s",
    async (kind, expectedLabel) => {
      const html = await renderPreview({ actionablePost: publishedResult(kind, "已发布") });

      expect(html).toMatch(new RegExp(`<span[^>]*>${expectedLabel}</span>`));
      expect(html).not.toMatch(new RegExp(`<span[^>]*>${kind}</span>`));
    },
  );
});
