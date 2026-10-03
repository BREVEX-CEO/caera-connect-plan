import { createServerFn } from "@tanstack/react-start";
import { agentReleaseFrom, type AgentRelease } from "./release";

/** What the Devices panel may offer to download. Null when no release is published. */
export const readAgentRelease = createServerFn({ method: "GET" }).handler(
  async (): Promise<AgentRelease | null> => {
    const environment = (globalThis as { __env__?: Record<string, unknown> }).__env__;
    const store = environment?.["OCADE_MODELS"] as
      { get(key: string): Promise<{ text(): Promise<string> } | null> } | undefined;
    const object = await store?.get("agent/manifest.json").catch(() => null);
    if (!object) return null;
    try {
      return agentReleaseFrom(JSON.parse(await object.text()));
    } catch {
      return null;
    }
  },
);
