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
  /**
   * Whether surfaces sit at real depths in the perspective scene.
   *
   * SEPARATE FROM `reducedMotion` ON PURPOSE. Reduced motion keeps the depth
   * and drops the pointer tilt — a still 3D scene contains no motion. This is
   * the other axis: somebody who finds layered surfaces distracting, or who is
   * screen-sharing at a low bitrate where the shadows band, can flatten the
   * interface without also disabling every transition in the product.
   */
  depth3d: boolean;
  /**
   * How pronounced the third dimension is, as a percentage of the designed
   * scale. 100 is the tuned default; 0 is indistinguishable from `depth3d`
   * off, and 200 is the most the geometry stays readable at.
   */
  depthStrength: number; // 0..200
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
