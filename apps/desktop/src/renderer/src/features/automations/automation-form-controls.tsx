import type { McpConnectionView } from "@zimo/contracts";

import { toggleValue } from "./automation-form-values";

export function CapabilityChecks(props: {
  title: string;
  emptyText: string;
  items: readonly { id: string; name: string }[];
  selectedIds: readonly string[];
  onChange(value: string[]): void;
}) {
  return (
    <fieldset className="mt-4 rounded-xl border border-neutral-200 p-4">
      <legend className="px-1 text-sm font-medium">{props.title}</legend>
      {props.items.length === 0 ? (
        <p className="text-sm text-neutral-400">{props.emptyText}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {props.items.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={props.selectedIds.includes(item.id)}
                onChange={() => props.onChange(toggleValue(props.selectedIds, item.id))}
              />
              {item.name}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

export function McpChecks(props: {
  connections: readonly McpConnectionView[];
  selectedToolIds: readonly string[];
  onChange(value: string[]): void;
}) {
  return (
    <fieldset className="mt-4 rounded-xl border border-neutral-200 p-4">
      <legend className="px-1 text-sm font-medium">MCP Servers</legend>
      {props.connections.length === 0 ? (
        <p className="text-sm text-neutral-400">暂无已连接 MCP Server</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {props.connections.map((connection) => {
            const ids = connection.tools.map((tool) => tool.id);
            const selected =
              ids.length > 0 && ids.every((id) => props.selectedToolIds.includes(id));
            const combined = [...new Set([...props.selectedToolIds, ...ids])];
            return (
              <label key={connection.serverId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={ids.length === 0 || (!selected && combined.length > 300)}
                  checked={selected}
                  onChange={() =>
                    props.onChange(
                      selected ? props.selectedToolIds.filter((id) => !ids.includes(id)) : combined,
                    )
                  }
                />
                {connection.name}
                <span className="text-xs text-neutral-400">{ids.length} tools</span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

export function DateTimeField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        className="field"
        type="datetime-local"
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>
    </div>
  );
}
