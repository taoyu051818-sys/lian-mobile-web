import { describe, it, expect, beforeEach } from "vitest";
import { useShellChrome } from "../../src/shell/useShellChrome";
import {
  defineMapFilterSpec,
  defineMapTopChrome,
  defineMapBottomChromeForPlace,
  defineMapDefaultBottomChrome,
} from "../../src/views/map/useMapChrome";

beforeEach(() => {
  useShellChrome().resetRegions();
});

describe("defineMapFilterSpec", () => {
  const filters = [
    { id: "locations", label: "地点", defaultActive: true },
    { id: "posts", label: "内容", defaultActive: true },
  ];

  it("marks active filters with check prefix", () => {
    const spec = defineMapFilterSpec(filters, { locations: true, posts: false });
    expect(spec).toHaveLength(2);
    expect(spec[0].label).toBe("✓ 地点");
    expect(spec[0].id).toBe("filter-locations");
    expect(spec[1].label).toBe("内容");
    expect(spec[1].id).toBe("filter-posts");
  });

  it("uses ghost variant for all filter buttons", () => {
    const spec = defineMapFilterSpec(filters, { locations: true, posts: true });
    spec.forEach((btn) => expect(btn.variant).toBe("ghost"));
  });
});

describe("defineMapTopChrome", () => {
  const filters = [
    { id: "locations", label: "地点", defaultActive: true },
    { id: "posts", label: "内容", defaultActive: true },
  ];

  it("returns visible spec with filter buttons", () => {
    const spec = defineMapTopChrome(filters, { locations: true, posts: true });
    expect(spec.visible).toBe(true);
    expect(spec.buttons).toHaveLength(2);
    expect(spec.buttons![0].id).toBe("filter-locations");
  });
});

describe("defineMapBottomChromeForPlace", () => {
  it("returns place actions for a location", () => {
    const spec = defineMapBottomChromeForPlace({
      id: "loc-1",
      name: "图书馆",
      lat: 18.39,
      lng: 110.01,
    });
    expect(spec.visible).toBe(true);
    expect(spec.buttons).toHaveLength(2);
    expect(spec.buttons![0].label).toBe("查看 图书馆");
    expect(spec.buttons![0].variant).toBe("primary");
    expect(spec.buttons![1].id).toBe("place-close");
  });

  it("returns place actions for a post using title", () => {
    const spec = defineMapBottomChromeForPlace({
      tid: "post-1" as any,
      title: "食堂推荐",
      lat: 18.39,
      lng: 110.01,
    });
    expect(spec.buttons![0].label).toBe("查看 食堂推荐");
  });

  it("falls back to locationArea when title is missing", () => {
    const spec = defineMapBottomChromeForPlace({
      tid: "post-2" as any,
      locationArea: "北区",
      lat: 18.39,
      lng: 110.01,
    });
    expect(spec.buttons![0].label).toBe("查看 北区");
  });
});

describe("defineMapDefaultBottomChrome", () => {
  it("returns hidden spec with no buttons", () => {
    const spec = defineMapDefaultBottomChrome();
    expect(spec.visible).toBe(false);
    expect(spec.buttons).toEqual([]);
  });
});

describe("map chrome integration with useShellChrome", () => {
  it("applying top chrome sets filter buttons in shell state", () => {
    const chrome = useShellChrome();
    const filters = [{ id: "locations", label: "地点" }];
    chrome.setRegion("top", defineMapTopChrome(filters, { locations: true }));

    expect(chrome.state.top.visible).toBe(true);
    expect(chrome.state.top.buttons).toHaveLength(1);
    expect(chrome.state.top.buttons![0].id).toBe("filter-locations");
  });

  it("applying bottom chrome for place does not disturb top region", () => {
    const chrome = useShellChrome();
    const filters = [{ id: "locations", label: "地点" }];
    chrome.setRegion("top", defineMapTopChrome(filters, { locations: true }));

    chrome.setRegion("bottom", defineMapBottomChromeForPlace({
      id: "loc-1",
      name: "图书馆",
      lat: 18.39,
      lng: 110.01,
    }));

    expect(chrome.state.top.buttons).toHaveLength(1);
    expect(chrome.state.bottom.buttons).toHaveLength(2);
    expect(chrome.state.bottom.buttons![0].label).toBe("查看 图书馆");
  });

  it("resetting regions clears map chrome specs", () => {
    const chrome = useShellChrome();
    chrome.setRegion("top", defineMapTopChrome([{ id: "locations", label: "地点" }], { locations: true }));
    chrome.setRegion("bottom", defineMapBottomChromeForPlace({
      id: "loc-1", name: "图书馆", lat: 18.39, lng: 110.01,
    }));

    chrome.resetRegions();

    expect(chrome.state.top.buttons).toEqual([]);
    expect(chrome.state.bottom.buttons).toEqual([]);
    expect(chrome.state.bottom.visible).toBe(true);
  });

  it("toggling filter updates top chrome buttons", () => {
    const chrome = useShellChrome();
    const filters = [
      { id: "locations", label: "地点" },
      { id: "posts", label: "内容" },
    ];

    chrome.setRegion("top", defineMapTopChrome(filters, { locations: true, posts: true }));
    expect(chrome.state.top.buttons![0].label).toBe("✓ 地点");
    expect(chrome.state.top.buttons![1].label).toBe("✓ 内容");

    chrome.setRegion("top", defineMapTopChrome(filters, { locations: false, posts: true }));
    expect(chrome.state.top.buttons![0].label).toBe("地点");
    expect(chrome.state.top.buttons![1].label).toBe("✓ 内容");
  });
});
