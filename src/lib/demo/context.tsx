import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEMO_COMPANY,
  DEMO_INVOICES,
  DEMO_TIMESHEET,
  DEMO_TASKS,
  DEMO_FILES,
  DEMO_COMPANY_CHAT,
  DEMO_OCADE_MESSAGES,
  DEMO_RESUME,
  DEMO_REPORTS,
} from "./data";

const DEMO_FLAG_KEY = "caera:demo";

export function isDemoActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(DEMO_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function markDemoActive(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DEMO_FLAG_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearDemoActive(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DEMO_FLAG_KEY);
  } catch {
    /* ignore */
  }
}

type DemoState = {
  company: typeof DEMO_COMPANY;
  invoices: typeof DEMO_INVOICES;
  timesheet: typeof DEMO_TIMESHEET;
  tasks: typeof DEMO_TASKS;
  files: typeof DEMO_FILES;
  companyChat: typeof DEMO_COMPANY_CHAT;
  ocadeMessages: { role: "assistant" | "user"; content: string }[];
  resume: typeof DEMO_RESUME;
  reports: typeof DEMO_REPORTS;
};

function seed(): DemoState {
  return {
    company: DEMO_COMPANY,
    invoices: [...DEMO_INVOICES],
    timesheet: [...DEMO_TIMESHEET],
    tasks: [...DEMO_TASKS],
    files: [...DEMO_FILES],
    companyChat: [...DEMO_COMPANY_CHAT],
    ocadeMessages: [...DEMO_OCADE_MESSAGES] as { role: "assistant" | "user"; content: string }[],
    resume: DEMO_RESUME,
    reports: [...DEMO_REPORTS],
  };
}

type DemoContextValue = {
  active: boolean;
  state: DemoState;
  /** In-memory sample update. Never touches Supabase. */
  addOcadeMessage: (role: "assistant" | "user", content: string) => void;
  addChatMessage: (author: string, body: string) => void;
  markTaskDone: (id: string) => void;
  reset: () => void;
  exit: () => void;
};

const Ctx = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(() => seed());
  const [active, setActive] = useState(false);

  useEffect(() => {
    markDemoActive();
    setActive(true);
  }, []);

  const value = useMemo<DemoContextValue>(
    () => ({
      active,
      state,
      addOcadeMessage: (role, content) =>
        setState((s) => ({ ...s, ocadeMessages: [...s.ocadeMessages, { role, content }] })),
      addChatMessage: (author, body) =>
        setState((s) => ({
          ...s,
          companyChat: [
            ...s.companyChat,
            {
              id: `c${s.companyChat.length + 1}`,
              author,
              ts: new Date().toISOString().slice(11, 16),
              body,
            },
          ],
        })),
      markTaskDone: (id) =>
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: "Done" } : t)),
        })),
      reset: () => setState(seed()),
      exit: () => {
        clearDemoActive();
        setActive(false);
      },
    }),
    [state, active],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo(): DemoContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDemo must be used inside DemoProvider (route under /demo/*).");
  return v;
}
