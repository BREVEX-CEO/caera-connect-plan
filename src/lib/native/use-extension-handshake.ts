import { useCallback, useEffect, useState } from "react";
import { handshakeWithExtension, type Handshake } from "@/lib/native/extension-bridge";

/**
 * Whether the OCADE Cowork extension is on the other end of this page, asked
 * once and shared.
 *
 * WHY THIS IS NOT PRIVATE STATE INSIDE THE NOTICE. Two things need the answer:
 * the notice that tells a person to install the extension, and the Command
 * Center, which reports what this browser can do. Each keeping its own copy
 * would mean two handshakes per visit and, worse, two answers that can
 * disagree about whether OCADE has hands in this browser.
 *
 * THERE IS NO OPTIMISTIC STATE. `ready` is true only after the extension has
 * actually replied and the protocol version is one this build understands — a
 * page cannot know an extension is present until the extension says so.
 */
export function useExtensionHandshake(onReady?: (handshake: Handshake) => void): {
  state: Handshake | null;
  checking: boolean;
  check: () => void;
  ready: boolean;
} {
  const [state, setState] = useState<Handshake | null>(null);
  const [checking, setChecking] = useState(true);

  const run = useCallback(async () => {
    setChecking(true);
    const result = await handshakeWithExtension();
    setState(result);
    setChecking(false);
    if (result.installed && result.compatible) onReady?.(result);
  }, [onReady]);

  useEffect(() => {
    void run();
  }, [run]);

  return {
    state,
    checking,
    check: useCallback(() => void run(), [run]),
    ready: state?.installed === true && state.compatible,
  };
}
