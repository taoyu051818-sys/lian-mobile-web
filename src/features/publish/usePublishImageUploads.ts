import { computed, ref, shallowRef, type ComputedRef } from "vue";
import { uploadPublishImage } from "../../api/publish";

export type PublishImageUploadStatus = "pending" | "uploading" | "uploaded" | "failed";

export interface PublishImageUploadEntry {
  readonly id: string;
  readonly file: File;
  readonly previewUrl: string;
  readonly status: PublishImageUploadStatus;
  readonly uploadedUrl: string | null;
}

export interface UsePublishImageUploadsOptions {
  upload?: (file: File) => Promise<string>;
  createId?: () => string;
  createObjectUrl?: (file: File) => string;
  revokeObjectUrl?: (url: string) => void;
  onError?: (error: unknown) => void;
}

export interface UsePublishImageUploadsResult {
  entries: ComputedRef<readonly PublishImageUploadEntry[]>;
  selectedFiles: ComputedRef<readonly File[]>;
  localPreviewUrls: ComputedRef<readonly string[]>;
  uploadedImageUrls: ComputedRef<readonly string[]>;
  uploading: ComputedRef<boolean>;
  addFiles: (files: readonly File[]) => Promise<void>;
  removeAt: (index: number) => void;
  reset: () => void;
  dispose: () => void;
}

interface UploadRunner {
  readonly ticket: number;
  readonly generation: number;
  readonly completion: Promise<void>;
  complete: () => void;
}

const EMPTY_ENTRIES: readonly PublishImageUploadEntry[] = Object.freeze([]);

function freezeEntries(entries: PublishImageUploadEntry[]): readonly PublishImageUploadEntry[] {
  return Object.freeze(entries);
}

/**
 * Owns the in-memory identity and asynchronous lifecycle of Publish images.
 *
 * Flat arrays remain available as compatibility projections, but an entry ID
 * and File reference decide whether an upload result still owns a visible
 * image. Numeric UI indexes are resolved synchronously and never cross an
 * await boundary.
 */
export function usePublishImageUploads(
  options: UsePublishImageUploadsOptions = {},
): UsePublishImageUploadsResult {
  const upload = options.upload ?? uploadPublishImage;
  const createObjectUrl = options.createObjectUrl ?? ((file: File) => URL.createObjectURL(file));
  const revokeObjectUrl = options.revokeObjectUrl ?? ((url: string) => URL.revokeObjectURL(url));

  let generatedId = 0;
  const createId = options.createId ?? (() => `publish-image-${++generatedId}`);

  const entryState = shallowRef<readonly PublishImageUploadEntry[]>(EMPTY_ENTRIES);
  const uploadingState = ref(false);
  const entries = computed(() => entryState.value);
  const selectedFiles = computed<readonly File[]>(() =>
    Object.freeze(entryState.value.map((entry) => entry.file)),
  );
  const localPreviewUrls = computed<readonly string[]>(() =>
    Object.freeze(entryState.value.map((entry) => entry.previewUrl)),
  );
  const uploadedImageUrls = computed<readonly string[]>(() =>
    Object.freeze(
      entryState.value.flatMap((entry) =>
        entry.status === "uploaded" && entry.uploadedUrl ? [entry.uploadedUrl] : [],
      ),
    ),
  );
  const uploading = computed(() => uploadingState.value);

  let generation = 0;
  let runnerTicket = 0;
  let activeRunner: UploadRunner | null = null;
  let disposed = false;

  function uniqueId(existingIds: Set<string>): string {
    const base = String(createId() || `publish-image-${++generatedId}`);
    if (!existingIds.has(base)) return base;

    let suffix = 2;
    let candidate = `${base}-${suffix}`;
    while (existingIds.has(candidate)) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }

  function replaceEntry(
    id: string,
    file: File,
    expectedStatus: PublishImageUploadStatus,
    nextState: Pick<PublishImageUploadEntry, "status" | "uploadedUrl">,
  ): boolean {
    const index = entryState.value.findIndex(
      (entry) => entry.id === id && entry.file === file && entry.status === expectedStatus,
    );
    if (index < 0) return false;

    const next = entryState.value.slice();
    next[index] = Object.freeze({ ...next[index], ...nextState });
    entryState.value = freezeEntries(next);
    return true;
  }

  function ownsRun(ticket: number, runGeneration: number): boolean {
    return (
      !disposed &&
      activeRunner?.ticket === ticket &&
      ticket === runnerTicket &&
      runGeneration === generation
    );
  }

  async function drain(ticket: number, runGeneration: number) {
    try {
      while (ownsRun(ticket, runGeneration)) {
        const pending = entryState.value.find((entry) => entry.status === "pending");
        if (!pending) return;

        const started = replaceEntry(pending.id, pending.file, "pending", {
          status: "uploading",
          uploadedUrl: null,
        });
        if (!started) continue;

        try {
          const uploadedUrl = await upload(pending.file);
          if (!ownsRun(ticket, runGeneration)) return;
          replaceEntry(pending.id, pending.file, "uploading", {
            status: "uploaded",
            uploadedUrl,
          });
        } catch (error) {
          if (!ownsRun(ticket, runGeneration)) return;
          const failed = replaceEntry(pending.id, pending.file, "uploading", {
            status: "failed",
            uploadedUrl: null,
          });
          if (failed) options.onError?.(error);
          return;
        }
      }
    } finally {
      if (ownsRun(ticket, runGeneration)) {
        const completed = activeRunner;
        activeRunner = null;
        uploadingState.value = false;
        completed?.complete();
      }
    }
  }

  function startDrain(): Promise<void> {
    if (disposed) return Promise.resolve();
    if (activeRunner) return activeRunner.completion;
    if (!entryState.value.some((entry) => entry.status === "pending")) {
      uploadingState.value = false;
      return Promise.resolve();
    }

    const ticket = ++runnerTicket;
    const runGeneration = generation;
    let complete!: () => void;
    const completion = new Promise<void>((resolve) => {
      complete = resolve;
    });
    // Install logical ownership before the physical drain starts. Besides
    // avoiding a sync-throw assignment race, the explicit logical completion
    // lets reset/dispose release callers without waiting for obsolete network
    // work, while removal can transfer completion to a replacement runner.
    const runner: UploadRunner = { ticket, generation: runGeneration, completion, complete };
    activeRunner = runner;
    uploadingState.value = true;
    void Promise.resolve().then(() => drain(ticket, runGeneration));
    return completion;
  }

  function invalidateRunner(releaseCompletion: boolean): UploadRunner | null {
    const previous = activeRunner;
    runnerTicket += 1;
    activeRunner = null;
    uploadingState.value = false;
    if (releaseCompletion) previous?.complete();
    return previous;
  }

  function addFiles(files: readonly File[]): Promise<void> {
    if (disposed || files.length === 0) return Promise.resolve();

    const existingIds = new Set(entryState.value.map((entry) => entry.id));
    const additions: PublishImageUploadEntry[] = [];
    try {
      for (const file of files) {
        const id = uniqueId(existingIds);
        existingIds.add(id);
        additions.push(
          Object.freeze({
            id,
            file,
            previewUrl: createObjectUrl(file),
            status: "pending" as const,
            uploadedUrl: null,
          }),
        );
      }
    } catch (error) {
      additions.forEach((entry) => revokeObjectUrl(entry.previewUrl));
      options.onError?.(error);
      return Promise.resolve();
    }

    entryState.value = freezeEntries([...entryState.value, ...additions]);
    return startDrain();
  }

  function removeAt(index: number) {
    const target = entryState.value[index];
    if (!target) return;

    const next = entryState.value.filter((entry) => entry.id !== target.id);
    entryState.value = freezeEntries(next);
    revokeObjectUrl(target.previewUrl);

    if (target.status === "uploading") {
      const replaced = invalidateRunner(false);
      const replacement = startDrain();
      void replacement.then(() => replaced?.complete());
      return;
    }
    void startDrain();
  }

  function clearEntries() {
    entryState.value.forEach((entry) => revokeObjectUrl(entry.previewUrl));
    entryState.value = EMPTY_ENTRIES;
  }

  function reset() {
    generation += 1;
    invalidateRunner(true);
    clearEntries();
  }

  function dispose() {
    if (disposed) return;
    generation += 1;
    invalidateRunner(true);
    clearEntries();
    disposed = true;
  }

  return {
    entries,
    selectedFiles,
    localPreviewUrls,
    uploadedImageUrls,
    uploading,
    addFiles,
    removeAt,
    reset,
    dispose,
  };
}
