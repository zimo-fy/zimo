// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { RouteTargetView } from "@zimo/contracts";
import { describe, expect, it, vi } from "vitest";

import { CapabilitySummary } from "./chat-capability-menu";

const skill: RouteTargetView = {
  id: "00000000-0000-4000-8000-000000000001",
  type: "skill",
  name: "网页摘要",
  description: "摘要网页",
  enabled: true,
};

describe("CapabilitySummary", () => {
  it("removes a selected capability from its compact chip", () => {
    const onRemoveSkill = vi.fn();
    render(
      <CapabilitySummary
        skills={[skill]}
        mcpServers={[]}
        disabled={false}
        onRemoveAgent={vi.fn()}
        onRemoveSkill={onRemoveSkill}
        onRemoveKnowledgeBase={vi.fn()}
        onRemoveWorkflow={vi.fn()}
        onRemoveMcpServer={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "移除能力 网页摘要" }));
    expect(onRemoveSkill).toHaveBeenCalledWith(skill.id);
  });
});
