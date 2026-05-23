import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("auth-link API client", () => {
  const apiSource = readRepoFile("../../src/api/authLink.ts");

  it("exports fetchAuthLinkCard function", () => {
    expect(apiSource).toContain("export async function fetchAuthLinkCard");
  });

  it("exports redeemAuthLink function", () => {
    expect(apiSource).toContain("export async function redeemAuthLink");
  });

  it("exports AuthLinkError class", () => {
    expect(apiSource).toContain("export class AuthLinkError");
  });

  it("maps 404 to not-found error reason", () => {
    expect(apiSource).toContain('if (status === 404) return "not-found"');
  });

  it("maps 410 to expired error reason", () => {
    expect(apiSource).toContain('if (status === 410 || code === "expired") return "expired"');
  });

  it("maps 409 to exhausted error reason", () => {
    expect(apiSource).toContain('if (status === 409 || code === "exhausted") return "exhausted"');
  });

  it("calls the correct card endpoint", () => {
    expect(apiSource).toContain("/api/auth-link/${sanitized}/card");
  });

  it("calls the correct redeem endpoint", () => {
    expect(apiSource).toContain("/api/auth/redeem-link");
  });
});

describe("auth-link redeem composable", () => {
  const composableSource = readRepoFile("../../src/features/auth/useAuthLinkRedeem.ts");

  it("exports useAuthLinkRedeem function", () => {
    expect(composableSource).toContain("export function useAuthLinkRedeem");
  });

  it("reads link token from URL search params", () => {
    expect(composableSource).toContain('params.get("link")');
  });

  it("clears link token from URL after redeem", () => {
    expect(composableSource).toContain('url.searchParams.delete("link")');
  });

  it("exposes open state", () => {
    expect(composableSource).toContain("open: isOpen");
  });

  it("exposes card state", () => {
    expect(composableSource).toContain("card,");
  });

  it("exposes redeem function", () => {
    expect(composableSource).toContain("redeem,");
  });

  it("exposes retry function", () => {
    expect(composableSource).toContain("retry,");
  });

  it("exposes close function", () => {
    expect(composableSource).toContain("close,");
  });

  it("calls onRedeemed callback on success", () => {
    expect(composableSource).toContain("onRedeemed?.()");
  });
});

describe("auth-link redeem sheet", () => {
  const sheetSource = readRepoFile("../../src/features/auth/AuthLinkRedeemSheet.vue");

  it("renders loading state", () => {
    expect(sheetSource).toContain('data-testid="auth-link-loading"');
  });

  it("renders error state", () => {
    expect(sheetSource).toContain('data-testid="auth-link-error"');
  });

  it("renders success state", () => {
    expect(sheetSource).toContain('data-testid="auth-link-success"');
  });

  it("renders card preview", () => {
    expect(sheetSource).toContain('data-testid="auth-link-preview"');
  });

  it("renders redeem button", () => {
    expect(sheetSource).toContain('data-testid="auth-link-redeem"');
  });

  it("renders retry button for network errors", () => {
    expect(sheetSource).toContain('data-testid="auth-link-retry"');
  });

  it("emits close event", () => {
    expect(sheetSource).toContain('emit("close")');
  });

  it("emits redeem event", () => {
    expect(sheetSource).toContain("@click=\"emit('redeem')\"");
  });

  it("emits retry event", () => {
    expect(sheetSource).toContain("@click=\"emit('retry')\"");
  });
});

describe("AuthPanel auth-link integration", () => {
  const panelSource = readRepoFile("../../src/features/auth/AuthPanel.vue");

  it("imports useAuthLinkRedeem composable", () => {
    expect(panelSource).toContain('import { useAuthLinkRedeem } from "./useAuthLinkRedeem"');
  });

  it("imports AuthLinkRedeemSheet component", () => {
    expect(panelSource).toContain('import AuthLinkRedeemSheet from "./AuthLinkRedeemSheet.vue"');
  });

  it("uses the auth-link composable", () => {
    expect(panelSource).toContain("const authLink = useAuthLinkRedeem");
  });

  it("renders AuthLinkRedeemSheet component", () => {
    expect(panelSource).toContain("<AuthLinkRedeemSheet");
  });

  it("passes open state to sheet", () => {
    expect(panelSource).toContain(":open=\"authLink.open.value\"");
  });

  it("passes status to sheet", () => {
    expect(panelSource).toContain(":status=\"authLink.status.value\"");
  });

  it("passes card to sheet", () => {
    expect(panelSource).toContain(":card=\"authLink.card.value\"");
  });

  it("handles close event", () => {
    expect(panelSource).toContain("@close=\"authLink.close\"");
  });

  it("handles redeem event", () => {
    expect(panelSource).toContain("@redeem=\"authLink.redeem\"");
  });

  it("handles retry event", () => {
    expect(panelSource).toContain("@retry=\"authLink.retry\"");
  });
});

describe("auth-link brand copy", () => {
  const brandSource = readRepoFile("../../src/config/brand/auth.ts");

  it("exports AUTH_LINK_SHEET_TITLE", () => {
    expect(brandSource).toContain("AUTH_LINK_SHEET_TITLE");
  });

  it("exports AUTH_LINK_REDEEM", () => {
    expect(brandSource).toContain("AUTH_LINK_REDEEM");
  });

  it("exports AUTH_LINK_ERROR_NOT_FOUND", () => {
    expect(brandSource).toContain("AUTH_LINK_ERROR_NOT_FOUND");
  });

  it("exports AUTH_LINK_ERROR_EXPIRED", () => {
    expect(brandSource).toContain("AUTH_LINK_ERROR_EXPIRED");
  });

  it("exports AUTH_LINK_ERROR_EXHAUSTED", () => {
    expect(brandSource).toContain("AUTH_LINK_ERROR_EXHAUSTED");
  });

  it("exports AUTH_LINK_ERROR_NETWORK", () => {
    expect(brandSource).toContain("AUTH_LINK_ERROR_NETWORK");
  });

  it("exports AUTH_LINK_REDEEM_SUCCESS", () => {
    expect(brandSource).toContain("AUTH_LINK_REDEEM_SUCCESS");
  });
});
