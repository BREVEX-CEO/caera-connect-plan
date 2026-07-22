import { useCallback, useEffect, useRef, useState } from "react";
import {
  discoverLocalModels,
  DEFAULT_LOCAL_BRIDGE_URL,
  type LocalDiscovery,
} from "./ocade-local";

export type LocalEngineStatus = "idle" | "checking" | "ready" | "unavailable";

export interface LocalEngineState extends LocalDiscovery {
  status: LocalEngineStatus;
  refresh: () => void;
}

/**
 * Detects and monitors the on-device OCADE Local engine (Ollama-compatible)
 * from the browser. Purely a read/health probe — no prompts are sent. Exposes
 * the discovered models (already classified into OCADE capability labels) and a
 * manual refresh. Raw model names stay internal to the discovery result.
 */
export function useLocalEngine(
  bridgeUrl: string = DEFAULT_LOCAL_BRIDGE_URL,
  enabled = true,
): LocalEngineState {
  const [state, setState] = useState<LocalDiscovery>({ ok: false, reachable: false, models: [] });
  const [status, setStatus] = useState<LocalEngineStatus>("idle");
  const active = useRef(true);

  const refresh = useCallback(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    void discoverLocalModels(bridgeUrl).then((d) => {
      if (!active.current) return;
      setState(d);
      setStatus(d.ok ? "ready" : "unavailable");
    });
  }, [bridgeUrl, enabled]);

  useEffect(() => {
    active.current = true;
    refresh();
    return () => {
      active.current = false;
    };
  }, [refresh]);

  return { ...state, status, refresh };
}
