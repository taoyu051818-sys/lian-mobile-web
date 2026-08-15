/**
 * Mounts the fixture toolbar into its own Vue app on a detached host node.
 *
 * A separate app instance (rather than a component inside `App.vue`) keeps the
 * toolbar completely out of the product component tree: no provide/inject
 * leakage, no router coupling, and nothing to strip out of `App.vue` later.
 */

import { createApp } from "vue";

import FixtureToolbar from "./FixtureToolbar.vue";

const HOST_ID = "lian-fixture-toolbar-host";

export function mountFixtureToolbar(): void {
  if (typeof document === "undefined") return;
  // HMR can call this again; never stack two toolbars.
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);

  createApp(FixtureToolbar).mount(host);
}
