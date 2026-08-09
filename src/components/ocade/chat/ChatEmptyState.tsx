import { cn } from "@/lib/utils";
import { SolarWorkScene, type WorkSceneActivity } from "./SolarWorkScene";

/**
 * The first screen of an empty chat.
 *
 * Its job is to answer "what is this good at?" in under two seconds, without
 * pretending. The suggestions are ordinary work, not showpieces, and the
 * privacy line is the one genuinely distinctive thing OCADE has to say — so it
 * is stated once, plainly, rather than decorated.
 */

export interface Suggestion {
  label: string;
  prompt: string;
  hint?: string;
}

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  {
    label: "Explain this error",
    prompt: "Explain this error message and the most likely cause:\n\n",
    hint: "Paste a stack trace",
  },
  {
    label: "Summarise a document",
    prompt:
      "Summarise the attached document in five bullet points, then list anything that needs a decision.",
    hint: "Attach a file first",
  },
  {
    label: "Read a screenshot",
    prompt: "Read this screenshot and tell me exactly what it says.",
    hint: "Attach an image",
  },
  {
    label: "Draft a reply",
    prompt:
      "Draft a short, direct reply to this message. Keep it friendly and under 120 words:\n\n",
  },
];

export function ChatEmptyState({
  greeting,
  suggestions = DEFAULT_SUGGESTIONS,
  onPick,
  privacyLine,
  activity = "idle",
  voiceAmplitude = 0,
  className,
}: {
  greeting?: string;
  suggestions?: Suggestion[];
  onPick?: (prompt: string) => void;
  privacyLine?: string | null;
  activity?: WorkSceneActivity;
  voiceAmplitude?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto flex min-h-[520px] w-full max-w-4xl flex-col items-center justify-center overflow-hidden px-4 py-16 text-center sm:px-6",
        className,
      )}
    >
      <SolarWorkScene
        activity={activity}
        voiceAmplitude={voiceAmplitude}
        className="absolute inset-x-0 top-0 h-[340px] opacity-80 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
      />
      <h1 className="relative z-10 mt-36 text-balance text-2xl font-semibold tracking-tight text-foreground drop-shadow-[0_1px_14px_rgba(0,0,0,0.8)] sm:text-[28px]">
        {greeting ?? "What can OCADE do for you?"}
      </h1>
      {privacyLine ? (
        <p className="relative z-10 mt-2 max-w-md text-balance text-[13px] text-muted-foreground">
          {privacyLine}
        </p>
      ) : null}

      {onPick && suggestions.length > 0 ? (
        <ul className="relative z-10 mt-8 grid w-full max-w-3xl gap-2 sm:grid-cols-2">
          {suggestions.map((s) => (
            <li key={s.label}>
              <button
                type="button"
                onClick={() => onPick(s.prompt)}
                className="group h-full w-full rounded-xl border border-border/70 bg-card/50 p-3.5 text-left transition hover:border-[color:var(--accent-ocade)]/40 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block text-[13.5px] font-medium text-foreground">{s.label}</span>
                {s.hint ? (
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">{s.hint}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
