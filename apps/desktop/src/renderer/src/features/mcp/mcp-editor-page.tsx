import type { ConnectMcpInput } from "@zimo/contracts";
import { Button, Card } from "@zimo/ui";
import { ArrowLeft, KeyRound } from "lucide-react";
import { useState } from "react";

import { SelectControl } from "../../components/select-control";
import type { McpCatalogEntry } from "./mcp-catalog";

const customAuthenticationOptions = [
  { value: "none", label: "无需认证", description: "服务可以直接访问" },
  { value: "bearer", label: "Bearer Token", description: "通过 Authorization Header 发送" },
  { value: "oauth", label: "标准 OAuth", description: "使用系统浏览器完成授权" },
] as const;

export function McpEditorPage({
  entry,
  isNew,
  onBack,
  onSaved,
}: {
  entry: McpCatalogEntry;
  isNew: boolean;
  onBack(): void;
  onSaved(name: string): Promise<void>;
}) {
  const isCustom = entry.input.source === "custom";
  const [name, setName] = useState(entry.input.name);
  const [endpoint, setEndpoint] = useState(entry.input.endpoint);
  const [authentication, setAuthentication] = useState(entry.input.authentication);
  const [credential, setCredential] = useState("");
  const [verifiedToolCount, setVerifiedToolCount] = useState<number>();
  const [workingAction, setWorkingAction] = useState<"probe" | "save">();
  const [notice, setNotice] = useState<string>();
  const usesCredential = ["bearer", "header_token", "api_key", "query_token"].includes(
    authentication,
  );
  const usesOAuth = authentication === "oauth";

  function input(): ConnectMcpInput {
    return {
      ...entry.input,
      name,
      endpoint,
      authentication,
      ...(usesCredential ? { credential } : {}),
    };
  }

  function resetVerification() {
    setVerifiedToolCount(undefined);
    setNotice(undefined);
  }

  async function probe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (usesOAuth) return saveWithOAuth();
    setWorkingAction("probe");
    setNotice(undefined);
    const result = await window.zimo.mcp.probe(crypto.randomUUID(), input());
    setWorkingAction(undefined);
    if (!result.ok) return setNotice(result.error.message);
    setVerifiedToolCount(result.data.toolCount);
    setNotice(`连接成功，发现 ${result.data.toolCount} 个工具。`);
  }

  async function saveWithOAuth() {
    setWorkingAction("save");
    setNotice("请在浏览器中完成授权，授权完成后将自动保存。");
    const result = await window.zimo.mcp.connect(crypto.randomUUID(), input());
    setWorkingAction(undefined);
    if (!result.ok) return setNotice(result.error.message);
    await onSaved(result.data.name);
  }

  async function save() {
    if (verifiedToolCount === undefined) return;
    setWorkingAction("save");
    setNotice(undefined);
    const result = await window.zimo.mcp.connect(crypto.randomUUID(), input());
    setWorkingAction(undefined);
    if (!result.ok) return setNotice(result.error.message);
    await onSaved(result.data.name);
  }

  return (
    <div className="h-screen overflow-y-auto px-6 py-7 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" className="mb-5 -ml-2" onClick={onBack}>
          <ArrowLeft size={17} /> 返回 MCP 服务
        </Button>
        <h1 className="text-2xl font-semibold">{isNew ? "新增 MCP" : `配置${name}`}</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          {usesOAuth
            ? "连接后将在系统浏览器中完成账号授权，成功后自动保存工具目录。"
            : "先测试连接并读取服务端工具目录，通过后再保存配置。"}
        </p>
        {notice && (
          <p role="status" className="mt-5 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {notice}
          </p>
        )}
        <Card className="mt-6 p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <KeyRound className="text-blue-600" size={20} />
            <div>
              <h2 className="font-semibold">连接信息</h2>
              <p className="mt-1 text-xs text-neutral-500">
                凭据只进入系统安全存储，不会写入普通日志或数据库。
              </p>
            </div>
          </div>
          <form className="mt-6 space-y-5" onSubmit={(event) => void probe(event)}>
            {isCustom && (
              <label className="block text-sm font-medium">
                MCP 名称
                <input
                  className="field mt-2"
                  required
                  maxLength={80}
                  value={name}
                  placeholder="例如：内部文档服务"
                  onChange={(event) => {
                    setName(event.target.value);
                    resetVerification();
                  }}
                />
              </label>
            )}
            <label className="block text-sm font-medium">
              <span className="flex items-center gap-2">
                MCP 服务地址
                {!isCustom && (
                  <span className="text-xs font-normal text-neutral-400">内置固定</span>
                )}
              </span>
              <input
                className="field mt-2"
                type="url"
                required
                readOnly={!isCustom}
                value={endpoint}
                placeholder="https://mcp.example.com/mcp"
                onChange={(event) => {
                  setEndpoint(event.target.value);
                  resetVerification();
                }}
              />
            </label>
            {!isCustom && authentication === "bearer" && (
              <div className="rounded-xl bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
                <span className="block font-medium text-neutral-700">认证请求头</span>
                <code className="mt-1 block break-all text-neutral-600">
                  Authorization: Bearer &lt;MCP Token&gt;
                </code>
              </div>
            )}
            {isCustom && (
              <label className="block text-sm font-medium">
                认证方式
                <SelectControl
                  className="mt-2"
                  ariaLabel="认证方式"
                  value={authentication}
                  options={customAuthenticationOptions}
                  onValueChange={(value) => {
                    if (!isCustomAuthentication(value)) return;
                    setAuthentication(value);
                    setCredential("");
                    resetVerification();
                  }}
                />
              </label>
            )}
            {usesCredential && (
              <label className="block text-sm font-medium">
                {entry.credentialLabel ?? "访问凭据"}
                <input
                  className="field mt-2"
                  type="password"
                  autoComplete="off"
                  required
                  value={credential}
                  placeholder={entry.credentialPlaceholder ?? "输入服务访问 Token"}
                  onChange={(event) => {
                    setCredential(event.target.value);
                    resetVerification();
                  }}
                />
                {authentication === "bearer" && (
                  <span className="mt-2 block text-xs font-normal leading-5 text-neutral-500">
                    只输入 Token 本身，不要包含“Bearer ”前缀。已保存的 Token
                    不会回显；更换后需重新测试连接并保存。
                  </span>
                )}
              </label>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit" disabled={Boolean(workingAction)}>
                {workingAction
                  ? usesOAuth
                    ? "等待授权…"
                    : "正在测试…"
                  : usesOAuth
                    ? "连接并授权"
                    : "测试连接"}
              </Button>
              {!usesOAuth && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={verifiedToolCount === undefined || Boolean(workingAction)}
                  onClick={() => void save()}
                >
                  {workingAction === "save" ? "正在保存…" : "保存"}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                disabled={Boolean(workingAction)}
                onClick={onBack}
              >
                取消
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

function isCustomAuthentication(
  value: string,
): value is (typeof customAuthenticationOptions)[number]["value"] {
  return customAuthenticationOptions.some((option) => option.value === value);
}
