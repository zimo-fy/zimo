import { useEffect, useState } from "react";
import type {
  AppInfoView,
  AppSettingsView,
  AuthSessionView,
  SecretStoreStatusView,
} from "@zimo/contracts";
import { Badge, Card, Spinner } from "@zimo/ui";
import { Check, Database, Globe2, KeyRound, Monitor, ShieldCheck, UserRound } from "lucide-react";

import { SelectControl } from "../../components/select-control";
import { ModelSettings } from "./model-settings";
import { SecurityAuditCenter } from "./security-audit-center";
import { UserMemorySettings } from "./user-memory-settings";
import { WebSearchSettings } from "./web-search-settings";

interface SettingsPageProps {
  session: AuthSessionView;
  setupMessage?: string | undefined;
  onConfigured?: (() => void) | undefined;
}

export function SettingsPage({ session, setupMessage, onConfigured }: SettingsPageProps) {
  const [settings, setSettings] = useState<AppSettingsView | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfoView | null>(null);
  const [secretStatus, setSecretStatus] = useState<SecretStoreStatusView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      window.zimo.settings.get(crypto.randomUUID()),
      window.zimo.app.getInfo(crypto.randomUUID()),
      window.zimo.security.getSecretStoreStatus(crypto.randomUUID()),
    ]).then(([settingsResult, infoResult, secretResult]) => {
      if (!active) return;
      if (!settingsResult.ok || !infoResult.ok || !secretResult.ok) {
        setError("设置暂时无法加载，请稍后重试。");
        return;
      }
      setSettings(settingsResult.data);
      setAppInfo(infoResult.data);
      setSecretStatus(secretResult.data);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!setupMessage || !settings) return;
    document.getElementById("model-configuration")?.scrollIntoView({ block: "start" });
  }, [setupMessage, settings]);

  async function save(next: AppSettingsView) {
    setSaved(false);
    const result = await window.zimo.settings.update(crypto.randomUUID(), next);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSettings(result.data);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-12">
        <Card className="p-6 text-sm text-red-700">{error}</Card>
      </div>
    );
  }

  if (!settings || !appInfo || !secretStatus) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner label="正在加载设置" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-7 py-8 lg:px-12 lg:py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-neutral-950">设置</h1>
        <p className="mt-2 text-sm text-neutral-500">管理 Zimo 的本地体验与基础运行选项。</p>
      </header>

      <div className="mt-9 grid gap-5">
        <SettingsSection icon={UserRound} title="个人信息" description="当前登录的 Zimo 账户">
          <div className="flex items-center justify-between gap-5">
            <div>
              <p className="text-sm font-medium text-neutral-900">{session.displayName}</p>
              <p className="mt-1 text-sm text-neutral-500">{session.email ?? session.account}</p>
            </div>
            <Badge>已认证</Badge>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={UserRound}
          title="用户偏好与记忆"
          description="仅当前登录账号可查看和管理"
        >
          <UserMemorySettings />
        </SettingsSection>

        <SettingsSection
          id="model-configuration"
          icon={KeyRound}
          title="模型配置"
          description="模型标识、API 地址和图像模式"
        >
          <ModelSettings setupMessage={setupMessage} onConfigured={onConfigured} />
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-neutral-500">系统安全存储</span>
            <Badge
              className={
                secretStatus.persistent
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }
            >
              {secretStatus.persistent ? "可用" : "不可用"}
            </Badge>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Globe2}
          title="联网搜索"
          description="为模型提供受控的网页搜索与公开网页读取能力"
        >
          <WebSearchSettings />
        </SettingsSection>

        <SettingsSection icon={Monitor} title="外观与体验" description="V0.1 提供克制的浅色主题">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2 text-sm font-medium text-neutral-700">
              外观
              <SelectControl
                ariaLabel="外观"
                value={settings.appearance}
                disabled
                options={[{ value: "light", label: "浅色" }]}
                onValueChange={() => undefined}
              />
            </div>
            <div className="grid gap-2 text-sm font-medium text-neutral-700">
              日志级别
              <SelectControl
                ariaLabel="日志级别"
                value={settings.logLevel}
                options={(["trace", "debug", "info", "warn", "error", "fatal"] as const).map(
                  (level) => ({ value: level, label: level }),
                )}
                onValueChange={(value) =>
                  void save({ ...settings, logLevel: value as AppSettingsView["logLevel"] })
                }
              />
            </div>
          </div>
          <label className="mt-5 flex items-center justify-between gap-6 rounded-xl bg-neutral-50 px-4 py-3.5 text-sm text-neutral-700">
            减少动态效果
            <input
              type="checkbox"
              className="size-4 accent-neutral-900"
              checked={settings.reduceMotion}
              onChange={(event) => void save({ ...settings, reduceMotion: event.target.checked })}
            />
          </label>
          {saved && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700" role="status">
              <Check size={13} aria-hidden="true" />
              已保存到本机
            </p>
          )}
        </SettingsSection>

        <SettingsSection icon={Database} title="存储与关于" description="应用数据保存在本地">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-neutral-400">数据位置</dt>
              <dd className="mt-1 font-medium text-neutral-700">{appInfo.dataLocationLabel}</dd>
            </div>
            <div>
              <dt className="text-neutral-400">版本</dt>
              <dd className="mt-1 font-medium text-neutral-700">
                {appInfo.version} · {appInfo.phase}
              </dd>
            </div>
          </dl>
        </SettingsSection>

        <SettingsSection
          icon={ShieldCheck}
          title="审计中心"
          description="查看受控操作的拦截、审批、放行和执行结果"
        >
          <SecurityAuditCenter />
        </SettingsSection>
      </div>
    </div>
  );
}

function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id?: string | undefined;
  icon: typeof UserRound;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-6 p-6">
      <div className="mb-6 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-600">
          <Icon size={17} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-neutral-400">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}
