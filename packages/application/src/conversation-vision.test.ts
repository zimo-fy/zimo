import { describe, expect, it } from "vitest";

import {
  applyImagePartsToCurrentUserMessage,
  MODEL_VISION_UNSUPPORTED_MESSAGE,
  requireVisionCapability,
  visionUnsupportedError,
} from "./conversation-vision";

describe("conversation vision", () => {
  it("uses the product error copy when the model cannot accept images", () => {
    expect(visionUnsupportedError()).toMatchObject({
      code: "MODEL_VISION_UNSUPPORTED",
      userMessage: MODEL_VISION_UNSUPPORTED_MESSAGE,
    });
    expect(() => requireVisionCapability(true, false)).toThrowError(
      MODEL_VISION_UNSUPPORTED_MESSAGE,
    );
    expect(() => requireVisionCapability(true, true)).not.toThrow();
    expect(() => requireVisionCapability(false, false)).not.toThrow();
  });

  it("compiles the current user turn into OpenAI multimodal parts", () => {
    const messages = applyImagePartsToCurrentUserMessage(
      [
        { role: "system", content: "规则" },
        { role: "user", content: "这张图片里有什么？" },
      ],
      [
        {
          type: "image_url",
          image_url: { url: "data:image/jpeg;base64,abc" },
        },
      ],
    );

    expect(messages[1]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "这张图片里有什么？" },
        { type: "image_url", image_url: { url: "data:image/jpeg;base64,abc" } },
      ],
    });
  });
});
