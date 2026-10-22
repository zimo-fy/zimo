import type { ModelProviderView } from "@zimo/contracts";
import { Badge, Button, Spinner } from "@zimo/ui";
import { Check, LockKeyhole, Save, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; providers: ModelProviderView[]; defaultModelId: string | null }
  | { status: "error"; message: string };

export function ModelSettings({
  setupMessage,
  onConfigured,
}: {
  setupMessage?: string | undefined;
  onConfigured?: (() => void) | undefined;
}) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [busy, setBusy] = useState<"saving" | "testing" | "testing_search">();
  const [notice, setNotice] = useState<string>();
  const [modelName, setModelName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [supportsImages, setSupportsImages] = useState(false);
  const canEdit = import.meta.env.DEV;

  useEffect(() => {
    let active = true;
    void Promise.all([
      window.zimo.models.list(crypto.randomUUID()),
      window.zimo.models.getDefault(crypto.randomUUID()),
    ]).then(([providers, defaultModel]) => {
      if (!active) return;
      if (!providers.ok) {
        setLoad({ status: "error", message: "模型配置暂时无法加载。" });
        return;
      }
      const firstProvider = providers.data[0];
      const firstModel = firstProvider?.models[0];
      if (firstModel) {
        setModelName(firstModel.name);
        setBaseUrl(firstProvider.baseUrl);
        setSupportsImages(firstModel.capabilities.vision);
      }
      setLoad({
        status: "ready",
        providers: providers.data,
        defaultModelId: defaultModel.ok ? defaultModel.data.modelId : null,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  async function testProvider(provider: ModelProviderView): Promise<void> {
    setBusy("testing");
    setNotice(undefined);
    const result = await window.zimo.models.testProvider(crypto.randomUUID(), {
      mode: "saved",
      providerId: provider.id,
    });
    setBusy(undefined);
    setNotice(result.ok ? `连接成功 · ${result.data.latencyMs} ms` : result.error.message);
  }

  async function testNativeSearch(provider: ModelProviderView): Promise<void> {
    setBusy("testing_search");
    setNotice(undefined);
    const result = await window.zimo.models.testProvider(crypto.randomUUID(), {
      mode: "native_search",
      providerId: provider.id,
    });
    setBusy(undefined);
    setNotice(
      result.ok
        ? `原生联网成功 · ${result.data.sourceCount ?? 0} 个来源${result.data.errorCount ? `，${result.data.errorCount} 个结果出错（部分成功）` : ""} · ${result.data.latencyMs} ms`
        : result.error.message,
    );
  }

  async function saveProvider(provider: ModelProviderView): Promise<void> {
    const model = provider.models[0];
    if (!model) return;
    setBusy("saving");
    setNotice(undefined);
    const trimmedApiKey = apiKey.trim();
    const result = await window.zimo.models
      .saveProvider(crypto.randomUUID(), {
        providerId: provider.id,
        name: provider.name,
        baseUrl,
        ...(trimmedApiKey ? { apiKey: trimmedApiKey } : {}),
        model: {
          id: model.id,
          name: modelName,
          displayName: modelName.trim(),
          capabilities: { ...model.capabilities, vision: supportsImages },
        },
      })
      .catch(() => null);
    setBusy(undefined);
    if (!result) {
      setNotice("请填写有效的模型标识和 API 地址。");
      return;
    }
    if (!result.ok) {
      setNotice(result.error.message);
      return;
    }
    setApiKey("");
    setModelName(result.data.models[0]?.name ?? modelName);
    setBaseUrl(result.data.baseUrl);
    setSupportsImages(result.data.models[0]?.capabilities.vision ?? supportsImages);
    onConfigured?.();
    setLoad((current) =>
      current.status === "ready" ? { ...current, providers: [result.data] } : current,
    );
    setNotice("开发模型配置已保存");
  }

  if (load.status === "loading") {
    return (
      <div className="grid min-h-32 place-items-center">
        <Spinner label="正在加载模型配置" />
      </div>
    );
  }

  if (load.status === "error") {
    return <p className="text-sm text-red-700">{load.message}</p>;
  }

  const provider = load.providers[0];
  const model = provider?.models[0];
  if (!provider || !model) {
    if (canEdit) {
      return (
        <div className="grid min-h-32 place-items-center">
          <Spinner label="正在加载模型配置" />
        </div>
      );
    }
    return (
      <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800" role="alert">
        {setupMessage ?? "请先配置模型再使用"}
      </div>
    );
  }

  const succeeded =
    notice?.startsWith("连接成功") ||
    notice?.startsWith("原生联网成功") ||
    notice === "开发模型配置已保存";
  return (
    <div>
      {setupMessage && !canEdit && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-800" role="alert">
          {setupMessage}
        </p>
      )}
      <div className="flex flex-col items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:flex-row">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-violet-600 shadow-sm">
          <LockKeyhole size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-neutral-800">
              {model.displayName.trim() || "模型配置"}
            </p>
            {model.id === load.defaultModelId && (
              <Badge className="bg-violet-100 text-violet-700">默认模型</Badge>
            )}
            {canEdit && <Badge className="bg-amber-100 text-amber-700">开发环境可编辑</Badge>}
          </div>
          {canEdit ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-medium text-neutral-600 sm:col-span-2">
                模型标识
                <input
                  className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  value={modelName}
                  maxLength={120}
                  onChange={(event) => setModelName(event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-neutral-600 sm:col-span-2">
                API 地址
                <input
                  type="url"
                  className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  value={baseUrl}
                  inputMode="url"
                  maxLength={2000}
                  onChange={(event) => setBaseUrl(event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-neutral-600 sm:col-span-2">
                新 API Key（可选）
                <input
                  type="password"
                  autoComplete="new-password"
                  className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  value={apiKey}
                  maxLength={4096}
                  placeholder="留空则继续使用登录账号安全下发的密钥"
                  onChange={(event) => setApiKey(event.target.value)}
                />
              </label>
              <p className="text-xs text-neutral-400 sm:col-span-2">
                当前密钥不会回显；新密钥保存后立即进入 Main
                进程的系统安全存储。开启图像模式后，对话可以发送 PNG、JPEG 和 WebP。
              </p>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <label className="flex items-center gap-2.5 text-xs font-medium text-neutral-700">
                  是否支持图像模式
                  <input
                    type="checkbox"
                    className="size-4 accent-violet-600"
                    checked={supportsImages}
                    onChange={(event) => setSupportsImages(event.target.checked)}
                  />
                </label>
                <Button
                  disabled={Boolean(busy) || !modelName.trim() || !baseUrl.trim()}
                  onClick={() => void saveProvider(provider)}
                >
                  <Save size={14} /> {busy === "saving" ? "保存中…" : "保存配置"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button
                  variant="secondary"
                  disabled={Boolean(busy)}
                  onClick={() => void testProvider(provider)}
                >
                  <Wifi size={14} /> {busy === "testing" ? "测试中…" : "测试连接"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={Boolean(busy)}
                  onClick={() => void testNativeSearch(provider)}
                >
                  <Wifi size={14} /> {busy === "testing_search" ? "测试原生联网中…" : "测试原生联网"}
                </Button>
              </div>
              <p className="text-xs text-neutral-400 sm:col-span-2">
                测试使用已保存的模型配置；修改后请先保存。
              </p>
            </div>
          ) : (
            <>
              <p className="mt-1 text-xs text-neutral-500">模型标识：{model.name}</p>
              <p className="mt-1 text-xs text-neutral-500">API 地址：{provider.baseUrl}</p>
              <p className="mt-1 text-xs text-neutral-500">
                图像模式：{model.capabilities.vision ? "支持" : "不支持"}
              </p>
              <p className="mt-1 text-xs text-neutral-500">API Key：由登录账号安全下发</p>
              <p className="mt-1 text-xs text-neutral-400">
                凭据仅保存在 Main 进程的系统安全存储中，页面无法读取或修改。
              </p>
            </>
          )}
          {!canEdit && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={Boolean(busy)}
                onClick={() => void testProvider(provider)}
              >
                <Wifi size={14} /> {busy === "testing" ? "测试中…" : "测试连接"}
              </Button>
              <Button
                variant="secondary"
                disabled={Boolean(busy)}
                onClick={() => void testNativeSearch(provider)}
              >
                <Wifi size={14} /> {busy === "testing_search" ? "测试原生联网中…" : "测试原生联网"}
              </Button>
            </div>
          )}
        </div>
      </div>
      {notice && (
        <p
          className={`mt-3 flex items-center gap-1.5 text-xs ${
            succeeded ? "text-emerald-700" : "text-red-700"
          }`}
          role="status"
        >
          {succeeded && <Check size={13} />}
          {notice}
        </p>
      )}
    </div>
  );
}
