import { describe, expect, it } from "vitest";
import type { PrototypeDefinition } from "@zimo/domain";

import { compileAgentSystemPrompt, compileSkillSystemPrompt } from "./prompt-compilation";

describe("response language policy", () => {
  it("keeps Agent and English Skill instructions while requiring Chinese responses", () => {
    const skill = prototype("skill", {
      name: "English Skill",
      skillInstructions: "Always analyze the source carefully.",
    });
    const agent = prototype("agent", {
      name: "English Agent",
      systemPrompt: "You are a helpful assistant.",
    });

    const prompt = compileAgentSystemPrompt(agent, [skill]);

    expect(prompt).toContain("You are a helpful assistant.");
    expect(prompt).toContain("Always analyze the source carefully.");
    expect(prompt).toContain("自然语言回复默认使用简体中文");
    expect(prompt).toContain("Skill、Tool 返回值或参考资料使用英文，也不要因此切换回复语言");
  });

  it("applies the same policy to a directly bound Skill", () => {
    const prompt = compileSkillSystemPrompt(
      [prototype("skill", { skillInstructions: "Write a concise response." })],
      false,
    );

    expect(prompt).toContain("Write a concise response.");
    expect(prompt).toContain("自然语言回复默认使用简体中文");
  });
});

function prototype(
  kind: "agent" | "skill",
  patch: Partial<PrototypeDefinition>,
): PrototypeDefinition {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    kind,
    name: "测试能力",
    description: "",
    status: "enabled",
    category: "测试",
    tags: [],
    icon: "测",
    version: "1.0.0",
    source: "测试",
    permissions: [],
    capabilities: [],
    associations: [],
    workflowNodes: [],
    workflowEdges: [],
    documents: [],
    createdAt: new Date("2026-09-11T00:00:00.000Z"),
    updatedAt: new Date("2026-09-11T00:00:00.000Z"),
    ...patch,
  } as PrototypeDefinition;
}
