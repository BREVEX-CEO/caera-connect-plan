import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSettingsPanel, type SettingsCategory } from "@/components/settings/settings-panel";
import { matchScore } from "@/lib/jarvis/mentions";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useSession } from "@/lib/session";

/**
 * CTRL/CMD + K: ONE SEARCH FOR WHERE TO GO AND WHAT TO OPEN (plan 14E.3).
 *
 * Commands and Settings, matched the same way as JARVIS's @ list. It only navigates or opens
 * Settings; nothing here grants access or acts on a computer.
 */
interface Command {
  label: string;
  /** Extra words people search with. */
  words: string;
  run: (go: Go) => void;
}

interface Go {
  navigate: ReturnType<typeof useNavigate>;
  settings: (category: SettingsCategory) => void;
}

const COMMANDS: Command[] = [
  {
    label: "New chat",
    words: "start conversation ask",
    run: ({ navigate }) => void navigate({ to: "/", search: { new: true } }),
  },
  {
    label: "Chat",
    words: "conversation ask online offline",
    run: ({ navigate }) => void navigate({ to: "/" }),
  },
  {
    label: "OCADE JARVIS",
    words: "computer agent task device pc",
    run: ({ navigate }) => void navigate({ to: "/ocade-jarvis" }),
  },
  {
    label: "Library",
    words: "files uploads documents",
    run: ({ navigate }) => void navigate({ to: "/library" }),
  },
  {
    label: "Help",
    words: "faq support questions shortcuts",
    run: ({ navigate }) => void navigate({ to: "/help" }),
  },
  {
    label: "Pricing",
    words: "plans billing upgrade",
    run: ({ navigate }) => void navigate({ to: "/pricing" }),
  },
  {
    label: "Settings: Account",
    words: "email sign in two-step delete sign out",
    run: ({ settings }) => settings("account"),
  },
  {
    label: "Settings: Preferences",
    words: "theme dark light appearance voice notifications language",
    run: ({ settings }) => settings("preferences"),
  },
  {
    label: "Settings: Devices",
    words: "computer pair jarvis permissions apps",
    run: ({ settings }) => settings("devices"),
  },
  {
    label: "Settings: Privacy & Security",
    words: "memory export delete library offline mode",
    run: ({ settings }) => settings("privacy"),
  },
  {
    label: "Settings: Billing & Usage",
    words: "allowance plan subscription invoice",
    run: ({ settings }) => settings("billing"),
  },
  {
    label: "Settings: BYOK",
    words: "byok own model keys api key gateway provider",
    run: ({ settings }) => settings("byok"),
  },
];

function rankCommands(query: string, signedIn: boolean): Command[] {
  // Settings belong to an account: signed out, those entries would do nothing.
  return COMMANDS.filter((command) => signedIn || !command.label.startsWith("Settings"))
    .map((command) => ({
      command,
      score: Math.max(
        matchScore(query, { name: command.label, exe: "" }),
        matchScore(query, { name: command.words, exe: "" }) - 1,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ command }) => command);
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const panel = useSettingsPanel();
  const dialog = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useModalFocus(dialog, open, close);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if ((!event.ctrlKey && !event.metaKey) || event.shiftKey || event.code !== "KeyK") return;
      // Leave approvals, consent and identity confirmation in control of focus.
      const top = document.activeElement?.closest('[aria-modal="true"]');
      if (top && top !== dialog.current && !top.hasAttribute("data-allows-command-palette")) return;
      event.preventDefault();
      setOpen((current) => !current);
      setQuery("");
      setActive(0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const signedIn = Boolean(useSession().user);
  const results = useMemo(() => rankCommands(query, signedIn), [query, signedIn]);
  const activeIndex = Math.min(active, results.length - 1);
  if (!open) return null;

  const run = (command: Command | undefined) => {
    if (!command) return;
    setOpen(false);
    command.run({ navigate, settings: (category) => panel.open(category) });
  };

  return (
    <div
      className="fixed inset-0 z-[55] flex items-start justify-center bg-black/40 px-4 pt-[15dvh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Search commands and settings"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-background shadow-xl"
      >
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const count = results.length;
              if (!count) return;
              const next = (activeIndex + (event.key === "ArrowDown" ? 1 : count - 1)) % count;
              setActive(next);
              document
                .getElementById(`ocade-command-${next}`)
                ?.scrollIntoView({ block: "nearest" });
            } else if (event.key === "Enter") {
              event.preventDefault();
              run(results[activeIndex]);
            }
          }}
          role="combobox"
          aria-label="Search commands and settings"
          aria-expanded={results.length > 0}
          aria-controls="ocade-commands"
          aria-activedescendant={activeIndex >= 0 ? `ocade-command-${activeIndex}` : undefined}
          placeholder="Search commands and settings"
          className="h-12 w-full border-b border-border bg-transparent px-4 text-base placeholder:text-muted-foreground focus-visible:outline-offset-[-2px]"
        />
        <ul
          id="ocade-commands"
          role="listbox"
          aria-label="Commands"
          hidden={results.length === 0}
          className="max-h-[min(20rem,65dvh)] overflow-y-auto py-1"
        >
          {results.map((command, index) => (
            <li
              key={command.label}
              id={`ocade-command-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActive(index)}
              onClick={() => run(command)}
              className={
                "flex min-h-11 cursor-pointer items-center px-4 py-2 text-sm text-foreground " +
                (index === activeIndex ? "bg-accent" : "")
              }
            >
              {command.label}
            </li>
          ))}
        </ul>
        {results.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground" role="status">
            Nothing matches. Try another word.
          </p>
        ) : null}
      </div>
    </div>
  );
}
