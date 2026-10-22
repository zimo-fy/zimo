import { describe, expect, it, vi } from "vitest";

import { documentImageDisplayUrl } from "@zimo/contracts";

import { serveDocumentImage } from "./document-image-response";

const ids = {
  conversationId: "11111111-1111-4111-8111-111111111111",
  artifactId: "22222222-2222-4222-8222-222222222222",
  revisionId: "33333333-3333-4333-8333-333333333333",
};

describe("document image protocol", () => {
  it("serves image bytes for a valid opaque url", async () => {
    const readDisplayImage = vi.fn(async () => ({
      mediaType: "image/jpeg",
      bytes: new Uint8Array([0xff, 0xd8, 0xff]),
    }));

    const response = await serveDocumentImage(documentImageDisplayUrl(ids), { readDisplayImage });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([0xff, 0xd8, 0xff]),
    );
    expect(readDisplayImage).toHaveBeenCalledWith(
      ids.conversationId,
      ids.artifactId,
      ids.revisionId,
    );
  });

  it("hides missing or non-image artifacts", async () => {
    const missing = await serveDocumentImage(documentImageDisplayUrl(ids), {
      readDisplayImage: async () => {
        throw new Error("missing");
      },
    });
    const invalid = await serveDocumentImage("https://example.com/shot.png", {
      readDisplayImage: async () => ({ mediaType: "image/png", bytes: new Uint8Array() }),
    });

    expect(missing.status).toBe(404);
    expect(invalid.status).toBe(404);
  });
});
