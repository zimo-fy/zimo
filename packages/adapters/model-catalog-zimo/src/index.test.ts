import { describe, expect, it, vi } from "vitest";

import { ZimoModelCatalogGateway } from "./index";

describe("ZimoModelCatalogGateway", () => {
  it("does not request the cloud model catalog", async () => {
    const fetchImpl = vi.fn();
    const gateway = new ZimoModelCatalogGateway(
      "https://zimo.example.com/dev-api/",
      {},
      {},
      fetchImpl,
    );

    await expect(gateway.list(new AbortController().signal)).rejects.toMatchObject({
      code: "MODEL_CATALOG_DISABLED",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
