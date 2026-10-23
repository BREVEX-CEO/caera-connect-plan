/**
 * THE @ APP PICKER. Typing @ in the composer lists the apps the person's computers really
 * found (names and icons from each device, never a built-in catalogue); arrows, Enter or Tab
 * and Escape work it from the keyboard, and the chosen app is kept as a structured reference
 * to that device, so two computers with "Word" are never confused. Choosing an app is not
 * permission: Allowed Apps and confirmations still decide on the server and the device.
 *
 * Trigger detection and the keyboard menu follow DeepSeek Harness
 * `packages/client/ui-input-trigger/src/core/{detect,menu}.ts` (MIT, see THIRD_PARTY_NOTICES.md).
 */
import { useQuery } from "@tanstack/react-query";
import { AppWindow } from "lucide-react";
import { useState, type KeyboardEvent, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { readJarvisAppIcons } from "./jarvis.functions";

export interface AppChoice {
  deviceId: string;
  deviceName: string;
  name: string;
}

const WORD = /[\p{L}\p{N}_]/u;
const MOST_SHOWN = 8;

/** The @ being typed at the caret and what follows it, or null. An e-mail's @ never opens it. */
export function atQuery(draft: string, caret: number): { start: number; query: string } | null {
  for (let i = caret - 1; i >= 0 && caret - i <= 41; i -= 1) {
    const ch = draft[i]!;
    if (ch === "\n") return null;
    if (ch !== "@") continue;
    if (i > 0 && WORD.test(draft[i - 1]!)) return null;
    const query = draft.slice(i + 1, caret);
    return /^\s/.test(query) ? null : { start: i, query };
  }
  return null;
}

/** Apps whose name, or a word of it, starts with the query; name matches first. */
export function appMatches(apps: readonly AppChoice[], query: string): AppChoice[] {
  const q = query.toLowerCase();
  const rank = (app: AppChoice) => {
    const name = app.name.toLowerCase();
    if (name.startsWith(q)) return 0;
    return name.split(/[\s._+&()'’-]+/).some((word) => word.startsWith(q)) ? 1 : 2;
  };
  return apps
    .map((app) => ({ app, rank: rank(app) }))
    .filter(({ rank }) => rank < 2)
    .sort((a, b) => a.rank - b.rank || a.app.name.localeCompare(b.app.name))
    .slice(0, MOST_SHOWN)
    .map(({ app }) => app);
}

/** The chosen apps still written in the text, as @Name followed by a non-word character. */
export function stillMentioned(text: string, chosen: readonly AppChoice[]): AppChoice[] {
  return chosen.filter((app) => {
    const at = text.indexOf(`@${app.name}`);
    return at >= 0 && !WORD.test(text[at + app.name.length + 1] ?? "");
  });
}

/** One structured reference per draft: its app, device and live picker state. */
export function useAppMention(input: {
  draft: string;
  setDraft: (text: string) => void;
  apps: readonly AppChoice[];
  textarea: RefObject<HTMLTextAreaElement | null>;
  multipleDevices: boolean;
}) {
  const [hit, setHit] = useState<{ start: number; query: string } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [chosen, setChosen] = useState<AppChoice[]>([]);
  const icons = useQuery({
    queryKey: ["jarvis", "app-icons"],
    queryFn: () => readJarvisAppIcons(),
    enabled: hit !== null || chosen.length > 0,
    staleTime: 10 * 60_000,
  });
  const matches = hit ? appMatches(input.apps, hit.query) : [];
  const open = matches.length > 0;
  const active = Math.min(highlight, matches.length - 1);
  const iconOf = (app: AppChoice) => icons.data?.[app.deviceId]?.[app.name];

  const look = () => {
    const box = input.textarea.current;
    setHit(box ? atQuery(box.value, box.selectionStart ?? box.value.length) : null);
    setHighlight(0);
  };

  const pick = (app: AppChoice) => {
    if (!hit) return;
    const caret = hit.start + 1 + hit.query.length;
    const before = input.draft.slice(0, hit.start);
    const after = input.draft.slice(caret).replace(/^\s*/, " ");
    const draft = `${before}@${app.name}${after}`;
    input.setDraft(draft);
    setChosen((list) => [
      ...list.filter((a) => a.name !== app.name || a.deviceId !== app.deviceId),
      app,
    ]);
    setHit(null);
    const at = before.length + app.name.length + 2;
    requestAnimationFrame(() => {
      input.textarea.current?.focus();
      input.textarea.current?.setSelectionRange(at, at);
    });
  };

  /** True when the key worked the menu and must not also send or type. */
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!open) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((active + step + matches.length) % matches.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      pick(matches[active]!);
    } else if (event.key === "Escape") {
      setHit(null);
    } else return false;
    event.preventDefault();
    return true;
  };

  const inText = stillMentioned(input.draft, chosen);
  const glyph = (app: AppChoice, size: string) =>
    iconOf(app) ? (
      <img
        src={`data:image/png;base64,${iconOf(app)}`}
        alt=""
        className={cn(size, "shrink-0 rounded-[4px] object-contain")}
      />
    ) : (
      <AppWindow className={cn(size, "shrink-0 text-muted-foreground")} aria-hidden />
    );

  return {
    open,
    /** The device the chosen app is on, for this message's work; null when none was chosen. */
    deviceFor: (text: string) => stillMentioned(text, chosen)[0]?.deviceId ?? null,
    reset: () => {
      setChosen([]);
      setHit(null);
    },
    look,
    close: () => setHit(null),
    onKeyDown,
    comboboxProps: {
      role: "combobox" as const,
      "aria-autocomplete": "list" as const,
      "aria-expanded": open,
      "aria-controls": "jarvis-app-menu",
      ...(open ? { "aria-activedescendant": `jarvis-app-${active}` } : {}),
    },
    chosenLine: inText.length ? (
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        JARVIS will use
        {inText.map((app) => (
          <span
            key={`${app.deviceId}:${app.name}`}
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-foreground"
          >
            {glyph(app, "h-3.5 w-3.5")}
            {app.name}
            {input.multipleDevices ? (
              <span className="text-muted-foreground">· {app.deviceName}</span>
            ) : null}
          </span>
        ))}
      </p>
    ) : null,
    menu: open ? (
      <ul
        id="jarvis-app-menu"
        role="listbox"
        aria-label="Apps on your computers"
        className="glass-strong absolute bottom-full left-0 right-0 z-30 mb-2 max-h-72 overflow-y-auto rounded-2xl p-1.5 shadow-lg"
      >
        {matches.map((app, index) => (
          <li
            key={`${app.deviceId}:${app.name}`}
            id={`jarvis-app-${index}`}
            role="option"
            aria-selected={index === active}
            onMouseDown={(event) => {
              event.preventDefault(); // the composer keeps focus and caret
              pick(app);
            }}
            onMouseEnter={() => setHighlight(index)}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm",
              index === active ? "bg-accent text-foreground" : "text-foreground/90",
            )}
          >
            {glyph(app, "h-5 w-5")}
            <span className="min-w-0 flex-1 truncate">{app.name}</span>
            {input.multipleDevices ? (
              <span className="shrink-0 truncate text-xs text-muted-foreground">
                {app.deviceName}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    ) : null,
  };
}
