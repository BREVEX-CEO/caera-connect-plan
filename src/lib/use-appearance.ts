import { createContext, useContext } from "react";

/**
 * Appearance state: the shape, the context and the accessor.
 *
 * Split from `theme-provider.tsx` so the provider file exports a component and
 * nothing else. `useAppearance` is called from the shell, the settings screens
 * and the visual-response surface; a module that exports both a component and a
 * hook cannot be hot-replaced, so every theme tweak forced a full page reload.
 */

export type ThemeMode = "dark" | "light" | "real";
export type CursorKind =
  "system" | "caera_black" | "caera_white" | "auto_contrast" | "custom" | "accessibility";

export interface AppearancePrefs {
  theme: ThemeMode;
  reducedMotion: boolean; // user override; OS preference is always respected on top
  highContrast: boolean;
  lowPerformance: boolean; // user override; auto-detector may also flip it on
  cursor: CursorKind;
  cursorCustom: string | null; // data URL for uploaded PNG/SVG
  cursorSize: number; // 16..64
  cursorTrail: boolean;
}

export interface AppearanceContextValue extends AppearancePrefs {
  osReducedMotion: boolean;
  autoLowPerf: boolean;
  update: (patch: Partial<AppearancePrefs>) => Promise<void>;
}

export const ThemeContext = createContext<AppearanceContextValue | null>(null);

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppearance must be used inside <ThemeProvider>");
  }
  return ctx;
}
