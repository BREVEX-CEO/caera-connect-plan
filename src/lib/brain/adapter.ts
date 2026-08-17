/** OCADE Brain adapter contract. Every registered AI adapter executes on hardware the user controls. */

export type AdapterId =
  | "desktop_bridge"
  | "paired_desktop"
  | "browser_webgpu"
  | "browser_wasm"
  | "mobile_native";

export type AdapterLocality =
  | "on_device"
  | "paired_device";

export interface AdapterCapabilities {
  text: boolean;
  vision: boolean;
  imageGeneration: boolean;
  tools: boolean;
}

export type UnavailableCode =
  | "not_installed"
  | "not_running"
  | "not_paired"
  | "unsupported_device"
  | "insufficient_memory"
  | "insufficient_storage"
  | "no_model"
  | "disabled_by_user"
  | "probe_failed";

export type RemedyAction =
  | "install_ocade"
  | "pair_a_computer"
  | "download_model"
  | "start_engine"
  | "free_storage"
  | "enable_in_settings";

export interface AdapterUnavailable {
  available: false;
  code: UnavailableCode;
  reason: string;
  remedies: RemedyAction[];
}

export interface AdapterReady {
  available: true;
  label: string;
  locality: AdapterLocality;
  capabilities: AdapterCapabilities;
  modelId: string | null;
  measuredFirstTokenMs?: number | null;
}

export type AdapterAvailability = AdapterReady | AdapterUnavailable;

export interface BrainMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
}

export interface BrainStreamHandlers {
  onToken: (chunk: string) => void;
  signal?: AbortSignal;
  think?: boolean;
  tools?: readonly unknown[];
  onToolCall?: (call: { id?: string; name: string; arguments: Record<string, unknown> }) => void;
}

export type BrainStreamResult =
  | { ok: true; modelId: string | null; firstTokenMs: number | null }
  | { ok: false; failure: "cancelled" | "unavailable" | "error"; reason: string };

export interface BrainAdapter {
  readonly id: AdapterId;
  readonly displayName: string;
  probe(): Promise<AdapterAvailability>;
  stream(messages: BrainMessage[], handlers: BrainStreamHandlers): Promise<BrainStreamResult>;
  dispose?(): Promise<void>;
}

export function unavailable(
  code: UnavailableCode,
  reason: string,
  remedies: RemedyAction[] = [],
): AdapterUnavailable {
  return { available: false, code, reason, remedies };
}

export const REMEDY_LABELS: Record<RemedyAction, string> = {
  install_ocade: "Install OCADE",
  pair_a_computer: "Pair a computer",
  download_model: "Download the engine",
  start_engine: "Start the engine",
  free_storage: "Free up storage",
  enable_in_settings: "Enable in settings",
};
