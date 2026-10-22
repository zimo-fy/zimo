---
name: workbuddy-channel-setup
description: "Automate WorkBuddy channel integration setup using playwright-cli. Supports Feishu and QQ Bot channels. Creates apps, configures bot capabilities, permissions, event subscriptions, callbacks, and publishes. Trigger when user mentions: 配置飞书, 接入飞书, WorkBuddy飞书, feishu setup, 飞书机器人配置, 配置QQ, 接入QQ, QQ机器人, qq bot setup, WorkBuddy QQ."
description_zh: "自动配置飞书、QQ Bot 渠道集成"
description_en: "Auto-setup Feishu & QQ Bot channels"
---

# WorkBuddy Channel Setup Automation

Automate WorkBuddy channel integrations using `playwright-cli` with a headed browser.

Supported channels:
- **Feishu (飞书)** — Enterprise app with bot capability
- **QQ Bot** — QQ open platform robot

## Prerequisites

- playwright-cli skill installed
- WorkBuddy installed with Claw remote control enabled

### Feishu-specific
- Feishu enterprise account with app creation permissions

### QQ-specific
- QQ account with real-name verification (实名认证)
- QQ Open Platform developer account (separate from QQ account, registered with email)

---

## Before You Begin: User Interaction Notice

**IMPORTANT: Before starting any channel setup, you MUST display the following notice to the user:**

> **提示：本配置过程需要您的参与配合**
>
> 整个流程大部分步骤由我自动完成，但以下环节需要您在手机或桌面端手动操作：
>
> - **扫码登录** — 需要用手机扫描屏幕上的二维码完成平台登录
> - **身份验证** — 生成 AppSecret 等敏感操作时，平台会要求扫码验证身份
> - **WorkBuddy 配置** — 需要您在 WorkBuddy 桌面应用中填入凭证信息
> - **扫码添加机器人**（QQ）— 需要手机 QQ 扫码将机器人添加到消息列表
>
> 每次需要您操作时，我会暂停并明确告知您需要做什么。完成后请回复确认，我会自动继续后续步骤。
>
> 请留意系统通知，配置过程可能持续数分钟。准备好后，请告诉我要配置哪个渠道（飞书 / QQ）。

Wait for the user to confirm before proceeding with any setup steps.

---

## Channel: Feishu (飞书)

Full guide: [references/feishu-setup.md](references/feishu-setup.md)

### Overview (10 steps)

1. Open browser and login to Feishu
2. Navigate to developer console
3. Create enterprise app
4. Add bot capability
5. Batch import permissions (via React fiber hack for Monaco editor)
6. Get App credentials (App ID + App Secret)
7. Configure WorkBuddy Claw settings (manual step)
8. Configure event subscription (Webhook URL + "接收消息" event)
9. Configure card callback ("卡片回传交互")
10. Create version 1.0.0 and publish

### Quick Start

```bash
playwright-cli open "https://open.feishu.cn" --headed
```

After login, follow the step-by-step guide in `references/feishu-setup.md`.

### Key Notes

- **Monaco editor hack is essential** for Step 5 (batch permissions import). Standard fill/keyboard/clipboard approaches all fail. Use React fiber approach.
- **Step 7 is manual** — user must configure App ID and App Secret in WorkBuddy Claw settings and provide the Webhook URL.
- **Element refs change between page loads** — always use `playwright-cli snapshot` to get current refs before clicking.
- Permissions JSON is in `references/permissions.json`.

---

## Channel: QQ Bot

Full guide: [references/qq-setup.md](references/qq-setup.md)

### Overview (10 steps)

1. Open browser (headed mode) and close popup
2. Close OpenClaw promotion popup
3. Switch to QR code login
4. Register QQ Open Platform account (if needed, uses email)
5. Login and switch to "机器人" tab
6. Create bot (name, avatar, description)
7. Get AppID and AppSecret (requires QQ scan for identity verification)
8. Configure callback URL and event subscriptions (5 C2C events)
9. Configure WorkBuddy Claw QQ integration (manual step)
10. **Scan QR code to add bot to QQ message list** (critical, most easily missed step!)

### Quick Start

```bash
playwright-cli open "https://q.qq.com" --browser=chrome --headed
```

Follow the step-by-step guide in `references/qq-setup.md`.

### Key Notes

- **Headed mode required** — must use `--headed` for QR code scanning operations.
- **QQ Open Platform ≠ QQ account** — separate developer account registered with email.
- **AppSecret only shown once** — copy immediately after generation using `pbpaste` (macOS).
- **Force click** — some checkboxes may be obscured by overlays, use `force: true`.
- **Tab management** — QQ platform frequently opens new tabs, use `tab-select` to switch.
- **Avatar upload** — requires `run-code` to manually trigger `filechooser` event.
- **Callback URL format**: `https://www.codebuddy.cn/v2/backgroundagent/qqProxy/webhook/<AppID>` (omit `https://` prefix when filling in the form).
- **Must scan QR code** — In "使用范围和人员" page, scan the "添加到群和消息列表" QR code (the right one). Without this step, the bot will NOT appear in QQ message list. This is the most commonly missed step!

---

## General Tips

- After each navigation or click, use `playwright-cli snapshot` to verify page state before proceeding.
- Save browser auth state with `playwright-cli state-save <file>.json` to avoid re-login.
- All manual steps (WorkBuddy Claw configuration) require user interaction outside the browser — prompt the user and wait for confirmation.

---

## Official Documentation References

When encountering issues during setup, consult the corresponding official WorkBuddy guide for the channel being configured. Use `WebFetch` to retrieve the latest content when needed.

| Channel | Guide URL |
|---------|----------|
| Feishu (飞书) | https://www.codebuddy.cn/docs/workbuddy/Feishu-Guide |
| QQ Bot | https://www.codebuddy.cn/docs/workbuddy/QQ-Guide |
| WeCom (企业微信) | https://www.codebuddy.cn/docs/workbuddy/Wecom-Guide |
| WeChat (微信) | https://www.codebuddy.cn/docs/workbuddy/Wechat-Guide |
| DingTalk (钉钉) | https://www.codebuddy.cn/docs/workbuddy/Dingtalk-Guide |

**Usage**: If a step fails or behaves unexpectedly, fetch the relevant guide to check for updated instructions, new prerequisites, or changed UI flows. For example:

```
WebFetch(url: "https://www.codebuddy.cn/docs/workbuddy/QQ-Guide", prompt: "查找关于回调配置的最新步骤")
```

These guides are maintained by the WorkBuddy team and may contain updates not yet reflected in this skill. When you find discrepancies, update this skill accordingly (see Self-Evolution section below).

---

## Self-Evolution: Experience Accumulation & Skill Maintenance

This skill is designed to be **self-improving**. When executing the setup workflow and encountering new issues, you should actively update this skill to capture the fix and prevent future recurrence.

### When to update

- A step fails due to a UI change on the platform (new selectors, renamed buttons, changed flow)
- A new popup, verification, or intermediate step appears that the guide doesn't cover
- A workaround is discovered for a previously undocumented edge case
- The user provides feedback about a confusing or error-prone step
- A new channel integration is added (e.g., WeChat, DingTalk, Slack)

### How to update

1. **Fix in-place**: If a step's instructions are wrong or outdated, edit the corresponding `references/<channel>-setup.md` directly with the corrected commands and selectors.

2. **Add to Key Notes**: If you discover a new gotcha or pitfall, append it to the relevant channel's "Key Notes" section in this `SKILL.md` and the "Important Notes" section in the channel's reference doc.

3. **Add new channel**: Create a new `references/<channel>-setup.md`, add its overview and key notes to this `SKILL.md`, and update the `description` field in the frontmatter to include new trigger words.

4. **Record in troubleshooting log**: For complex issues that required multi-step debugging, create or append to `references/troubleshooting.md` with the following format:

   ```markdown
   ### [Channel] Issue Title
   - **Date**: YYYY-MM-DD
   - **Symptom**: What went wrong
   - **Root Cause**: Why it happened
   - **Fix**: What solved it
   - **Prevention**: What was updated in the skill to prevent recurrence
   ```

### Principles

- **Keep guides executable**: Every code block should be copy-pasteable and working. If a command changes, update it immediately.
- **Preserve context in comments**: When updating selectors or commands, keep the Playwright-style code comment (e.g., `# await page.getByRole(...)`) as the stable reference alongside the `playwright-cli` command.
- **Don't delete, annotate**: If a step becomes obsolete but might be relevant for older platform versions, comment it out with a note rather than deleting it entirely.
- **Trigger words matter**: When adding new channels or renaming existing ones, always update the `description` frontmatter so the skill is correctly triggered.
