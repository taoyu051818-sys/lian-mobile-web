import { describe, expect, it } from "vitest";
import {
  MAX_PUBLISH_IMAGE_BYTES,
  MAX_PUBLISH_IMAGE_COUNT,
  PUBLISH_IMAGE_HELP_TEXT,
  PUBLISH_IMAGE_PRIVACY_NOTICE,
  validatePublishImageFile,
  validatePublishImageSelection,
} from "../../src/api/publish";

function createMockFile(type: string, size: number) {
  return { name: "mock-file", type, size } as File;
}

describe("publish image upload validation", () => {
  it("accepts a valid image without an inline warning", () => {
    const result = validatePublishImageSelection([createMockFile("image/png", 1024)], 0);
    expect(result.acceptedFiles).toHaveLength(1);
    expect(result.message).toBe("");
  });

  it("rejects non-image files and oversized uploads with a user-facing message", () => {
    const result = validatePublishImageSelection(
      [
        createMockFile("text/plain", 128),
        createMockFile("image/jpeg", MAX_PUBLISH_IMAGE_BYTES + 1),
      ],
      0,
    );

    expect(result.acceptedFiles).toHaveLength(0);
    expect(result.message).toContain("非图片文件");
    expect(result.message).toContain("超过 10 MB");
  });

  it("keeps the publish image count within the current limit", () => {
    const result = validatePublishImageSelection(
      [createMockFile("image/webp", 1024), createMockFile("image/webp", 1024)],
      MAX_PUBLISH_IMAGE_COUNT - 1,
    );

    expect(result.acceptedFiles).toHaveLength(1);
    expect(result.message).toContain(`最多只能上传 ${MAX_PUBLISH_IMAGE_COUNT} 张图片`);
  });

  it("uses the same single-file guard for direct upload calls", () => {
    expect(validatePublishImageFile(createMockFile("image/gif", MAX_PUBLISH_IMAGE_BYTES))).toBe("");
    expect(validatePublishImageFile(createMockFile("application/pdf", 256))).toBe(
      "请上传图片文件。",
    );
  });

  it("ships publish image help copy that explains the validation scope", () => {
    expect(PUBLISH_IMAGE_HELP_TEXT).toContain(`${MAX_PUBLISH_IMAGE_COUNT} 张`);
    expect(PUBLISH_IMAGE_HELP_TEXT).toContain("10 MB");
    expect(PUBLISH_IMAGE_PRIVACY_NOTICE).toContain("基础格式和大小校验");
    expect(PUBLISH_IMAGE_PRIVACY_NOTICE).toContain("后端已确认的上传 contract");
    expect(PUBLISH_IMAGE_PRIVACY_NOTICE).not.toContain("元数据清理由服务端负责");
  });
});
