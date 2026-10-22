import { useEffect, useState } from "react";
import type { SaveWebSearchConfigurationInput, WebSearchConfigurationView } from "@zimo/contracts";
import { Badge, Button, Spinner } from "@zimo/ui";

import { SelectControl } from "../../components/select-control";

const PROVIDERS = [
  { value: "model_native", label: "当前模型原生搜索" },
  { value: "tavily", label: "Tavily" },
  { value: "brave", label: "Brave Search" },
  { value: "searxng", label: "SearXNG（自建）" },
] as const;

export function WebSearchSettings() {
  const [configuration, setConfiguration] = useState<WebSearchConfigurationView | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void window.zimo.webAccess.getConfiguration(crypto.randomUUID()).then((result) => {
      if (!active) return;
      if (result.ok) setConfiguration(result.data);
      else setMessage(result.error.message);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!configuration) return <Spinner label="正在加载联网搜索设置" />;

  const input = (): SaveWebSearchConfigurationInput => ({
    enabled: configuration.enabled,
    provider: configuration.provider,
    ...(configuration.baseUrl ? { baseUrl: configuration.baseUrl } : {}),
    ...(apiKey ? { apiKey } : {}),
  });

  async function test() {
    setBusy("test");
    setMessage(null);
    const result = await window.zimo.webAccess.testConfiguration(crypto.randomUUID(), input());
    setBusy(null);
    setMessage(result.ok ? `连接正常，耗时 ${result.data.latencyMs}ms。` : result.error.message);
  }

  async function save() {
    setBusy("save");
    setMessage(null);
    const result = await window.zimo.webAccess.saveConfiguration(crypto.randomUUID(), input());
    setBusy(null);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setConfiguration(result.data);
    setApiKey("");
    setMessage("联网搜索设置已保存。");
  }

  return (
    <div className="grid gap-4">
      <label className="flex items-center justify-between gap-5 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
        配置普通会话和 Workflow Agent 使用的 web_search
        <input
          type="checkbox"
          className="size-4 accent-indigo-600"
          checked={configuration.enabled}
          onChange={(event) =>
            setConfiguration({ ...configuration, enabled: event.target.checked })
          }
        />
      </label>

      {configuration.enabled && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-neutral-700">
            搜索服务
            <SelectControl
              ariaLabel="搜索服务"
              value={configuration.provider}
              options={[...PROVIDERS]}
              onValueChange={(provider) =>
                setConfiguration({
                  ...configuration,
                  provider: provider as WebSearchConfigurationView["provider"],
                  baseUrl: "",
                  hasApiKey: false,
                })
              }
            />
          </label>
          {configuration.provider === "model_native" ? (
            <p className="self-end text-xs leading-5 text-neutral-500">
              使用会话当前模型和已保存的模型凭据；不需要单独的搜索 API Key。网关必须支持
              /v1/messages 和 web_search_20250305。
            </p>
          ) : configuration.provider === "searxng" ? (
            <label className="grid gap-2 text-sm font-medium text-neutral-700">
              SearXNG 地址
              <input
                type="url"
                className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                value={configuration.baseUrl}
                maxLength={2000}
                placeholder="https://search.example.com"
                onChange={(event) =>
                  setConfiguration({ ...configuration, baseUrl: event.target.value })
                }
              />
            </label>
          ) : (
            <label className="grid gap-2 text-sm font-medium text-neutral-700">
              API Key
              <input
                type="password"
                autoComplete="new-password"
                className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                value={apiKey}
                maxLength={4096}
                placeholder={configuration.hasApiKey ? "已安全保存；留空保持不变" : "输入 API Key"}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {configuration.enabled && (
          <Button variant="secondary" disabled={busy !== null} onClick={() => void test()}>
            {busy === "test" ? "测试中…" : "测试连接"}
          </Button>
        )}
        <Button disabled={busy !== null} onClick={() => void save()}>
          {busy === "save" ? "保存中…" : "保存"}
        </Button>
        <Badge
          className={
            configuration.enabled
              ? "bg-emerald-50 text-emerald-700"
              : "bg-neutral-100 text-neutral-500"
          }
        >
          {configuration.enabled ? "搜索已启用" : "搜索未启用"}
        </Badge>
      </div>
      <p className="text-xs leading-5 text-neutral-400">
        搜索 Key 仅保存在系统安全存储中。web_fetch
        始终可用，但不携带网页登录态，也不会访问本机或私有网络。
      </p>
      {message && (
        <p className="text-xs text-neutral-600" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
