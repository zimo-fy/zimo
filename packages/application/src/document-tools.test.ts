import { describe, expect, it, vi } from "vitest";

import type { DocumentArtifactService } from "./document-artifact-service";
import { createDocumentTools, DOCUMENT_TOOL_IDS, resolveDocumentToolIds } from "./document-tools";

describe("document tools", () => {
  it("always exposes the complete high-level document toolset", () => {
    const expected = [
      DOCUMENT_TOOL_IDS.inspect,
      DOCUMENT_TOOL_IDS.read,
      DOCUMENT_TOOL_IDS.create,
      DOCUMENT_TOOL_IDS.patch,
      DOCUMENT_TOOL_IDS.convert,
    ];

    expect(resolveDocumentToolIds("分析这个附件", true)).toEqual(expected);
    expect(resolveDocumentToolIds("帮我修改一下这些错别字", true)).toEqual(expected);
    expect(resolveDocumentToolIds("创建一份 Word 报告", false)).toEqual(expected);
    expect(resolveDocumentToolIds("你好", false)).toEqual(expected);
  });

  it("keeps document reads scoped to the conversation in the execution context", async () => {
    const inspect = vi.fn().mockResolvedValue({ documentRef: "doc_1" });
    const forModel = vi.fn().mockReturnValue({ inspect });
    const tools = createDocumentTools({ forModel } as unknown as DocumentArtifactService);
    const registered = tools.find((tool) => tool.definition.id === DOCUMENT_TOOL_IDS.inspect)!;

    await registered.execute(registered.parse({ documentRef: "doc_1" }), {
      runId: "run",
      workflowId: "conversation",
      nodeId: "node",
      toolCallId: "call",
      signal: new AbortController().signal,
    });

    expect(forModel).toHaveBeenCalledWith("conversation");
    expect(inspect).toHaveBeenCalledWith("doc_1", expect.any(AbortSignal));
  });

  it("does not expose opaque artifact or revision identifiers to the model", () => {
    const tools = createDocumentTools({} as DocumentArtifactService);
    const schemas = JSON.stringify(tools.map((tool) => tool.definition.inputSchema));
    expect(schemas).toContain("documentRef");
    expect(schemas).not.toContain("artifactId");
    expect(schemas).not.toContain("expectedRevisionId");
  });

  it("publishes the canonical replace-text arguments in the patch schema", () => {
    const tools = createDocumentTools({} as DocumentArtifactService);
    const patch = tools.find((tool) => tool.definition.id === DOCUMENT_TOOL_IDS.patch)!;
    const schema = JSON.stringify(patch.definition.inputSchema);

    expect(schema).toContain('"replace_text"');
    expect(schema).toContain('"operations"');
    expect(schema).toContain('"search"');
    expect(schema).toContain('"replacement"');
    expect(schema).toContain("不要使用 find/replace");
    expect(
      patch.parse({
        documentRef: "doc_1",
        operations: [
          {
            type: "replace_text",
            search: "技术共亠文档",
            replacement: "技术分享文档",
          },
        ],
      }),
    ).toEqual({
      documentRef: "doc_1",
      operations: [
        {
          type: "replace_text",
          search: "技术共亠文档",
          replacement: "技术分享文档",
        },
      ],
    });
  });

  it("rejects unknown create arguments", () => {
    const tools = createDocumentTools({} as DocumentArtifactService);
    const create = tools.find((tool) => tool.definition.id === DOCUMENT_TOOL_IDS.create)!;
    expect(() =>
      create.parse({
        format: "docx",
        displayName: "report.docx",
        title: "Report",
        command: "rm -rf /",
      }),
    ).toThrow("Unknown argument");
  });
});
