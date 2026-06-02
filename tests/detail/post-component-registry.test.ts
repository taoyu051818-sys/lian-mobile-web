/**
 * PRD V0.3 §2.1.3 — focused tests for the V2 component renderer registry.
 *
 * The slot's job is to dispatch `metadata.components` (V2 array shape) to a
 * registry of renderers per type. These tests cover the contract feature
 * owners care about:
 *
 *   1. Registration round-trip (register → resolve → unregister → miss).
 *   2. selectRenderableComponents preserves source order, skips unknown
 *      types, and respects the optional `shouldRender` gate.
 *   3. Empty / missing inputs degrade gracefully (no throws).
 *
 * The slot itself is a thin v-for over `selectRenderableComponents`, so
 * the dispatch test pinned to the helper is enough; we don't mount Vue.
 */

import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import {
  __resetPostComponentRegistryForTests,
  registerPostComponentRenderer,
  resolvePostComponentRenderer,
  selectRenderableComponents,
  unregisterPostComponentRenderer,
} from "../../src/features/detail/postComponentRegistry";
import type {
  EventComponentV2,
  GroupbuyComponentV2,
  HelpComponentV2,
  LocationComponentV2,
  MerchantComponentV2,
} from "../../src/types/post-extensions";

const StubRenderer = defineComponent({
  name: "StubRenderer",
  props: { component: { type: Object, required: true } },
  setup(props) {
    return () => h("div", { "data-type": (props.component as { type: string }).type });
  },
});

const AltRenderer = defineComponent({
  name: "AltRenderer",
  setup() {
    return () => h("div");
  },
});

afterEach(() => {
  __resetPostComponentRegistryForTests();
});

describe("postComponentRegistry — register / resolve / unregister", () => {
  it("returns undefined for an unregistered type", () => {
    expect(resolvePostComponentRenderer("event")).toBeUndefined();
  });

  it("round-trips a registered renderer", () => {
    registerPostComponentRenderer("event", { component: StubRenderer });
    const entry = resolvePostComponentRenderer("event");
    expect(entry?.component).toBe(StubRenderer);
  });

  it("last-write-wins so feature owners can override defaults", () => {
    registerPostComponentRenderer("event", { component: StubRenderer });
    registerPostComponentRenderer("event", { component: AltRenderer });
    expect(resolvePostComponentRenderer("event")?.component).toBe(AltRenderer);
  });

  it("unregister removes the renderer", () => {
    registerPostComponentRenderer("event", { component: StubRenderer });
    unregisterPostComponentRenderer("event");
    expect(resolvePostComponentRenderer("event")).toBeUndefined();
  });
});

describe("postComponentRegistry — selectRenderableComponents dispatch", () => {
  it("returns [] for missing or empty input without throwing", () => {
    expect(selectRenderableComponents(undefined)).toEqual([]);
    expect(selectRenderableComponents([])).toEqual([]);
  });

  it("preserves source order across registered types", () => {
    registerPostComponentRenderer("event", { component: StubRenderer });
    registerPostComponentRenderer("location", { component: AltRenderer });
    const event: EventComponentV2 = { type: "event", eventId: "evt-1" };
    const location: LocationComponentV2 = { type: "location", placeId: "p-1", label: "图书馆" };
    const ordered = selectRenderableComponents([location, event]);
    expect(ordered.map((entry) => entry.component.type)).toEqual(["location", "event"]);
    // Resolver returns the same renderer instances we registered.
    expect(ordered[0].entry.component).toBe(AltRenderer);
    expect(ordered[1].entry.component).toBe(StubRenderer);
  });

  it("silently skips component types with no registered renderer", () => {
    registerPostComponentRenderer("event", { component: StubRenderer });
    const event: EventComponentV2 = { type: "event", eventId: "evt-1" };
    const help: HelpComponentV2 = { type: "help", helpId: "help-1" };
    const ordered = selectRenderableComponents([help, event]);
    expect(ordered.map((entry) => entry.component.type)).toEqual(["event"]);
  });

  it("respects the optional shouldRender gate", () => {
    // A renderer that only wants to render merchants whose name is non-empty.
    registerPostComponentRenderer<MerchantComponentV2>("merchant", {
      component: StubRenderer,
      shouldRender: (m) => Boolean(m.name && m.name.length > 0),
    });
    const named: MerchantComponentV2 = { type: "merchant", name: "李安小馆" };
    const blank: MerchantComponentV2 = { type: "merchant", name: "" };
    const ordered = selectRenderableComponents([blank, named]);
    expect(ordered.length).toBe(1);
    expect((ordered[0].component as MerchantComponentV2).name).toBe("李安小馆");
  });

  it("renders a registered group-buy component and skips it when no renderer is registered", () => {
    const groupbuy: GroupbuyComponentV2 = {
      type: "groupbuy",
      groupbuyId: "gb-1",
      state: "forming",
      participantCount: 3,
      targetCount: 5,
      channelId: "ch-1",
    };

    expect(selectRenderableComponents([groupbuy])).toEqual([]);

    registerPostComponentRenderer<GroupbuyComponentV2>("groupbuy", { component: StubRenderer });
    const ordered = selectRenderableComponents([groupbuy]);
    expect(ordered).toHaveLength(1);
    expect(ordered[0].component.type).toBe("groupbuy");
    expect(ordered[0].entry.component).toBe(StubRenderer);
  });

  it("allows unknown group-buy state values to flow to the renderer", () => {
    registerPostComponentRenderer<GroupbuyComponentV2>("groupbuy", { component: StubRenderer });
    const groupbuy: GroupbuyComponentV2 = {
      type: "groupbuy",
      groupbuyId: "gb-future",
      state: "backend_future_state",
    };

    const ordered = selectRenderableComponents([groupbuy]);
    expect((ordered[0].component as GroupbuyComponentV2).state).toBe("backend_future_state");
  });

  it("ignores malformed entries (null, non-object) without throwing", () => {
    registerPostComponentRenderer("event", { component: StubRenderer });
    const event: EventComponentV2 = { type: "event", eventId: "evt-1" };
    // Cast through unknown so we exercise the runtime defensive path even
    // though TS would block these inputs at the call site.
    const dirty = [null, "string", 7, event] as unknown as Parameters<
      typeof selectRenderableComponents
    >[0];
    expect(selectRenderableComponents(dirty).map((entry) => entry.component.type)).toEqual([
      "event",
    ]);
  });
});
