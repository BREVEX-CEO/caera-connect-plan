/**
 * SETTINGS IS A PANEL, NOT A SECTION OF THE SITE.
 *
 * It used to be nineteen routes under `/settings`, which meant nineteen
 * screens to keep in step, nineteen places to deep-link into, and a navigation
 * hierarchy competing with the product's own. `docs/DECISIONS.md` #3 settles
 * it: Settings opens from Account, as a compact centred panel on the desktop
 * and a full-height sheet on a phone.
 *
 * The categories are fixed by `docs/PRD.md`. They arrive as the phases that
 * own them land; a category is listed only once it has something that works.
 */
import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Loaded when Settings first opens: none of its sections are part of a first visit.
const loadDialog = () => import("./settings-dialog");
const SettingsDialog = lazy(loadDialog);

const SETTINGS_CATEGORIES = [
  "account",
  "appearance",
  "voice",
  "notifications",
  "devices",
  "privacy",
  "billing",
] as const;
export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];

interface SettingsPanelValue {
  open: (category?: SettingsCategory) => void;
  close: () => void;
  /** Starts loading Settings' contents when opening it is likely (its menu opened). */
  preload: () => void;
}

const SettingsPanelContext = createContext<SettingsPanelValue | null>(null);

/** Safe outside the provider: public pages have no account menu to open it. */
export function useSettingsPanel(): SettingsPanelValue {
  return useContext(SettingsPanelContext) ?? NO_PANEL;
}

const NO_PANEL: SettingsPanelValue = { open: () => {}, close: () => {}, preload: () => {} };

export function SettingsPanelProvider({ children }: { children: ReactNode }) {
  const [category, setCategory] = useState<SettingsCategory | null>(null);

  const open = useCallback((next: SettingsCategory = "account") => setCategory(next), []);
  const close = useCallback(() => setCategory(null), []);
  const value = useMemo<SettingsPanelValue>(
    () => ({ open, close, preload: () => void loadDialog() }),
    [open, close],
  );

  /*
   * A LINK CAN OPEN SETTINGS: `?settings=privacy` on any page. Settings is a
   * panel, not a page, so a notification about sessions or two-step has no
   * address of its own to point at; this is that address. Taken once and
   * dropped from the bar, so a reload or Back does not open it again.
   */
  useEffect(() => {
    const url = new URL(window.location.href);
    const asked = url.searchParams.get("settings");
    if (!asked) return;
    if (SETTINGS_CATEGORIES.includes(asked as SettingsCategory))
      setCategory(asked as SettingsCategory);
    url.searchParams.delete("settings");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);

  useEffect(() => {
    if (!category) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [category, close]);

  return (
    <SettingsPanelContext.Provider value={value}>
      {children}
      {category ? (
        <Suspense fallback={null}>
          <SettingsDialog category={category} onCategoryChange={setCategory} onClose={close} />
        </Suspense>
      ) : null}
    </SettingsPanelContext.Provider>
  );
}
