import type {
  PrototypeDefinition,
  PrototypeId,
  SkillPackageStore,
  SkillScriptExecutor,
} from "@zimo/domain";
import { describe, expect, it, vi } from "vitest";

import {
  GeneratedSkillInstallationService,
  SKILL_CREATOR_INSTALL_PERMISSION,
  SKILL_CREATOR_MARKETPLACE_PACKAGE_ID,
  SKILL_CREATOR_PACKAGE_ID,
} from "./generated-skill-installation-service";
import { SkillRuntimeService } from "./skill-runtime-service";
import { ControlledToolService } from "./tool-runtime";

describe("SkillRuntimeService", () => {
  it("registers only installed package scripts and executes an allowed entry", async () => {
    const packages: SkillPackageStore = {
      install: async () => [],
      remove: async () => undefined,
      listScripts: async () => ["scripts/schedule.py"],
      listResources: async () => [],
      readResource: async () => "",
    };
    const execute = vi.fn(async () => ({ exitCode: 0, stdout: "created", stderr: "" }));
    const executor: SkillScriptExecutor = { execute };
    const tools = new ControlledToolService(
      [],
      { record: async () => undefined },
      { now: () => new Date("2026-09-08T00:00:00.000Z") },
    );
    const service = new SkillRuntimeService(packages, executor, tools);

    const toolIds = await service.prepareTools([skillDefinition()]);
    const [toolId] = toolIds;
    expect(tools.list()).toEqual([
      expect.objectContaining({ id: toolId, source: "skill", confirmation: "per_run" }),
    ]);
    expect(tools.list()[0]).toMatchObject({
      inputSchema: {
        additionalProperties: false,
        properties: {
          arguments: { description: expect.stringContaining("--append") },
        },
      },
    });

    const output = await tools.execute(
      {
        toolId: toolId!,
        input: { script: "scripts/schedule.py", arguments: ["create", "17:30 开会"] },
        confirmedToolIds: [toolId!],
        context: {
          runId: "run-1",
          workflowId: "conversation-1",
          nodeId: "conversation-agent",
          toolCallId: "call-1",
        },
      },
      new AbortController().signal,
    );

    expect(output).toMatchObject({ stdout: "created" });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        scriptPath: "scripts/schedule.py",
        arguments: ["create", "17:30 开会"],
      }),
      expect.any(AbortSignal),
    );

    await expect(
      tools.execute(
        {
          toolId: toolId!,
          input: {
            script: "scripts/schedule.py",
            arguments: ["--content", "第二段"],
            append: true,
          },
          confirmedToolIds: [toolId!],
          context: {
            runId: "run-2",
            workflowId: "conversation-1",
            nodeId: "conversation-agent",
            toolCallId: "call-invalid",
          },
        },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "TOOL_ARGUMENTS_INVALID" });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("registers no tool for a legacy instruction-only installation", async () => {
    const tools = new ControlledToolService(
      [],
      { record: async () => undefined },
      { now: () => new Date() },
    );
    const service = new SkillRuntimeService(
      {
        install: async () => [],
        remove: async () => undefined,
        listScripts: async () => [],
        listResources: async () => [],
        readResource: async () => "",
      },
      { execute: vi.fn() },
      tools,
    );

    expect(await service.prepareTools([skillDefinition()])).toEqual([]);
    expect(tools.list()).toEqual([]);
  });

  it("registers and executes the direct-install tool only for the authorized Creator", async () => {
    const tools = new ControlledToolService(
      [],
      { record: async () => undefined },
      { now: () => new Date("2026-09-11T00:00:00.000Z") },
    );
    const install = vi.fn(async () => ({
      ...skillDefinition(),
      id: "00000000-0000-4000-8000-000000000778" as PrototypeId,
      name: "Demo Skill",
      version: "1.0.0",
      installationStatus: "installed" as const,
    }));
    const generatedInstallation = new GeneratedSkillInstallationService(
      {
        readFromWorkspace: vi.fn(async () => ({
          packageId: "local.skill.demo-skill",
          name: "Demo Skill",
          version: "1.0.0",
          description: "Demo",
          category: "本地",
          tags: [],
          permissions: ["context:user-input"],
          instructions: "# Demo",
          checksum: "b".repeat(64),
          files: [],
        })),
      },
      { install },
    );
    const service = new SkillRuntimeService(
      {
        install: async () => [],
        remove: async () => undefined,
        listScripts: async () => ["scripts/init_skill.py"],
        listResources: async () => [],
        readResource: async () => "",
      },
      { execute: vi.fn() },
      tools,
      generatedInstallation,
    );
    const creator = {
      ...skillDefinition(),
      name: "创建 Skill",
      skillPackageId: SKILL_CREATOR_PACKAGE_ID,
      permissions: [SKILL_CREATOR_INSTALL_PERMISSION],
    };

    const toolIds = await service.prepareTools([creator]);
    const installToolId = toolIds.find((id) => id.endsWith(".install_created_skill"));
    expect(installToolId).toBeDefined();
    const output = await tools.execute(
      {
        toolId: installToolId!,
        input: { directoryName: "demo-skill" },
        confirmedToolIds: [installToolId!],
        context: {
          runId: "run-1",
          workflowId: "conversation-1",
          nodeId: "conversation-agent",
          toolCallId: "call-install",
        },
      },
      new AbortController().signal,
    );

    expect(output).toEqual({
      skillId: "00000000-0000-4000-8000-000000000778",
      name: "Demo Skill",
      version: "1.0.0",
      installationStatus: "installed",
    });
    expect(install).toHaveBeenCalledOnce();
  });

  it("recognizes the reviewed Skill Store Creator identity", async () => {
    const tools = new ControlledToolService(
      [],
      { record: async () => undefined },
      { now: () => new Date("2026-09-11T00:00:00.000Z") },
    );
    const service = new SkillRuntimeService(
      {
        install: async () => [],
        remove: async () => undefined,
        listScripts: async () => ["scripts/init_skill.py"],
        listResources: async () => [],
        readResource: async () => "",
      },
      { execute: vi.fn() },
      tools,
      new GeneratedSkillInstallationService({ readFromWorkspace: vi.fn() }, { install: vi.fn() }),
    );

    const toolIds = await service.prepareTools([
      {
        ...skillDefinition(),
        name: "创建skill的技能",
        skillPackageId: SKILL_CREATOR_MARKETPLACE_PACKAGE_ID,
        source: "Zimo Skill Store",
        permissions: ["context:user-input", "context:conversation"],
      },
    ]);

    expect(toolIds.some((id) => id.endsWith(".install_created_skill"))).toBe(true);
  });

  it("registers a read-only tool for installed text resources", async () => {
    const tools = new ControlledToolService(
      [],
      { record: async () => undefined },
      { now: () => new Date("2026-10-07T00:00:00.000Z") },
    );
    const readResource = vi.fn(async () => "# 推荐候选人\n\n按页面状态执行。\n");
    const service = new SkillRuntimeService(
      {
        install: async () => [],
        remove: async () => undefined,
        listScripts: async () => [],
        listResources: async () => ["tasks/recommend.md"],
        readResource,
      },
      { execute: vi.fn() },
      tools,
    );

    const [toolId] = await service.prepareTools([skillDefinition()]);
    expect(tools.list()).toEqual([
      expect.objectContaining({
        id: toolId,
        confirmation: "per_run",
        permissions: [expect.objectContaining({ id: "skill:resource:read", risk: "low" })],
      }),
    ]);
    const output = await tools.execute(
      {
        toolId: toolId!,
        input: { path: "tasks/recommend.md" },
        confirmedToolIds: [toolId!],
        context: {
          runId: "run-resource",
          workflowId: "conversation-1",
          nodeId: "conversation-agent",
          toolCallId: "call-resource",
        },
      },
      new AbortController().signal,
    );
    expect(output).toEqual({
      path: "tasks/recommend.md",
      content: "# 推荐候选人\n\n按页面状态执行。\n",
    });
    expect(readResource).toHaveBeenCalledWith(
      skillDefinition().id,
      skillDefinition().skillChecksum,
      "tasks/recommend.md",
    );
  });
});

function skillDefinition(): PrototypeDefinition {
  const now = new Date("2026-09-08T00:00:00.000Z");
  return {
    id: "00000000-0000-4000-8000-000000000777" as PrototypeId,
    kind: "skill",
    name: "日程管理",
    description: "管理日程",
    status: "enabled",
    category: "效率",
    tags: [],
    icon: "日",
    version: "1.0.0",
    source: "Zimo Skill Store",
    skillPackageId: "zimo.schedule",
    skillInstructions: "调用 scripts/schedule.py。",
    skillChecksum: "a".repeat(64),
    permissions: [],
    capabilities: ["脚本型 Skill"],
    associations: [],
    installationStatus: "installed",
    workflowNodes: [],
    workflowEdges: [],
    documents: [],
    createdAt: now,
    updatedAt: now,
  };
}
