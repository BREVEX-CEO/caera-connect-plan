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

/**
 * Where a preference change ended up, and whether it survived.
 *
 * `scope` is the strongest store the change reached: `cloud` means it will
 * follow the account to a new session on another device, `local` means it
 * survives a refresh on this browser only, and `none` means nothing could be
 * written — the change is live in memory and will be lost on reload. The UI
 * says which of the three happened instead of implying every switch is saved.
 */
export type AppearancePersistenceStatus = "idle" | "saving" | "saved" | "error";
export type AppearancePersistenceScope = "cloud" | "local" | "none";

export interface AppearancePersistence {
  status: AppearancePersistenceStatus;
  scope: AppearancePersistenceScope;
  /** Plain-language reason shown to the user when status is `error`. */
  message: string | null;
  /** True once a signed-in account's stored row has been read back. */
  loadedFromCloud: boolean;
  /** Set when the stored preferences could not be READ (as opposed to written). */
  loadError: string | null;
  lastSavedAt: number | null;
  /** True while a failed write is still queued for retry. */
  hasPendingChanges: boolean;
}

/**
 * The automatic performance fallback, as the UI needs to describe it.
 *
 * `active` is what the detector decided; `overridden` is the person saying
 * "keep full quality on this device anyway". Both are exposed so the panel can
 * say the fallback WOULD apply while honouring the override.
 */
export interface PerfFallbackState {
  active: boolean;
  trigger: "device" | "frames" | null;
  /** The specific signal, when the trigger was a static device check. */
  reason: string | null;
  overridden: boolean;
  /** The exact list of what gets turned down. */
  changes: string[];
}

export interface AppearanceContextValue extends AppearancePrefs {
  osReducedMotion: boolean;
  autoLowPerf: boolean;
  perfFallback: PerfFallbackState;
  /** Ignore the automatic fallback on this browser. */
  keepFullQuality: () => void;
  /** Hand control back to the detector. */
  resumeAutoFallback: () => void;
  update: (patch: Partial<AppearancePrefs>) => Promise<void>;
  persistence: AppearancePersistence;
  /** Re-attempt the last failed write / read. */
  retryPersist: () => Promise<void>;
}

export const ThemeContext = createContext<AppearanceContextValue | null>(null);

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppearance must be used inside <ThemeProvider>");
  }
  return ctx;
}
