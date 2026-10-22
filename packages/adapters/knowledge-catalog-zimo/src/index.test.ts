import type { AuthSession, SecretStore, SessionStore } from "@zimo/domain";
import { describe, expect, it, vi } from "vitest";

import { ZimoKnowledgeDirectoryCatalogGateway } from "./index";

const session: AuthSession = {
  id: "session" as AuthSession["id"],
  provider: "zimo-cloud",
  externalUserId: "user-1",
  account: "staff-1",
  displayName: "User",
  tokenSecretRef: "token-ref",
  createdAt: new Date("2026-09-08T00:00:00.000Z"),
  expiresAt: new Date("2026-09-09T00:00:00.000Z"),
};

describe("ZimoKnowledgeDirectoryCatalogGateway", () => {
  it("maps directory tree with documents from the account catalog", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      expect(url.pathname.endsWith("/ai/knowledge/directory/tree-with-documents")).toBe(true);
      return Response.json({
        code: 200,
        msg: "操作成功",
        success: true,
        data: {
          tree: [
            {
              id: 3,
              name: "部门测试",
              documentCount: 1,
              totalDocumentCount: 1,
              documents: [
                {
                  id: 4,
                  name: "折后价问题汇总",
                  originalFilename: "折后价问题汇总.docx",
                  fileExt: "docx",
                  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  fileSize: 225553,
                  status: "normal",
                  checksum: "abc123",
                  storagePath: "https://files.example.com/knowledge/doc.docx",
                },
              ],
              children: [],
            },
          ],
          uncategorizedDocuments: [],
        },
      });
    });

    const result = await createGateway(fetchImpl).listTree(new AbortController().signal);

    expect(result.directories).toHaveLength(1);
    expect(result.directories[0]?.catalogDirectoryId).toBe("3");
    expect(result.directories[0]?.documents[0]?.catalogDocumentId).toBe("4");
    expect(result.directories[0]?.documents[0]?.originalFilename).toBe("折后价问题汇总.docx");
    expect(result.directories[0]?.documents[0]?.remoteChecksum).toBe("abc123");
    expect(result.directories[0]?.documents[0]?.storageUrl).toBe(
      "https://files.example.com/knowledge/doc.docx",
    );
  });
});

function createGateway(fetchImpl: typeof fetch) {
  const sessions: SessionStore = {
    get: async () => session,
    save: async () => undefined,
    clear: async () => undefined,
  };
  const secrets: SecretStore = {
    getStatus: async () => ({ available: true, persistent: true, backend: "test" }),
    get: async () => "token-value",
    set: async () => undefined,
    delete: async () => undefined,
  };
  return new ZimoKnowledgeDirectoryCatalogGateway(
    "https://zimo.example.com/dev-api/",
    sessions,
    secrets,
    fetchImpl,
  );
}
