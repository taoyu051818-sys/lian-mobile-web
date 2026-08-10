import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { isReadonly } from "vue";
import {
  usePublishImageUploads,
  type PublishImageUploadEntry,
} from "../../src/features/publish/usePublishImageUploads";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

interface UploadRequest extends Deferred<string> {
  file: File;
}

interface UploadHarness {
  uploads: ReturnType<typeof usePublishImageUploads>;
  requests: UploadRequest[];
  upload: ReturnType<typeof vi.fn<(file: File) => Promise<string>>>;
  createId: ReturnType<typeof vi.fn<() => string>>;
  createObjectUrl: ReturnType<typeof vi.fn<(file: File) => string>>;
  revokeObjectUrl: ReturnType<typeof vi.fn<(url: string) => void>>;
  onError: ReturnType<typeof vi.fn<(error: unknown) => void>>;
}

const activeUploads: Array<ReturnType<typeof usePublishImageUploads>> = [];

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function makeFile(
  name: string,
  content = name,
  options: { lastModified?: number; type?: string } = {},
): File {
  return new File([content], name, {
    type: options.type ?? "image/png",
    lastModified: options.lastModified ?? 1_700_000_000_000,
  });
}

function makeHarness(): UploadHarness {
  const requests: UploadRequest[] = [];
  const upload = vi.fn<(file: File) => Promise<string>>((file) => {
    const request = { file, ...deferred<string>() };
    requests.push(request);
    return request.promise;
  });
  let nextId = 0;
  let nextPreview = 0;
  const createId = vi.fn(() => `entry-${++nextId}`);
  const createObjectUrl = vi.fn((file: File) => `blob:preview-${++nextPreview}-${file.name}`);
  const revokeObjectUrl = vi.fn<(url: string) => void>();
  const onError = vi.fn<(error: unknown) => void>();
  const uploads = usePublishImageUploads({
    upload,
    createId,
    createObjectUrl,
    revokeObjectUrl,
    onError,
  });
  activeUploads.push(uploads);
  return {
    uploads,
    requests,
    upload,
    createId,
    createObjectUrl,
    revokeObjectUrl,
    onError,
  };
}

async function flushAsync() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

function requestAt(harness: UploadHarness, index: number): UploadRequest {
  const request = harness.requests[index];
  expect(request, `expected upload request ${index}`).toBeDefined();
  return request!;
}

function entrySummary(harness: UploadHarness) {
  return harness.uploads.entries.value.map((entry) => ({
    id: entry.id,
    file: entry.file,
    previewUrl: entry.previewUrl,
    status: entry.status,
    uploadedUrl: entry.uploadedUrl,
  }));
}

afterEach(() => {
  for (const uploads of activeUploads.splice(0)) uploads.dispose();
  vi.restoreAllMocks();
});

describe("usePublishImageUploads ownership and ordering", () => {
  it("uploads a stable happy-path queue sequentially and preserves every flat projection", async () => {
    const h = makeHarness();
    const a = makeFile("a.png");
    const b = makeFile("b.png");
    const c = makeFile("c.png");

    const run = h.uploads.addFiles([a, b, c]);
    await flushAsync();
    expect(h.requests.map((request) => request.file)).toEqual([a]);
    expect(h.uploads.uploading.value).toBe(true);

    requestAt(h, 0).resolve("https://cdn.test/a.png");
    await flushAsync();
    expect(h.requests.map((request) => request.file)).toEqual([a, b]);
    expect(h.uploads.uploadedImageUrls.value).toEqual(["https://cdn.test/a.png"]);

    requestAt(h, 1).resolve("https://cdn.test/b.png");
    await flushAsync();
    expect(h.requests.map((request) => request.file)).toEqual([a, b, c]);

    requestAt(h, 2).resolve("https://cdn.test/c.png");
    await run;
    await flushAsync();

    expect(h.upload).toHaveBeenCalledTimes(3);
    expect(h.uploads.selectedFiles.value).toEqual([a, b, c]);
    expect(h.uploads.localPreviewUrls.value).toEqual([
      "blob:preview-1-a.png",
      "blob:preview-2-b.png",
      "blob:preview-3-c.png",
    ]);
    expect(h.uploads.uploadedImageUrls.value).toEqual([
      "https://cdn.test/a.png",
      "https://cdn.test/b.png",
      "https://cdn.test/c.png",
    ]);
    expect(entrySummary(h)).toMatchObject([
      { id: "entry-1", file: a, status: "uploaded", uploadedUrl: "https://cdn.test/a.png" },
      { id: "entry-2", file: b, status: "uploaded", uploadedUrl: "https://cdn.test/b.png" },
      { id: "entry-3", file: c, status: "uploaded", uploadedUrl: "https://cdn.test/c.png" },
    ]);
    expect(h.uploads.uploading.value).toBe(false);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it("appends B and C during A without duplicating or skipping any selection instance", async () => {
    const h = makeHarness();
    const a = makeFile("a.png");
    const b = makeFile("b.png");
    const c = makeFile("c.png");

    const firstRun = h.uploads.addFiles([a]);
    await flushAsync();
    const appendRun = h.uploads.addFiles([b, c]);
    await flushAsync();
    expect(h.requests.map((request) => request.file)).toEqual([a]);
    expect(h.uploads.selectedFiles.value).toEqual([a, b, c]);

    requestAt(h, 0).resolve("https://cdn.test/a.png");
    await flushAsync();
    expect(h.requests.map((request) => request.file)).toEqual([a, b]);
    requestAt(h, 1).resolve("https://cdn.test/b.png");
    await flushAsync();
    expect(h.requests.map((request) => request.file)).toEqual([a, b, c]);
    requestAt(h, 2).resolve("https://cdn.test/c.png");
    await Promise.all([firstRun, appendRun]);
    await flushAsync();

    expect(h.upload.mock.calls.map(([file]) => file)).toEqual([a, b, c]);
    expect(h.uploads.uploadedImageUrls.value).toEqual([
      "https://cdn.test/a.png",
      "https://cdn.test/b.png",
      "https://cdn.test/c.png",
    ]);
    expect(h.uploads.entries.value.map((entry) => entry.id)).toEqual([
      "entry-1",
      "entry-2",
      "entry-3",
    ]);
  });

  it("removes the currently uploading first entry and starts the remaining entry immediately", async () => {
    const h = makeHarness();
    const a = makeFile("a.png");
    const b = makeFile("b.png");

    let oldRunSettled = false;
    const oldRun = h.uploads.addFiles([a, b]).then(() => {
      oldRunSettled = true;
    });
    await flushAsync();
    const bId = h.uploads.entries.value[1]?.id;

    h.uploads.removeAt(0);
    await flushAsync();
    expect(h.requests.map((request) => request.file)).toEqual([a, b]);
    expect(h.uploads.entries.value.map((entry) => entry.id)).toEqual([bId]);
    expect(h.uploads.entries.value[0]?.status).toBe("uploading");
    expect(h.revokeObjectUrl).toHaveBeenCalledWith("blob:preview-1-a.png");

    requestAt(h, 0).resolve("https://cdn.test/stale-a.png");
    await flushAsync();
    expect(oldRunSettled).toBe(false);
    expect(h.uploads.uploadedImageUrls.value).toEqual([]);
    expect(h.uploads.uploading.value).toBe(true);

    requestAt(h, 1).resolve("https://cdn.test/b.png");
    await oldRun;
    await flushAsync();
    expect(oldRunSettled).toBe(true);
    expect(h.uploads.selectedFiles.value).toEqual([b]);
    expect(h.uploads.uploadedImageUrls.value).toEqual(["https://cdn.test/b.png"]);
    expect(h.uploads.uploading.value).toBe(false);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it("removes the currently uploading middle entry without letting its result occupy C", async () => {
    const h = makeHarness();
    const a = makeFile("a.png");
    const b = makeFile("b.png");
    const c = makeFile("c.png");

    let oldRunSettled = false;
    const oldRun = h.uploads.addFiles([a, b, c]).then(() => {
      oldRunSettled = true;
    });
    await flushAsync();
    requestAt(h, 0).resolve("https://cdn.test/a.png");
    await flushAsync();
    expect(h.requests.map((request) => request.file)).toEqual([a, b]);

    h.uploads.removeAt(1);
    await flushAsync();
    expect(h.requests.map((request) => request.file)).toEqual([a, b, c]);
    expect(h.uploads.selectedFiles.value).toEqual([a, c]);

    requestAt(h, 1).resolve("https://cdn.test/stale-b.png");
    await flushAsync();
    expect(oldRunSettled).toBe(false);
    expect(h.uploads.uploadedImageUrls.value).toEqual(["https://cdn.test/a.png"]);
    expect(h.uploads.uploading.value).toBe(true);

    requestAt(h, 2).resolve("https://cdn.test/c.png");
    await oldRun;
    await flushAsync();
    expect(oldRunSettled).toBe(true);
    expect(h.upload.mock.calls.map(([file]) => file)).toEqual([a, b, c]);
    expect(h.uploads.selectedFiles.value).toEqual([a, c]);
    expect(h.uploads.uploadedImageUrls.value).toEqual([
      "https://cdn.test/a.png",
      "https://cdn.test/c.png",
    ]);
    expect(h.uploads.uploadedImageUrls.value).not.toContain("https://cdn.test/stale-b.png");
    expect(h.uploads.uploading.value).toBe(false);
  });

  it("keeps B in flight when a previously uploaded A is removed before it", async () => {
    const h = makeHarness();
    const a = makeFile("a.png");
    const b = makeFile("b.png");
    const c = makeFile("c.png");

    const run = h.uploads.addFiles([a, b, c]);
    await flushAsync();
    requestAt(h, 0).resolve("https://cdn.test/a.png");
    await flushAsync();
    const [aEntry, bEntry, cEntry] = h.uploads.entries.value;
    expect(h.requests.map((request) => request.file)).toEqual([a, b]);

    h.uploads.removeAt(0);
    await flushAsync();
    expect(h.requests.map((request) => request.file)).toEqual([a, b]);
    expect(h.uploads.entries.value.map((entry) => entry.id)).toEqual([bEntry?.id, cEntry?.id]);
    expect(h.uploads.entries.value.map((entry) => entry.id)).not.toContain(aEntry?.id);

    requestAt(h, 1).resolve("https://cdn.test/b.png");
    await flushAsync();
    expect(h.requests.map((request) => request.file)).toEqual([a, b, c]);
    requestAt(h, 2).resolve("https://cdn.test/c.png");
    await run;
    await flushAsync();

    expect(h.upload.mock.calls.map(([file]) => file)).toEqual([a, b, c]);
    expect(h.uploads.selectedFiles.value).toEqual([b, c]);
    expect(h.uploads.uploadedImageUrls.value).toEqual([
      "https://cdn.test/b.png",
      "https://cdn.test/c.png",
    ]);
  });

  it("lets B start after reset and ignores A success and finally while B is pending", async () => {
    const h = makeHarness();
    const a = makeFile("alice.png");
    const b = makeFile("bob.png");

    const oldRun = h.uploads.addFiles([a]);
    await flushAsync();
    h.uploads.reset();
    const newRun = h.uploads.addFiles([b]);
    await flushAsync();

    expect(h.requests.map((request) => request.file)).toEqual([a, b]);
    expect(h.uploads.selectedFiles.value).toEqual([b]);
    expect(h.uploads.uploading.value).toBe(true);

    requestAt(h, 0).resolve("https://cdn.test/stale-alice.png");
    await oldRun;
    await flushAsync();
    expect(h.uploads.entries.value).toHaveLength(1);
    expect(h.uploads.entries.value[0]?.file).toBe(b);
    expect(h.uploads.uploadedImageUrls.value).toEqual([]);
    expect(h.uploads.uploading.value).toBe(true);
    expect(h.onError).not.toHaveBeenCalled();

    requestAt(h, 1).resolve("https://cdn.test/bob.png");
    await newRun;
    await flushAsync();
    expect(h.uploads.uploadedImageUrls.value).toEqual(["https://cdn.test/bob.png"]);
    expect(h.uploads.uploading.value).toBe(false);
  });

  it("settles an invalidated logical run immediately instead of awaiting stale network work", async () => {
    const h = makeHarness();
    const a = makeFile("alice.png");
    let settled = false;

    const oldRun = h.uploads.addFiles([a]).then(() => {
      settled = true;
    });
    await flushAsync();
    h.uploads.reset();
    await flushAsync();

    expect(settled).toBe(true);
    expect(h.uploads.uploading.value).toBe(false);
    expect(h.uploads.entries.value).toEqual([]);

    requestAt(h, 0).resolve("https://cdn.test/stale-alice.png");
    await oldRun;
    await flushAsync();
    expect(h.uploads.uploadedImageUrls.value).toEqual([]);
  });

  it("ignores A rejection and stale finally after reset without clearing B busy or erroring B", async () => {
    const h = makeHarness();
    const a = makeFile("alice.png");
    const b = makeFile("bob.png");

    const oldRun = h.uploads.addFiles([a]);
    await flushAsync();
    h.uploads.reset();
    const newRun = h.uploads.addFiles([b]);
    await flushAsync();

    requestAt(h, 0).reject(new Error("Alice upload failed late"));
    await oldRun;
    await flushAsync();
    expect(h.onError).not.toHaveBeenCalled();
    expect(h.uploads.uploading.value).toBe(true);
    expect(h.uploads.entries.value[0]?.file).toBe(b);
    expect(h.uploads.entries.value[0]?.status).toBe("uploading");

    requestAt(h, 1).resolve("https://cdn.test/bob.png");
    await newRun;
    await flushAsync();
    expect(h.uploads.uploadedImageUrls.value).toEqual(["https://cdn.test/bob.png"]);
    expect(h.uploads.uploading.value).toBe(false);
  });

  it("keeps C authoritative across stacked remove and reset invalidations", async () => {
    const h = makeHarness();
    const a = makeFile("a.png");
    const b = makeFile("b.png");
    const c = makeFile("c.png");
    let aLogicalSettled = false;

    const aRun = h.uploads.addFiles([a, b]).then(() => {
      aLogicalSettled = true;
    });
    await flushAsync();
    h.uploads.removeAt(0);
    await flushAsync();
    expect(aLogicalSettled).toBe(false);
    expect(h.requests.map((request) => request.file)).toEqual([a, b]);

    h.uploads.reset();
    const cRun = h.uploads.addFiles([c]);
    await flushAsync();
    expect(aLogicalSettled).toBe(true);
    expect(h.requests.map((request) => request.file)).toEqual([a, b, c]);
    expect(h.uploads.uploading.value).toBe(true);

    requestAt(h, 0).resolve("https://cdn.test/stale-a.png");
    requestAt(h, 1).reject(new Error("stale b failed"));
    await aRun;
    await flushAsync();
    expect(h.uploads.selectedFiles.value).toEqual([c]);
    expect(h.uploads.uploadedImageUrls.value).toEqual([]);
    expect(h.uploads.uploading.value).toBe(true);
    expect(h.onError).not.toHaveBeenCalled();

    requestAt(h, 2).resolve("https://cdn.test/c.png");
    await cRun;
    await flushAsync();
    expect(h.uploads.uploadedImageUrls.value).toEqual(["https://cdn.test/c.png"]);
    expect(h.uploads.uploading.value).toBe(false);
  });

  it("drops A when reset wins after A resolves but before its continuation commits", async () => {
    const h = makeHarness();
    const a = makeFile("alice.png");
    const b = makeFile("bob.png");

    const oldRun = h.uploads.addFiles([a]);
    await flushAsync();
    requestAt(h, 0).resolve("https://cdn.test/stale-alice.png");
    h.uploads.reset();
    const newRun = h.uploads.addFiles([b]);
    await flushAsync();

    expect(h.requests.map((request) => request.file)).toEqual([a, b]);
    expect(h.uploads.selectedFiles.value).toEqual([b]);
    expect(h.uploads.uploadedImageUrls.value).toEqual([]);
    expect(h.uploads.uploading.value).toBe(true);

    requestAt(h, 1).resolve("https://cdn.test/bob.png");
    await Promise.all([oldRun, newRun]);
    await flushAsync();
    expect(h.uploads.uploadedImageUrls.value).toEqual(["https://cdn.test/bob.png"]);
    expect(h.uploads.uploadedImageUrls.value).not.toContain("https://cdn.test/stale-alice.png");
  });

  it("surfaces a current failure, marks only that entry failed, and releases busy", async () => {
    const h = makeHarness();
    const a = makeFile("a.png");
    const failure = new Error("current upload failed");

    const run = h.uploads.addFiles([a]);
    await flushAsync();
    requestAt(h, 0).reject(failure);
    await run;
    await flushAsync();

    expect(h.onError).toHaveBeenCalledTimes(1);
    expect(h.onError).toHaveBeenCalledWith(failure);
    expect(h.uploads.uploading.value).toBe(false);
    expect(h.uploads.selectedFiles.value).toEqual([a]);
    expect(h.uploads.uploadedImageUrls.value).toEqual([]);
    expect(entrySummary(h)).toMatchObject([
      { id: "entry-1", file: a, status: "failed", uploadedUrl: null },
    ]);
  });

  it("resumes old pending work in order after an asynchronous failure is removed", async () => {
    const h = makeHarness();
    const a = makeFile("a.png");
    const b = makeFile("b.png");
    const c = makeFile("c.png");

    const failedRun = h.uploads.addFiles([a, b]);
    await flushAsync();
    requestAt(h, 0).reject(new Error("a failed"));
    await failedRun;
    await flushAsync();
    expect(h.uploads.entries.value.map((entry) => entry.status)).toEqual(["failed", "pending"]);

    const resumedRun = h.uploads.addFiles([c]);
    await flushAsync();
    expect(h.requests.map((request) => request.file)).toEqual([a, b]);
    h.uploads.removeAt(0);
    requestAt(h, 1).resolve("https://cdn.test/b.png");
    await flushAsync();
    expect(h.requests.map((request) => request.file)).toEqual([a, b, c]);
    requestAt(h, 2).resolve("https://cdn.test/c.png");
    await resumedRun;
    await flushAsync();

    expect(h.upload.mock.calls.map(([file]) => file)).toEqual([a, b, c]);
    expect(h.uploads.selectedFiles.value).toEqual([b, c]);
    expect(h.uploads.uploadedImageUrls.value).toEqual([
      "https://cdn.test/b.png",
      "https://cdn.test/c.png",
    ]);
  });

  it("installs runner ownership before a synchronous uploader throw and can drain later work", async () => {
    const h = makeHarness();
    const a = makeFile("a.png");
    const b = makeFile("b.png");
    const failure = new Error("synchronous uploader failure");
    h.upload.mockImplementation((file) => {
      if (file === a) throw failure;
      return Promise.resolve("https://cdn.test/b.png");
    });

    await h.uploads.addFiles([a, b]);
    await flushAsync();
    expect(entrySummary(h)).toMatchObject([
      { file: a, status: "failed", uploadedUrl: null },
      { file: b, status: "pending", uploadedUrl: null },
    ]);
    expect(h.onError).toHaveBeenCalledWith(failure);

    h.uploads.removeAt(0);
    await flushAsync();
    expect(h.upload.mock.calls.map(([file]) => file)).toEqual([a, b]);
    expect(h.uploads.selectedFiles.value).toEqual([b]);
    expect(h.uploads.uploadedImageUrls.value).toEqual(["https://cdn.test/b.png"]);
    expect(h.uploads.uploading.value).toBe(false);
  });

  it("exposes entries and flat projections as frozen read-only views", async () => {
    const h = makeHarness();
    const a = makeFile("a.png");
    const run = h.uploads.addFiles([a]);
    await flushAsync();

    expectTypeOf(h.uploads.entries.value).toEqualTypeOf<readonly PublishImageUploadEntry[]>();
    expectTypeOf(h.uploads.selectedFiles.value).toEqualTypeOf<readonly File[]>();
    expectTypeOf(h.uploads.localPreviewUrls.value).toEqualTypeOf<readonly string[]>();
    expectTypeOf(h.uploads.uploadedImageUrls.value).toEqualTypeOf<readonly string[]>();
    expect(isReadonly(h.uploads.entries)).toBe(true);
    expect(isReadonly(h.uploads.selectedFiles)).toBe(true);
    expect(isReadonly(h.uploads.localPreviewUrls)).toBe(true);
    expect(isReadonly(h.uploads.uploadedImageUrls)).toBe(true);
    expect(isReadonly(h.uploads.uploading)).toBe(true);
    expect(Object.isFrozen(h.uploads.entries.value)).toBe(true);
    expect(Object.isFrozen(h.uploads.entries.value[0])).toBe(true);
    expect(Object.isFrozen(h.uploads.selectedFiles.value)).toBe(true);
    expect(Object.isFrozen(h.uploads.localPreviewUrls.value)).toBe(true);
    expect(Object.isFrozen(h.uploads.uploadedImageUrls.value)).toBe(true);

    const selectedView = h.uploads.selectedFiles.value;
    expect(() => (selectedView as File[]).splice(0, 1)).toThrow(TypeError);
    expect(h.uploads.entries.value).toHaveLength(1);
    expect(h.uploads.selectedFiles.value).toEqual([a]);

    h.uploads.reset();
    requestAt(h, 0).resolve("https://cdn.test/stale-a.png");
    await run;
  });

  it("uses selection-instance IDs when two File objects have identical metadata", async () => {
    const h = makeHarness();
    const a = makeFile("same.png", "same", { lastModified: 123 });
    const b = makeFile("same.png", "same", { lastModified: 123 });
    expect({ name: a.name, size: a.size, modified: a.lastModified }).toEqual({
      name: b.name,
      size: b.size,
      modified: b.lastModified,
    });
    expect(a).not.toBe(b);

    const run = h.uploads.addFiles([a, b]);
    await flushAsync();
    requestAt(h, 0).resolve("https://cdn.test/same-1.png");
    await flushAsync();
    requestAt(h, 1).resolve("https://cdn.test/same-2.png");
    await run;
    await flushAsync();

    expect(h.createId).toHaveBeenCalledTimes(2);
    expect(h.upload.mock.calls.map(([file]) => file)).toEqual([a, b]);
    expect(h.uploads.entries.value.map((entry) => entry.id)).toEqual(["entry-1", "entry-2"]);
    expect(new Set(h.uploads.entries.value.map((entry) => entry.id)).size).toBe(2);
    expect(h.uploads.uploadedImageUrls.value).toEqual([
      "https://cdn.test/same-1.png",
      "https://cdn.test/same-2.png",
    ]);
  });

  it("revokes each owned preview exactly once across remove, reset, dispose, and late completion", async () => {
    const h = makeHarness();
    const a = makeFile("a.png");
    const b = makeFile("b.png");
    const c = makeFile("c.png");

    const runA = h.uploads.addFiles([a]);
    await flushAsync();
    h.uploads.removeAt(0);
    await flushAsync();

    const runB = h.uploads.addFiles([b]);
    await flushAsync();
    h.uploads.reset();

    const runC = h.uploads.addFiles([c]);
    await flushAsync();
    h.uploads.dispose();
    h.uploads.dispose();

    requestAt(h, 0).resolve("https://cdn.test/stale-a.png");
    requestAt(h, 1).resolve("https://cdn.test/stale-b.png");
    requestAt(h, 2).resolve("https://cdn.test/stale-c.png");
    await Promise.all([runA, runB, runC]);
    await flushAsync();

    expect(h.createObjectUrl).toHaveBeenCalledTimes(3);
    expect(h.revokeObjectUrl.mock.calls.map(([url]) => url)).toEqual([
      "blob:preview-1-a.png",
      "blob:preview-2-b.png",
      "blob:preview-3-c.png",
    ]);
    expect(h.uploads.entries.value).toEqual([]);
    expect(h.uploads.selectedFiles.value).toEqual([]);
    expect(h.uploads.localPreviewUrls.value).toEqual([]);
    expect(h.uploads.uploadedImageUrls.value).toEqual([]);
    expect(h.uploads.uploading.value).toBe(false);
    expect(h.onError).not.toHaveBeenCalled();
  });
});
