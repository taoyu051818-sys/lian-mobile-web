/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_VISIBLE?: string;
  readonly VITE_COMMERCE_CATALOG_VISIBLE?: string;
  readonly VITE_COMMERCE_PRODUCT_VISIBLE?: string;
  /** Development-only UI fixture switch; ignored by production builds. */
  readonly VITE_UI_FIXTURES?: string;
  readonly VITE_UI_FIXTURE_SCENARIO?: string;
  /**
   * `"offline"` swaps the render-only fixture for the full offline transport:
   * every `/api/**` read is served from local fixtures and all cross-origin
   * traffic is blocked. Development-only, like the switches above.
   */
  readonly VITE_UI_FIXTURE_MODE?: string;
  /** Starting identity for offline fixture mode (guest/student/runner/...). */
  readonly VITE_UI_FIXTURE_IDENTITY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
