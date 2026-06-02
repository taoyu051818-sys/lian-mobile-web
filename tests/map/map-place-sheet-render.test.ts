import { describe, expect, it } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";

import {
  ERROR_LOAD_PLACE,
  LOADING_PLACE,
  PLACE_SHEET_POST_COUNT_SUFFIX,
  PLACE_SHEET_SETTLING,
} from "../../src/config/brand";
import MapPlaceSheet from "../../src/features/map/MapPlaceSheet.vue";
import type { MapLocation } from "../../src/types/map";
import type { PlaceSheet } from "../../src/types/place";

const selectedPlace: MapLocation = {
  id: "loc-1",
  name: "本地点名",
  lat: 18.39,
  lng: 110.01,
  placeId: "p-1",
};

async function renderSheet(props: {
  selectedPlace?: MapLocation | null;
  placeSheet?: PlaceSheet | null;
  placeSheetLoading?: boolean;
  placeSheetError?: string;
}) {
  return renderToString(createSSRApp({ render: () => h(MapPlaceSheet, props) }));
}

describe("MapPlaceSheet runtime DTO rendering", () => {
  it("renders backend DTO title, summary, stats, and recent posts", async () => {
    const html = await renderSheet({
      selectedPlace,
      placeSheet: {
        id: "p-1",
        name: "后端地点名",
        type: "library",
        status: "official",
        summary: { text: "后端汇总内容" },
        stats: { postCount: 7 },
        recentPosts: [{ tid: 42, title: "相关帖子", excerpt: "帖子摘要" }],
      },
    });

    expect(html).toContain("后端地点名");
    expect(html).toContain("官方");
    expect(html).toContain("图书馆");
    expect(html).toContain("后端汇总内容");
    expect(html).toContain(`7 ${PLACE_SHEET_POST_COUNT_SUFFIX}`);
    expect(html).toContain("相关帖子");
    expect(html).toContain("帖子摘要");
    expect(html).not.toContain("本地点名");
  });

  it("preserves loading, error, and empty fallback states", async () => {
    await expect(renderSheet({ selectedPlace, placeSheetLoading: true })).resolves.toContain(
      LOADING_PLACE,
    );
    await expect(
      renderSheet({ selectedPlace, placeSheetError: ERROR_LOAD_PLACE }),
    ).resolves.toContain(ERROR_LOAD_PLACE);

    const emptyHtml = await renderSheet({ selectedPlace, placeSheet: null });
    expect(emptyHtml).toContain("本地点名");
    expect(emptyHtml).toContain(PLACE_SHEET_SETTLING);
  });
});
