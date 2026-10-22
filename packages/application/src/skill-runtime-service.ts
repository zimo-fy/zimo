import {
  AppError,
  type PrototypeDefinition,
  type SkillPackageStore,
  type SkillScriptExecutor,
} from "@zimo/domain";

import type { ControlledToolService, RegisteredTool } from "./tool-runtime";
import { isAuthorizedSkillCreator } from "./generated-skill-installation-service";
import type { GeneratedSkillInstallationService } from "./generated-skill-installation-service";

const MAX_ARGUMENTS = 32;
const MAX_ARGUMENT_LENGTH = 4_000;
const MAX_RESOURCE_PATH_LENGTH = 240;

export class SkillRuntimeService {
  constructor(
    private readonly packages: SkillPackageStore,
    private readonly executor: SkillScriptExecutor,
    private readonly tools: ControlledToolService,
    private readonly generatedSkillInstallation?: GeneratedSkillInstallationService,
  ) {}

  async prepareTools(skills: readonly PrototypeDefinition[]): Promise<readonly string[]> {
    const toolIds: string[] = [];
    for (const skill of skills) {
      const scripts = skill.skillChecksum
        ? await this.packages.listScripts(skill.id, skill.skillChecksum)
        : [];
      const resources = skill.skillChecksum
        ? await this.packages.listResources(skill.id, skill.skillChecksum)
        : [];
      const registered: RegisteredTool[] = [];
      if (scripts.length > 0) registered.push(this.createScriptTool(skill, scripts));
      if (resources.length > 0) registered.push(this.createResourceTool(skill, resources));
      if (this.generatedSkillInstallation && isAuthorizedSkillCreator(skill)) {
        registered.push(this.createInstallTool(skill));
      }
      this.tools.replaceSkill(skill.id, registered);
      toolIds.push(...registered.map((tool) => tool.definition.id));
    }
    return toolIds;
  }

  private createResourceTool(
    skill: PrototypeDefinition,
    resources: readonly string[],
  ): RegisteredTool {
    const toolId = `skill.${skill.id}.read_resource`;
    return {
      definition: {
        id: toolId,
        title: `读取 Skill 资源：${skill.name}`,
        description: `读取“${skill.name}”安装包内的一个受控文本资源。只能选择 Schema 枚举中的相对路径，不能读取会话 Workspace 或任意本地文件。`,
        source: "skill",
        permissions: [
          {
            id: "skill:resource:read",
            title: "读取已安装 Skill 资源",
            description: "可读取该 Skill 安装包清单中的受控文本资源。",
            risk: "low",
          },
        ],
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            path: {
              type: "string",
              enum: resources,
              maxLength: MAX_RESOURCE_PATH_LENGTH,
              description: "Skill 包内的相对资源路径。",
            },
          },
          required: ["path"],
        },
        annotations: {
          readOnly: true,
          destructive: false,
          idempotent: true,
          openWorld: false,
        },
        confirmation: "per_run",
        timeoutMs: 10_000,
      },
      parse: (input) => parseResourceInput(input, resources),
      execute: async (input) => {
        const parsed = parseResourceInput(input, resources);
        return {
          path: parsed.path,
          content: await this.packages.readResource(skill.id, skill.skillChecksum!, parsed.path),
        };
      },
    };
  }

  private createScriptTool(skill: PrototypeDefinition, scripts: readonly string[]): RegisteredTool {
    const toolId = `skill.${skill.id}.run_script`;
    return {
      definition: {
        id: toolId,
        title: `运行 Skill：${skill.name}`,
        description: [
          `运行用户已安装并绑定的“${skill.name}”Skill 脚本。`,
          `可用脚本：${scripts.join("、")}`,
          "输入对象顶层只能包含 script 和 arguments。所有脚本选项（例如 --append、--content、--path）都必须作为字符串放入 arguments 数组，禁止改写成 append、content 或 path 等顶层字段。",
          "仅当 Skill 指令要求执行脚本时调用；不要编造脚本路径或参数。",
        ].join(" "),
        source: "skill",
        permissions: [
          {
            id: "skill:script:execute",
            title: "执行已安装 Skill 脚本",
            description: "可启动该受审核 Skill 包内的 Python 或 Node.js 脚本。",
            risk: "high",
          },
          {
            id: "skill:data:read-write",
            title: "读写 Skill 工作数据",
            description: "脚本可在该 Skill 的持久化工作目录中读写数据。",
            risk: "high",
          },
        ],
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            script: {
              type: "string",
              enum: scripts,
              description: "从可用脚本枚举中选择的包内相对路径。",
            },
            arguments: {
              type: "array",
              maxItems: MAX_ARGUMENTS,
              items: { type: "string", maxLength: MAX_ARGUMENT_LENGTH },
              description: "传给脚本的完整 argv 字符串数组；--append 等标志也必须放在此数组中。",
            },
          },
          required: ["script", "arguments"],
        },
        annotations: {
          readOnly: false,
          destructive: true,
          idempotent: false,
          openWorld: false,
        },
        confirmation: "per_run",
        timeoutMs: 30_000,
      },
      parse: (input) => parseScriptInput(input, scripts),
      execute: async (input, context) => {
        const parsed = parseScriptInput(input, scripts);
        return this.executor.execute(
          {
            skillId: skill.id,
            checksum: skill.skillChecksum!,
            scriptPath: parsed.script,
            arguments: parsed.arguments,
          },
          context.signal,
        );
      },
    };
  }

  private createInstallTool(skill: PrototypeDefinition): RegisteredTool {
    const installer = this.generatedSkillInstallation!;
    return {
      definition: {
        id: `skill.${skill.id}.install_created_skill`,
        title: "安装刚创建的 Skill",
        description:
          "安装当前 Creator 工作区中已经完成并校验的 Skill 子目录。只传目录名，不传绝对路径。成功结果会包含已安装 Skill 的 ID、名称和版本。",
        source: "skill",
        permissions: [
          {
            id: "skill:local-install",
            title: "安装本地创建的 Skill",
            description: "可将 Creator 隔离工作区内的一个 Skill 目录安装到本地列表。",
            risk: "high",
          },
        ],
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            directoryName: {
              type: "string",
              minLength: 1,
              maxLength: 64,
              pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            },
          },
          required: ["directoryName"],
        },
        annotations: {
          readOnly: false,
          destructive: false,
          idempotent: true,
          openWorld: false,
        },
        confirmation: "per_run",
        timeoutMs: 30_000,
      },
      parse: parseInstallInput,
      execute: async (input, context) => {
        const parsed = parseInstallInput(input);
        const installed = await installer.install(skill, parsed.directoryName, context.signal);
        return {
          skillId: installed.id,
          name: installed.name,
          version: installed.version,
          installationStatus: installed.installationStatus,
        };
      },
    };
  }
}

function parseInstallInput(value: Readonly<Record<string, unknown>>): {
  directoryName: string;
} {
  if (Object.keys(value).some((key) => key !== "directoryName")) {
    throw invalidArguments();
  }
  const directoryName = value.directoryName;
  if (
    typeof directoryName !== "string" ||
    directoryName.length > 64 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(directoryName)
  ) {
    throw invalidArguments();
  }
  return { directoryName };
}

function parseResourceInput(
  value: Readonly<Record<string, unknown>>,
  resources: readonly string[],
): { path: string } {
  if (Object.keys(value).some((key) => key !== "path")) throw invalidResourceArguments();
  const path = value.path;
  if (
    typeof path !== "string" ||
    path.length > MAX_RESOURCE_PATH_LENGTH ||
    !resources.includes(path)
  ) {
    throw invalidResourceArguments();
  }
  return { path };
}

function parseScriptInput(
  value: Readonly<Record<string, unknown>>,
  scripts: readonly string[],
): { script: string; arguments: string[] } {
  if (Object.keys(value).some((key) => key !== "script" && key !== "arguments")) {
    throw invalidArguments();
  }
  if (typeof value.script !== "string" || !scripts.includes(value.script)) {
    throw invalidArguments();
  }
  if (
    !Array.isArray(value.arguments) ||
    value.arguments.length > MAX_ARGUMENTS ||
    value.arguments.some(
      (argument) => typeof argument !== "string" || argument.length > MAX_ARGUMENT_LENGTH,
    )
  ) {
    throw invalidArguments();
  }
  return { script: value.script, arguments: value.arguments as string[] };
}

function invalidArguments(): AppError {
  return new AppError({
    code: "SKILL_SCRIPT_ARGUMENTS_INVALID",
    category: "security",
    userMessage: "Skill 脚本参数不符合允许的 Schema。",
  });
}

function invalidResourceArguments(): AppError {
  return new AppError({
    code: "SKILL_RESOURCE_ARGUMENTS_INVALID",
    category: "security",
    userMessage: "Skill 资源读取参数不符合允许的 Schema。",
  });
}
