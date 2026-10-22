# WorkBuddy Feishu (飞书) Setup - Step-by-Step Guide

Automate the full WorkBuddy-Feishu integration using `playwright-cli` with a headed browser.

## Step 1: Open browser and login

```bash
playwright-cli open "https://open.feishu.cn" --headed
```

Wait for the page to load, then find and click the login button. The user must manually complete login (scan QR code or enter credentials). After login, save auth state:

```bash
playwright-cli state-save feishu-auth.json
```

To restore a previous session:
```bash
playwright-cli state-load feishu-auth.json
```

## Step 2: Navigate to developer console

```bash
playwright-cli goto "https://open.feishu.cn/app?lang=zh-CN"
```

## Step 3: Create enterprise app

1. Click "创建企业自建应用" button
2. Fill app name: "WorkBuddy 助手" (customizable)
3. Fill description: "WorkBuddy 飞书集成助手，用于远程控制和任务执行"
4. Select robot icon (RobotFilled)
5. Click "创建" button
6. **Record the APP_ID** from the URL after redirect (e.g., `cli_a93bc0e47f38dcca`)

## Step 4: Add bot capability

```bash
playwright-cli goto "https://open.feishu.cn/app/${APP_ID}/capability"
```

Click the "添加" button next to the bot capability.

## Step 5: Batch import permissions

Navigate to permissions page:
```bash
playwright-cli goto "https://open.feishu.cn/app/${APP_ID}/auth"
```

Click "批量导入/导出权限" to open the import dialog.

**CRITICAL: Monaco editor workaround.** The batch import dialog uses a Monaco code editor that cannot be manipulated via standard `fill` or keyboard commands. You MUST use the React fiber approach:

1. **Set editor value** via React fiber at depth 10 (`setValue`):
```javascript
playwright-cli eval '() => { var container = document.querySelector(".monaco-editor").parentElement; var fiberKey = Object.keys(container).filter(function(k) { return k.startsWith("__reactFiber") })[0]; var fiber = container[fiberKey]; var current = fiber; for (var i = 0; i < 10; i++) { current = current.return } current.memoizedProps.setValue(PERMISSIONS_JSON_STRING); return "done" }'
```

2. **Click "格式化 JSON"** button to format the content

3. **Trigger onChange** via React fiber at depth 6:
```javascript
playwright-cli eval '() => { var container = document.querySelector(".monaco-editor").parentElement; var fiberKey = Object.keys(container).filter(function(k) { return k.startsWith("__reactFiber") })[0]; var fiber = container[fiberKey]; var current = fiber; for (var i = 0; i < 6; i++) { current = current.return } current.memoizedProps.onChange(current.memoizedProps.value); return "done" }'
```

4. **Trigger onValidate** via React fiber at depth 10 with empty array:
```javascript
playwright-cli eval '() => { var container = document.querySelector(".monaco-editor").parentElement; var fiberKey = Object.keys(container).filter(function(k) { return k.startsWith("__reactFiber") })[0]; var fiber = container[fiberKey]; var current = fiber; for (var i = 0; i < 10; i++) { current = current.return } current.memoizedProps.onValidate([]); return "done" }'
```

5. Click "下一步，确认新增权限", then "申请开通", then "确认" on data scope dialog.

The permissions JSON is in `references/permissions.json`.

## Step 6: Get App credentials

```bash
playwright-cli goto "https://open.feishu.cn/app/${APP_ID}/baseinfo"
```

App ID is visible on the page. Click the eye icon (second SVG icon next to the masked App Secret) to reveal it. Record both values.

## Step 7: Configure WorkBuddy (manual)

Tell the user to:
1. Open WorkBuddy Claw settings > Feishu (龙虾设置 > 飞书)
2. Enter the App ID and App Secret
3. Click "注册"
4. Copy the Webhook URL provided

Ask the user for the Webhook URL before proceeding.

## Step 8: Configure event subscription

```bash
playwright-cli goto "https://open.feishu.cn/app/${APP_ID}/event"
```

1. Click "订阅方式" button
2. Select "将事件发送至 开发者服务器" radio
3. Fill the Webhook URL in the "请求地址" textbox
4. Click "保存"
5. Click "添加事件"
6. Search for "接收消息" in the search box
7. Check the "接收消息 v2.0" checkbox
8. Click "添加"
9. If a permissions dialog appears, click "确认开通权限"

## Step 9: Configure card callback

On the same events page:
1. Click "回调配置" tab
2. Click "订阅方式" button
3. Select "将回调发送至 开发者服务器" radio
4. Fill the same Webhook URL
5. Click "保存"
6. Click "添加回调"
7. Check "卡片回传交互" (card.action.trigger) checkbox
8. Click "添加"

## Step 10: Create version and publish

```bash
playwright-cli goto "https://open.feishu.cn/app/${APP_ID}/version"
```

1. Click "创建版本"
2. Fill version number: "1.0.0"
3. Fill update notes: "初始版本，集成 WorkBuddy 远程控制功能"
4. Click "保存"
5. Click "确认发布"
6. In the confirmation dialog, click "确认发布" again

The app should show status "已发布".

## Important Notes

- **Element refs (e.g., e432) change between page loads.** Always use `playwright-cli snapshot` to get current refs before clicking. The Playwright code comments (e.g., `await page.getByRole('button', { name: '批量导入/导出权限' }).click()`) are the stable selectors.
- **Monaco editor hack is essential** for Step 5. Standard fill/keyboard/clipboard approaches all fail.
- **Step 7 is manual** and requires user interaction outside the browser.
- After each navigation or click, use `playwright-cli snapshot` to verify the page state before proceeding.
