/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_VISIBLE?: string;
  readonly VITE_COMMERCE_CATALOG_VISIBLE?: string;
  readonly VITE_COMMERCE_PRODUCT_VISIBLE?: string;
  /** Development-only UI fixture switch; ignored by production builds. */
  readonly VITE_UI_FIXTURES?: string;
  readonly VITE_UI_FIXTURE_SCENARIO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
