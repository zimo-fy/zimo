import { describe, expect, it } from "vitest";

import { documentImageDisplayUrl, parseDocumentImageDisplayUrl } from "./document-image-url";

const ids = {
  conversationId: "11111111-1111-4111-8111-111111111111",
  artifactId: "22222222-2222-4222-8222-222222222222",
  revisionId: "33333333-3333-4333-8333-333333333333",
};

describe("document image display URL", () => {
  it("round-trips opaque ids without a filesystem path", () => {
    const url = documentImageDisplayUrl(ids);
    expect(url).toBe(
      "zimo-doc://v1/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333",
    );
    expect(parseDocumentImageDisplayUrl(url)).toEqual(ids);
  });

  it("rejects path escape, extra query, and non-uuid hosts", () => {
    expect(parseDocumentImageDisplayUrl("file:///tmp/shot.png")).toBeNull();
    expect(parseDocumentImageDisplayUrl(`${documentImageDisplayUrl(ids)}?x=1`)).toBeNull();
    expect(
      parseDocumentImageDisplayUrl(
        "zimo-doc://v1/11111111-1111-4111-8111-111111111111/../../etc/passwd/33333333-3333-4333-8333-333333333333",
      ),
    ).toBeNull();
  });
});
