import type { BindEmailChannelInput } from "@zimo/contracts";
import { Button, Card } from "@zimo/ui";
import { Mail } from "lucide-react";
import { useState } from "react";

export function EmailBindingForm({ onBound }: { onBound(): Promise<void> }) {
  const [form, setForm] = useState<BindEmailChannelInput>({ email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const result = await window.zimo.communicationChannels.bindEmail(crypto.randomUUID(), form);
    setBusy(false);
    if (!result.ok) return setError(result.error.message);
    await onBound();
  }

  return (
    <Card className="p-6 lg:p-8">
      <div className="flex gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
        <Mail className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
        <p>
          这里只登记邮件地址，不会登录邮箱，也不需要密码或授权码。接收并处理发往该地址的邮件将在后续接入。
        </p>
      </div>
      <form className="mt-6 grid gap-4" onSubmit={(event) => void submit(event)}>
        <label className="grid gap-2 text-sm font-medium">
          邮箱地址
          <input
            className="field"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(event) => setForm({ email: event.target.value })}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "email-binding-error" : "email-binding-help"}
            placeholder="name@example.com"
          />
        </label>
        <p id="email-binding-help" className="text-xs leading-5 text-neutral-500">
          后续可以从其他邮箱向这个地址发送邮件，由 Zimo 的邮件接收能力处理。
        </p>
        {error && (
          <p id="email-binding-error" role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-2 flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? "正在添加…" : "添加邮箱"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
