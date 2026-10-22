import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import type { PrototypeDefinition, PrototypeId } from "@zimo/domain";

import { SQLiteWorkflowRepository, ZimoDatabase } from "./index";

describe("SQLiteWorkflowRepository", () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("persists product workflow definitions and node configuration", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-workflow-db-test-"));
    const path = join(directory, "zimo.sqlite");
    const sql = await readFile(
      new URL("../../../../migrations/0008_workflow_definitions.sql", import.meta.url),
      "utf8",
    );
    const migrations = [{ version: 8, name: "workflow-definitions", sql }] as const;
    const first = new ZimoDatabase(path, migrations);
    const repository = new SQLiteWorkflowRepository(first);
    const now = new Date("2026-09-04T00:00:00.000Z");
    const workflow: PrototypeDefinition = {
      id: "00000000-0000-4000-8000-000000000801" as PrototypeId,
      kind: "workflow",
      name: "知识问答流",
      description: "检索后交给 Agent",
      status: "enabled",
      category: "知识",
      tags: ["RAG"],
      icon: "流",
      version: "1.0.0",
      source: "用户创建",
      permissions: [],
      capabilities: [],
      associations: [],
      workflowNodes: [
        { id: "start", type: "start", label: "开始", position: { x: 0, y: 0 } },
        {
          id: "knowledge",
          type: "knowledge",
          label: "产品资料",
          position: { x: 200, y: 0 },
          config: {
            knowledgeBaseId: "00000000-0000-4000-8000-000000000003",
            topK: 5,
          },
        },
        { id: "end", type: "end", label: "结束", position: { x: 400, y: 0 } },
      ],
      workflowEdges: [
        {
          id: "edge",
          source: "start",
          target: "knowledge",
          sourceHandle: "source-right",
          targetHandle: "target-left",
        },
      ],
      documents: [],
      createdAt: now,
      updatedAt: now,
    };
    await repository.save(workflow);
    first.close();

    const reopened = new ZimoDatabase(path, migrations);
    await expect(
      new SQLiteWorkflowRepository(reopened).getById(workflow.id),
    ).resolves.toMatchObject({
      name: "知识问答流",
      workflowNodes: expect.arrayContaining([
        expect.objectContaining({ config: { knowledgeBaseId: expect.any(String), topK: 5 } }),
      ]),
      workflowEdges: [expect.objectContaining({ sourceHandle: "source-right" })],
    });
    reopened.close();
  });
});
