/**
 * Warm the browser's local inference runtime while the device is online.
 *
 * Wllama is intentionally split out of the main JavaScript bundle. Before this
 * warm-up existed, merely opening OCADE did not request that chunk or its WASM
 * binary. Turning the network off before the first question therefore left a
 * perfectly cached shell with no executable inference engine.
 *
 * Model weights remain in OPFS and are handled by the model installer. This
 * module only makes the much smaller executable runtime available offline.
 */

export type RuntimePrimeOutcome =
  | { ok: true; wasmUrl: string }
  | { ok: false; reason: "offline" | "unsupported" | "not_controlled" | "load_failed" };

export interface RuntimePrimeDeps {
  online: boolean;
  serviceWorkerSupported: boolean;
  waitForController: () => Promise<boolean>;
  loadRuntime: () => Promise<{ wasmUrl: string }>;
  fetchAsset: (url: string) => Promise<{ ok: boolean }>;
}

/** Pure, injected orchestration so every failure mode can be verified in tests. */
export async function primeOfflineRuntime(deps: RuntimePrimeDeps): Promise<RuntimePrimeOutcome> {
  if (!deps.online) return { ok: false, reason: "offline" };
  if (!deps.serviceWorkerSupported) return { ok: false, reason: "unsupported" };

  try {
    // Import only after the worker controls this page. The import itself
    // requests a content-hashed JavaScript chunk that the worker must see in
    // order to put it in Cache Storage.
    if (!(await deps.waitForController())) return { ok: false, reason: "not_controlled" };

    const { wasmUrl } = await deps.loadRuntime();
    const response = await deps.fetchAsset(wasmUrl);
    if (!response.ok) return { ok: false, reason: "load_failed" };
    return { ok: true, wasmUrl };
  } catch {
    // Warm-up is an availability improvement, not a reason to break the online
    // application. Readiness diagnostics surface the missing runtime later.
    return { ok: false, reason: "load_failed" };
  }
}

type ServiceWorkerContainerLike = Pick<
  ServiceWorkerContainer,
  "controller" | "ready" | "addEventListener" | "removeEventListener"
>;

async function waitForController(
  serviceWorker: ServiceWorkerContainerLike,
  timeoutMs = 8_000,
): Promise<boolean> {
  await serviceWorker.ready;
  if (serviceWorker.controller) return true;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (controlled: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      serviceWorker.removeEventListener("controllerchange", onControllerChange);
      resolve(controlled);
    };
    const onControllerChange = () => finish(Boolean(serviceWorker.controller));
    const timer = setTimeout(() => finish(Boolean(serviceWorker.controller)), timeoutMs);
    serviceWorker.addEventListener("controllerchange", onControllerChange);
  });
}

/** Browser wrapper used by the application root. Never throws. */
export async function primeOfflineRuntimeFromBrowser(): Promise<RuntimePrimeOutcome> {
  const serviceWorkerSupported =
    typeof navigator !== "undefined" && "serviceWorker" in navigator;

  return primeOfflineRuntime({
    online: typeof navigator !== "undefined" && navigator.onLine,
    serviceWorkerSupported,
    waitForController: () =>
      serviceWorkerSupported ? waitForController(navigator.serviceWorker) : Promise.resolve(false),
    loadRuntime: async () => {
      await import("@wllama/wllama");
      const wasmModule = await import("@wllama/wllama/esm/wasm/wllama.wasm?url");
      return { wasmUrl: wasmModule.default };
    },
    fetchAsset: (url) => fetch(url, { credentials: "same-origin" }),
  });
}
