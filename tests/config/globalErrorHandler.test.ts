import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createApp } from "vue";
import {
  installGlobalErrorHandler,
  removeGlobalErrorHandler,
} from "../../src/app/globalErrorHandler";

// Mock the toast state module
vi.mock("../../src/ui/feedback/toast-state", () => ({
  pushToast: vi.fn(),
}));

import { pushToast } from "../../src/ui/feedback/toast-state";

describe("globalErrorHandler", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp({ template: "<div />" });
  });

  afterEach(() => {
    removeGlobalErrorHandler(app);
  });

  describe("installGlobalErrorHandler", () => {
    it("sets app.config.errorHandler", () => {
      expect(app.config.errorHandler).toBeUndefined();
      installGlobalErrorHandler(app);
      expect(app.config.errorHandler).toBeDefined();
      expect(typeof app.config.errorHandler).toBe("function");
    });
  });

  describe("removeGlobalErrorHandler", () => {
    it("clears app.config.errorHandler", () => {
      installGlobalErrorHandler(app);
      expect(app.config.errorHandler).toBeDefined();
      removeGlobalErrorHandler(app);
      expect(app.config.errorHandler).toBeUndefined();
    });
  });

  describe("error filtering", () => {
    it("does not show toast for LianApiError", () => {
      installGlobalErrorHandler(app);

      const apiError = new Error("API failed");
      apiError.name = "LianApiError";

      // Call the error handler directly
      app.config.errorHandler!(apiError, null, "test");

      expect(pushToast).not.toHaveBeenCalled();
    });

    it("does not show toast for chunk loading errors", () => {
      installGlobalErrorHandler(app);

      const chunkError = new Error("Loading chunk 123 failed");

      app.config.errorHandler!(chunkError, null, "test");

      expect(pushToast).not.toHaveBeenCalled();
    });

    it("shows toast for unexpected errors", () => {
      installGlobalErrorHandler(app);

      const unexpectedError = new Error("Something went wrong");

      app.config.errorHandler!(unexpectedError, null, "test");

      expect(pushToast).toHaveBeenCalledWith(expect.any(String), { tone: "error" });
    });
  });
});
