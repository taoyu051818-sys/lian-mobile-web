import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAsyncOperation, useAsyncOperations } from "../../src/composables/useAsyncOperation";

describe("useAsyncOperation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with busy=false and empty errorMessage", () => {
    const { busy, errorMessage } = useAsyncOperation();
    expect(busy.value).toBe(false);
    expect(errorMessage.value).toBe("");
  });

  it("sets busy=true during operation and busy=false after", async () => {
    const { busy, run } = useAsyncOperation();
    let busyDuringOperation = false;

    await run(async () => {
      busyDuringOperation = busy.value;
      return "result";
    }, "fallback");

    expect(busyDuringOperation).toBe(true);
    expect(busy.value).toBe(false);
  });

  it("returns the result on success", async () => {
    const { run } = useAsyncOperation<string>();
    const result = await run(async () => "success", "fallback");
    expect(result).toBe("success");
  });

  it("calls onSuccess callback with result", async () => {
    const { run } = useAsyncOperation<string>();
    const onSuccess = vi.fn();

    await run(async () => "result", "fallback", onSuccess);

    expect(onSuccess).toHaveBeenCalledWith("result");
  });

  it("sets errorMessage on failure using extractErrorMessage", async () => {
    const { errorMessage, run } = useAsyncOperation();

    await run(async () => {
      throw new Error("API error");
    }, "fallback");

    expect(errorMessage.value).toBe("API error");
  });

  it("uses fallback message when error has no message", async () => {
    const { errorMessage, run } = useAsyncOperation();

    await run(async () => {
      throw "not an error object";
    }, "fallback message");

    expect(errorMessage.value).toBe("fallback message");
  });

  it("returns undefined on failure", async () => {
    const { run } = useAsyncOperation();

    const result = await run(async () => {
      throw new Error("fail");
    }, "fallback");

    expect(result).toBeUndefined();
  });

  it("clears errorMessage before each run", async () => {
    const { errorMessage, run } = useAsyncOperation();

    // First run fails
    await run(async () => {
      throw new Error("first error");
    }, "fallback");
    expect(errorMessage.value).toBe("first error");

    // Second run succeeds - error should be cleared
    await run(async () => "success", "fallback");
    expect(errorMessage.value).toBe("");
  });

  it("guards against concurrent execution", async () => {
    const { run } = useAsyncOperation();
    const callOrder: string[] = [];

    // Start first operation
    const firstPromise = run(async () => {
      callOrder.push("first-start");
      await new Promise((resolve) => setTimeout(resolve, 50));
      callOrder.push("first-end");
      return "first";
    }, "fallback");

    // Try to start second operation while first is running
    const secondResult = await run(async () => {
      callOrder.push("second");
      return "second";
    }, "fallback");

    await firstPromise;

    expect(secondResult).toBeUndefined();
    expect(callOrder).toEqual(["first-start", "first-end"]);
  });

  it("clearError clears the error message", async () => {
    const { errorMessage, run, clearError } = useAsyncOperation();

    await run(async () => {
      throw new Error("error");
    }, "fallback");
    expect(errorMessage.value).toBe("error");

    clearError();
    expect(errorMessage.value).toBe("");
  });

  it("reset clears both busy and errorMessage", async () => {
    const { busy, errorMessage, run, reset } = useAsyncOperation();

    await run(async () => {
      throw new Error("error");
    }, "fallback");

    reset();
    expect(busy.value).toBe(false);
    expect(errorMessage.value).toBe("");
  });

  it("sets busy=false even when onSuccess throws", async () => {
    const { busy, errorMessage, run } = useAsyncOperation();

    await run(
      async () => "result",
      "fallback",
      () => {
        throw new Error("onSuccess error");
      },
    );

    expect(busy.value).toBe(false);
    expect(errorMessage.value).toBe("onSuccess error");
  });
});

describe("useAsyncOperations", () => {
  it("creates independent operation handlers for each key", () => {
    const ops = useAsyncOperations(["save", "delete"] as const);

    expect(ops.save.busy.value).toBe(false);
    expect(ops.delete.busy.value).toBe(false);
    expect(ops.save.errorMessage.value).toBe("");
    expect(ops.delete.errorMessage.value).toBe("");
  });

  it("operations are independent - one busy does not affect another", async () => {
    const ops = useAsyncOperations(["save", "delete"] as const);

    const savePromise = ops.save.run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return "saved";
    }, "save failed");

    // While save is running, delete should not be busy
    expect(ops.save.busy.value).toBe(true);
    expect(ops.delete.busy.value).toBe(false);

    await savePromise;
  });

  it("operations have independent error states", async () => {
    const ops = useAsyncOperations(["save", "delete"] as const);

    await ops.save.run(async () => {
      throw new Error("save error");
    }, "save failed");

    await ops.delete.run(async () => "deleted", "delete failed");

    expect(ops.save.errorMessage.value).toBe("save error");
    expect(ops.delete.errorMessage.value).toBe("");
  });
});
