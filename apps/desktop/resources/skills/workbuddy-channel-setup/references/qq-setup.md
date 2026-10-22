# WorkBuddy QQ Bot Setup - Step-by-Step Guide

Automate the full WorkBuddy-QQ Bot integration using `playwright-cli` with a headed browser.

## Prerequisites
- WorkBuddy 已安装并开启 Claw 远程控制
- 有一个已完成实名认证的 QQ 账号

## Step 1: Open browser (headed mode)

```bash
playwright-cli open "https://q.qq.com" --browser=chrome --headed
```

## Step 2: Close OpenClaw popup

```bash
# Take snapshot to see page
playwright-cli snapshot --filename=qq-home.yaml
cat qq-home.yaml

# Close popup (click close icon)
playwright-cli click <close-img-ref>
# Playwright code:
# await page.getByRole('img', { name: 'close' }).click();
```

## Step 3: Switch to QR code login

```bash
# Click QR code switch icon
playwright-cli click <qr-switch-ref>
# Playwright code:
# await page.getByRole('img').nth(4).click();
```

> **注意**：QQ 开放平台账号和普通 QQ 账号不是同一回事。需要单独注册开发者账号（用邮箱注册）。
> 如果扫码提示"账户未注册"，需要先点击"立即注册"。

## Step 4: Register QQ Open Platform account (if needed)

```bash
# Click "立即注册"
playwright-cli click <register-link-ref>
# Playwright code:
# await page.getByText('立即注册').click();

# Fill email
playwright-cli fill <email-textbox-ref> "your-email@example.com"

# Fill password (must contain digits + letters, case-sensitive, min 8 chars)
playwright-cli fill <password-textbox-ref> "YourPassword123"

# Confirm password
playwright-cli fill <confirm-password-textbox-ref> "YourPassword123"

# Check agreement checkbox
playwright-cli click <agreement-checkbox-ref>

# Click register
playwright-cli click <register-button-ref>

# Then go to email to complete verification link
```

## Step 5: Login, navigate to app list, switch to "机器人" tab

```bash
# Switch to apps tab (registration/login may open new tab)
playwright-cli tab-select <apps-tab-index>

# Take snapshot
playwright-cli snapshot --filename=qq-apps.yaml
cat qq-apps.yaml

# Click "机器人" option
playwright-cli click <bot-tab-ref>
# Playwright code:
# await page.getByText('机器人', { exact: true }).click();
```

## Step 6: Create bot

```bash
# Click "创建机器人"
playwright-cli click <create-bot-button-ref>
# Playwright code:
# await page.getByRole('button', { name: '创建机器人' }).click();

# Switch to new tab
playwright-cli tab-select <create-tab-index>

# Fill bot name (4-30 characters)
playwright-cli fill <name-textbox-ref> "WorkBuddy助手"
# Playwright code:
# await page.getByRole('textbox', { name: '请输入名称' }).fill('WorkBuddy助手');

# Upload avatar - trigger file chooser
playwright-cli run-code "async page => {
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('text=点击上传图片').click()
  ]);
  await fileChooser.setFiles('/path/to/avatar.png');
}"

# Confirm avatar crop
playwright-cli click <crop-confirm-button-ref>
# Playwright code:
# await page.getByRole('button', { name: '确定' }).click();

# Fill description
playwright-cli fill <desc-textbox-ref> "WorkBuddy智能编程助手，通过QQ远程控制WorkBuddy完成各种编程任务。"
# Playwright code:
# await page.getByRole('textbox', { name: '请输入描述，限120个字' }).fill('...');

# Click "确认"
playwright-cli click <confirm-button-ref>
# Playwright code:
# await page.getByRole('button', { name: '确认' }).click();

# Click "提交创建" in confirmation dialog
playwright-cli click <submit-create-button-ref>
# Playwright code:
# await page.getByRole('button', { name: '提交创建' }).click();
```

## Step 7: Get AppID and AppSecret

```bash
# Click the bot name in app list
playwright-cli click <bot-name-ref>
# Playwright code:
# await page.getByText('WorkBuddy助手').click();

# Switch to bot management tab
playwright-cli tab-select <bot-mgmt-tab-index>

# Click left menu "管理" -> "开发管理"
playwright-cli click <dev-mgmt-menu-ref>

# Show AppID
playwright-cli click <appid-show-button-ref>
# Playwright code:
# await page.getByRole('button', { name: '显示' }).nth(1).click();

# Generate AppSecret (requires QQ scan for identity verification)
playwright-cli click <generate-secret-button-ref>
# Playwright code:
# await page.getByRole('button', { name: '生成' }).click();

# >>> User must scan QR code with phone QQ to verify identity <<<

# After verification, copy AppSecret
playwright-cli click <copy-secret-button-ref>

# Read AppSecret from clipboard
# macOS:
pbpaste
# Linux:
# xclip -selection clipboard -o

# Check confirmation checkbox (may be obscured, use force click)
playwright-cli run-code "async page => { await page.locator('text=我已了解AppSecret不会明文存储').click({ force: true }); }"

# Close dialog
playwright-cli click <close-button-ref>
# Playwright code:
# await page.getByRole('button', { name: '关闭' }).click();
```

## Step 8: Configure callback URL and event subscriptions

```bash
# Click left menu "开发" -> "回调配置"
playwright-cli click <callback-config-menu-ref>
# Playwright code:
# await page.getByRole('listitem').filter({ hasText: /^回调配置$/ }).click();

# Fill callback URL (omit https:// prefix, the page prepends it)
playwright-cli fill <url-textbox-ref> "www.codebuddy.cn/v2/backgroundagent/qqProxy/webhook/<AppID>"
# Playwright code:
# await page.getByRole('textbox', { name: '请输入' }).fill('www.codebuddy.cn/v2/backgroundagent/qqProxy/webhook/<AppID>');

# Check all C2C events - click "全选"
playwright-cli run-code "async page => { await page.locator('text=全选').first().click({ force: true }); }"

# Click event "确定配置" button (second one)
playwright-cli click <event-confirm-button-ref>
# Playwright code:
# await page.getByRole('button', { name: '确定配置' }).nth(1).click();

# Click callback URL "确定配置" button (first one)
playwright-cli click <url-confirm-button-ref>
# Playwright code:
# await page.getByRole('button', { name: '确定配置' }).first().click();

# Wait for save success notification
```

> **注意**：
> - 回调地址格式为 `https://www.codebuddy.cn/v2/backgroundagent/qqProxy/webhook/<AppID>`，输入时去掉 `https://` 前缀
> - 必须勾选单聊事件（C2C消息事件、C2C添加好友、C2C删除好友、C2C关闭消息推送、C2C打开消息推送），共 5 个
> - 配置 https 回调地址后，基于 WebSocket 的回调服务不再支持

## Step 9: Configure WorkBuddy Claw QQ integration (manual)

1. 打开 WorkBuddy 桌面应用
2. 点击右上角头像菜单 → "Claw Settings"
3. 找到"QQ AIBot 集成"，点击"配置"
4. 输入 AppID 和 AppSecret
5. 点击"注册"完成绑定

## Step 10 (CRITICAL): Scan QR code to add bot to QQ message list

> **这是最容易遗漏的一步！** 沙箱配置中添加了成员并不会自动让机器人出现在 QQ 消息列表中，必须通过扫码添加。

```bash
# Click left menu "管理" -> "使用范围和人员"
playwright-cli click <usage-scope-menu-ref>
# Playwright code:
# await page.getByRole('listitem').filter({ hasText: /^使用范围和人员$/ }).click();

# Screenshot the QR code area
playwright-cli screenshot <qrcode-area-ref> --filename=qq-bot-qrcode.png
# Playwright code:
# await page.getByText('机器人上线后...').screenshot({ path: 'qq-bot-qrcode.png' });
```

Page shows two QR codes:
- Left: **添加到频道**
- Right: **添加到群和消息列表** (⬅️ scan this one!)

**Steps:**
1. Use phone QQ to scan the RIGHT QR code ("添加到群和消息列表")
2. Open the bot profile card
3. Click "发消息"
4. Confirm authorization
5. Bot will appear in QQ message list and you can start chatting

## Important Notes

1. **Headed mode**: Always use `--headed` for QR code scanning operations
2. **Popup handling**: Homepage shows OpenClaw promotion popup that must be closed first
3. **QQ Open Platform ≠ QQ account**: Separate developer account registered with email
4. **AppSecret shown only once**: Copy immediately after generation
5. **Clipboard read**: Use `pbpaste` (macOS) to read clipboard content after copy operations
6. **Force click**: Confirmation checkboxes may be obscured by overlay layers, use `force: true`
7. **Avatar upload**: Use `run-code` to manually trigger `filechooser` event, then `setFiles`
8. **Tab management**: QQ platform frequently opens new tabs, use `tab-select` to switch
9. **Must scan QR code to add bot**: After sandbox member setup, you MUST scan the "添加到群和消息列表" QR code on the "使用范围和人员" page. Without this, the bot will NOT appear in QQ message list. This is the most commonly missed step!
