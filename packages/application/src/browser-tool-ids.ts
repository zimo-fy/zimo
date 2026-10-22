export const BROWSER_TOOL_IDS = {
  tabs: "zimo.browser.tabs",
  open: "zimo.browser.open",
  focus: "zimo.browser.focus",
  snapshot: "zimo.browser.snapshot",
  screenshot: "zimo.browser.screenshot",
  navigate: "zimo.browser.navigate",
  click: "zimo.browser.click",
  type: "zimo.browser.type",
  press: "zimo.browser.press",
  scroll: "zimo.browser.scroll",
  wait: "zimo.browser.wait",
} as const;

export const BROWSER_TOOL_ID_LIST = Object.values(BROWSER_TOOL_IDS);

const BROWSER_MODEL_TOOL_NAMES: Readonly<Record<string, string>> = {
  [BROWSER_TOOL_IDS.tabs]: "browser_tabs",
  [BROWSER_TOOL_IDS.open]: "browser_open",
  [BROWSER_TOOL_IDS.focus]: "browser_focus",
  [BROWSER_TOOL_IDS.snapshot]: "browser_snapshot",
  [BROWSER_TOOL_IDS.screenshot]: "browser_screenshot",
  [BROWSER_TOOL_IDS.navigate]: "browser_navigate",
  [BROWSER_TOOL_IDS.click]: "browser_click",
  [BROWSER_TOOL_IDS.type]: "browser_type",
  [BROWSER_TOOL_IDS.press]: "browser_press",
  [BROWSER_TOOL_IDS.scroll]: "browser_scroll",
  [BROWSER_TOOL_IDS.wait]: "browser_wait",
};

export function browserModelToolName(toolId: string): string | undefined {
  return BROWSER_MODEL_TOOL_NAMES[toolId];
}
