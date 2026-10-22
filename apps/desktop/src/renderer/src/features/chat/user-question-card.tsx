import type { PendingUserQuestionView, UserQuestionAnswer } from "@zimo/contracts";
import { Button } from "@zimo/ui";
import { MessageCircleQuestion } from "lucide-react";
import { useState, type FormEvent } from "react";

export function UserQuestionCard({
  question,
  busy,
  onAnswer,
}: {
  question: PendingUserQuestionView;
  busy: boolean;
  onAnswer(answers: readonly UserQuestionAnswer[]): void;
}) {
  const item = question.questions[0];
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  if (!item) return null;
  const answers = [item].map((current) => ({
    id: current.id,
    selected:
      custom[current.id]?.trim() && !current.multiSelect ? [] : (selected[current.id] ?? []),
    ...(custom[current.id]?.trim() ? { custom: custom[current.id]!.trim() } : {}),
  }));
  const canSubmit = answers.every((answer) => answer.selected.length > 0 || answer.custom);
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canSubmit && !busy) onAnswer(answers);
  }
  return (
    <section
      className="rounded-2xl border border-neutral-200/90 bg-white/95 p-4 shadow-[0_18px_60px_-22px_rgba(0,0,0,0.38)] backdrop-blur-xl"
      aria-label="等待你回答"
      aria-live="polite"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-neutral-900 text-white">
          <MessageCircleQuestion size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-neutral-500">需要你的确认</p>
          <p className="truncate text-sm font-semibold text-neutral-900">{item.header}</p>
        </div>
        {question.questionCount > 1 && (
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-500">
            {question.questionNumber}/{question.questionCount}
          </span>
        )}
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <fieldset className="space-y-2.5">
          <legend className="text-sm leading-6 text-neutral-800">{item.question}</legend>
          <div className="grid gap-1.5">
            {item.options.map((option) => {
              const checked = (selected[item.id] ?? []).includes(option.label);
              return (
                <label
                  key={option.label}
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50/70 px-3 py-2 text-sm text-neutral-800 transition hover:border-neutral-300 hover:bg-neutral-50 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-100"
                >
                  <input
                    className="mt-0.5 accent-neutral-900"
                    type={item.multiSelect ? "checkbox" : "radio"}
                    name={item.id}
                    checked={checked}
                    disabled={busy}
                    onChange={() => {
                      if (!item.multiSelect)
                        setCustom((current) => ({ ...current, [item.id]: "" }));
                      setSelected((current) => ({
                        ...current,
                        [item.id]: item.multiSelect
                          ? checked
                            ? (current[item.id] ?? []).filter((value) => value !== option.label)
                            : [...(current[item.id] ?? []), option.label]
                          : [option.label],
                      }));
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{option.label}</span>
                    {option.description && (
                      <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
                        {option.description}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          <label className="block text-xs font-medium text-neutral-600">
            其他（可自行输入）
            <input
              className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-normal text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
              placeholder="输入你的答案"
              value={custom[item.id] ?? ""}
              maxLength={2_000}
              disabled={busy}
              onChange={(event) => {
                if (!item.multiSelect && event.target.value.trim())
                  setSelected((current) => ({ ...current, [item.id]: [] }));
                setCustom((current) => ({ ...current, [item.id]: event.target.value }));
              }}
            />
          </label>
        </fieldset>
        <div className="flex justify-end border-t border-neutral-100 pt-3">
          <Button
            type="submit"
            className="h-8 min-h-8 rounded-lg px-3 text-xs"
            disabled={!canSubmit || busy}
          >
            {busy
              ? "正在提交…"
              : question.questionNumber < question.questionCount
                ? "提交并继续"
                : "提交回答"}
          </Button>
        </div>
      </form>
    </section>
  );
}
