import { Component, ReactNode } from "react";
import { AlertOctagon, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Optional fallback UI. Defaults to a centered card. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-wide error boundary — catches React render/lifecycle errors so a single
 * page crash doesn't white-screen the whole app. Shows a friendly card with
 * Reload and "Report to Cody" actions.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Intentionally console.error — this is a real error condition we want
    // visible in the browser devtools regardless of environment.
    console.error("[error-boundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertOctagon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold">Something went wrong</h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              A page threw an error while rendering. The rest of the app is still usable — reload this page to try again.
            </p>
          </div>
          {error.message && (
            <div className="rounded-lg bg-card border border-border p-3 text-left text-[11px] font-mono text-muted-foreground">
              {error.message.slice(0, 240)}
            </div>
          )}
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button onClick={() => { this.reset(); window.location.reload(); }} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Reload
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.dispatchEvent(new Event("open-cody-chat"));
                window.dispatchEvent(new CustomEvent("cody-prefill", {
                  detail: `I hit an error: "${error.message}". Can you help me figure out what went wrong?`,
                }));
                this.reset();
              }}
              className="gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" /> Report to Cody
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
