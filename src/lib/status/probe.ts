/**
 * RUNNING THE CHECKS.
 *
 * The catalogue says what OCADE reports on and how each item is decided; this
 * carries the decisions out. Everything it needs from the outside — `fetch`, a
 * clock, the browser's capabilities, whether an account binding exists — is
 * injected, so the same code runs on the server for the public feed and in the
 * browser for the status page, and both are testable without a network.
 *
 * A CHECK THAT COULD NOT RUN REPORTS `unknown`, NEVER `operational`. That is
 * the whole discipline of this file: there is no path here that produces a
 * green row without a response to point at.
 */

import { STATUS_COMPONENTS, type StatusComponent } from "./catalogue";
import { stateFromResponse, type ComponentObservation } from "./state";

export interface ProbeEnvironment {
  /** Resolves the URL a component's path is requested from. */
  origin: string;
  fetch: typeof fetch;
  now: () => Date;
  /** True when this deployment has an account binding configured. */
  accountBindingConfigured: boolean;
  /**
   * Reports whether the CURRENT BROWSER can run an on-device engine. Absent on
   * the server, where the honest answer is that there is no browser to ask.
   */
  browserCapability?: (capability: string) => boolean | null;
  /** How long a single probe may take before it is called an outage. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 8000;

/** Every component in the catalogue, checked. */
export async function probeAll(environment: ProbeEnvironment): Promise<ComponentObservation[]> {
  return Promise.all(STATUS_COMPONENTS.map((component) => probeOne(component, environment)));
}

export async function probeOne(
  component: StatusComponent,
  environment: ProbeEnvironment,
): Promise<ComponentObservation> {
  const observedAt = environment.now().toISOString();
  const base = {
    componentId: component.id,
    observedAt,
    deviceSpecific: component.deviceSpecific,
  };

  switch (component.evidence.kind) {
    case "http": {
      const status = await requestStatus(
        `${environment.origin}${component.evidence.path}`,
        environment,
      );
      return {
        ...base,
        state: stateFromResponse(status),
        detail:
          status === null
            ? `${component.evidence.path} could not be reached from here.`
            : `${component.evidence.path} responded ${status}.`,
      };
    }
    case "configuration": {
      /*
       * Deliberately not called operational. "Configured" says the deployment
       * has somewhere to talk to; it says nothing about whether that somewhere
       * is answering, and reporting it as green would be a health claim made
       * out of an environment variable.
       */
      return {
        ...base,
        state: environment.accountBindingConfigured ? "unknown" : "outage",
        detail: environment.accountBindingConfigured
          ? "An account binding is configured. OCADE does not probe the provider from this page, so this is not a health check."
          : "No account binding is configured on this deployment, so signing in and reading your own work cannot work.",
      };
    }
    case "browser-capability": {
      const capable = environment.browserCapability?.(component.evidence.capability) ?? null;
      if (capable === null) {
        return {
          ...base,
          state: "unknown",
          detail: "This check runs in your browser and was not run here.",
        };
      }
      return {
        ...base,
        state: capable ? "operational" : "degraded",
        detail: capable
          ? "This browser can run an on-device engine."
          : "This browser reports neither WebGPU nor WebAssembly, so Offline Intelligence cannot run on it. This is a property of your browser, not of OCADE.",
      };
    }
    default:
      return { ...base, state: "unknown", detail: "No evidence is defined for this component." };
  }
}

/**
 * One request, bounded.
 *
 * `null` means it never completed — a refusal, a DNS failure, or the timeout —
 * and the caller turns that into an outage. Without the bound, a hung request
 * leaves the page saying "checking" forever, which is the one state a status
 * page must never get stuck in.
 */
async function requestStatus(url: string, environment: ProbeEnvironment): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), environment.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await environment.fetch(url, {
      // Never cached: a status page reading a cached 200 from ten minutes ago
      // reports an outage as operational.
      cache: "no-store",
      headers: { accept: "application/json, text/html;q=0.9" },
      signal: controller.signal,
    });
    return response.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * What this browser can do, asked of the browser rather than assumed.
 *
 * Returns `null` off a browser, which is what makes the server's feed say "not
 * checked here" instead of inventing an answer about somebody's laptop.
 */
export function browserEngineCapability(capability: string): boolean | null {
  if (capability !== "webgpu-or-wasm") return null;
  if (typeof globalThis.navigator === "undefined") return null;
  const hasWebGpu = "gpu" in globalThis.navigator;
  const hasWasm = typeof globalThis.WebAssembly !== "undefined";
  return hasWebGpu || hasWasm;
}
