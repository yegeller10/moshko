import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI crash:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-dvh w-full place-items-center px-4 py-8">
          <Card className="w-full max-w-md space-y-3 text-center">
            <p className="font-semibold text-red-700">Something went wrong</p>
            <p className="break-words text-xs text-slate-500">
              {this.state.error.message}
            </p>
            <Button
              className="w-full"
              onClick={() => {
                this.setState({ error: null });
                window.location.assign("/");
              }}
            >
              Reload
            </Button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
