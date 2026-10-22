import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Card } from "@zimo/ui";

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<PropsWithChildren, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Renderer details intentionally stay out of the user-facing surface.
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-neutral-50 p-8">
        <Card className="max-w-md p-8 text-center">
          <span className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
            <AlertTriangle aria-hidden="true" size={22} />
          </span>
          <h1 className="text-xl font-semibold text-neutral-900">页面暂时无法显示</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Zimo 遇到了一个界面问题。重新加载不会删除你的本地数据。
          </p>
          <Button className="mt-6" onClick={() => window.location.reload()}>
            重新加载
          </Button>
        </Card>
      </main>
    );
  }
}
