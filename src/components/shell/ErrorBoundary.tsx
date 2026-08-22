import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/**
 * Panel-level error boundary (Plan §39).
 *
 * Keeps one failing surface — the Copilot panel, a visual response, a settings
 * section — from taking down the whole workspace. The user keeps their
 * conversation and can retry the failed panel in place.
 *
 * The message shown is deliberately plain: it says what broke and how to
 * recover, and never dumps a stack trace into the UI.
 */
interface Props {
  children: ReactNode;
  /** Shown in the fallback so the user knows what failed. */
  label?: string;
  /** Optional custom fallback. */
  fallback?: (retry: () => void, message: string) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Shapes that mean the message was written for whoever wrote the code.
 *
 * React hands the boundary the raw Error, and this component used to render
 * `error.message` straight onto the page. "Cannot read properties of undefined
 * (reading 'name')" tells a person nothing they can act on, and tells them the
 * product is broken in a way that feels unsafe. A stack frame or a minified
 * React code is worse still.
 *
 * The test is deliberately on the SHAPE rather than on an allow-list of good
 * messages: the product's own sentences ("That folder is no longer on this
 * computer.") are worth keeping, and there is no way to enumerate them.
 */
const DEVELOPER_SHAPED = [
  /\bundefined\b|\bnull\b/i,
  /is not a function|is not defined|is not an object|is not iterable/i,
  /cannot read propert(y|ies)/i,
  /unexpected token|JSON at position/i,
  /React error #\d+/i,
  /\.[jt]sx?:\d+:\d+/,
  /\bat\s+\S+\s*\(/,
  /^\w*(Type|Reference|Syntax|Range|Eval)Error\b/,
];

const GENERIC = "Something here stopped working. Trying again usually clears it.";

/** What may be shown to a person, as opposed to what is worth logging. */
export function readableMessage(raw: string | undefined): string {
  const message = (raw ?? "").trim();
  if (!message) return GENERIC;
  if (DEVELOPER_SHAPED.some((shape) => shape.test(message))) return GENERIC;
  return message;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Report for diagnostics; never surfaces protected data to the user.
    reportLovableError(error, {
      boundary: this.props.label ?? "panel",
      componentStack: info.componentStack ?? undefined,
    });
  }

  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const message = readableMessage(error.message);
    if (this.props.fallback) return this.props.fallback(this.retry, message);

    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-2 rounded-lg border border-border/60 bg-secondary/25 p-3 text-xs"
      >
        <span className="flex items-center gap-2 font-medium text-foreground">
          <AlertTriangle className="h-4 w-4 text-[color:var(--state-warning)]" aria-hidden />
          {this.props.label ? `${this.props.label} stopped working` : "This panel stopped working"}
        </span>
        <span className="text-muted-foreground">{message}</span>
        <button
          onClick={this.retry}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2 py-1 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
        </button>
      </div>
    );
  }
}
