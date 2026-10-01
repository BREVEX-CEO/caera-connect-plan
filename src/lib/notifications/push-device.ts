/**
 * BROWSER NOTIFICATIONS ON THIS DEVICE: TURNED ON HERE, BY THE PERSON, ONLY.
 *
 * The browser asks its own permission question (never bypassed), then gives a
 * push service address that OCADE records for the account signed in now. Turning
 * it off, or signing out, removes this browser's address, so a shared computer
 * does not keep showing the last person's alerts.
 */
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { b64url } from "./web-push";

export type PushDeviceState =
  /** No push here: no service worker or PushManager, or no key on this deployment. */
  | "unsupported"
  /** iPhone/iPad Safari: only a Home Screen web app may receive pushes. */
  | "needs_home_screen"
  /** The person said no in the browser's own prompt; only the browser can undo it. */
  | "denied"
  | "off"
  | "on";

const publicKey = () =>
  (import.meta.env as Record<string, string | undefined>).VITE_WEB_PUSH_PUBLIC_KEY ?? "";

function appleWithoutHomeScreen(): boolean {
  const apple =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return apple && !standalone;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration("/")) ?? null;
}

export async function pushDeviceState(): Promise<PushDeviceState> {
  if (typeof window === "undefined" || !publicKey()) return "unsupported";
  if (!("PushManager" in window) || !("Notification" in window)) {
    return appleWithoutHomeScreen() ? "needs_home_screen" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  const subscription = await (await registration())?.pushManager.getSubscription();
  return subscription ? "on" : "off";
}

/** Called from the person's own press: browsers refuse the prompt otherwise. */
export async function turnPushOn(): Promise<PushDeviceState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const ready = await navigator.serviceWorker.ready;
  const subscription =
    (await ready.pushManager.getSubscription()) ??
    (await ready.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: b64url.decode(publicKey()) })
      .catch(() => {
        // The browser's own push service did not answer; its words name its internals.
        throw new Error(
          "This browser could not reach its notification service just now. Try again later.",
        );
      }));
  const keys = subscription.toJSON().keys ?? {};
  const supabase = await loadSupabaseClient();
  const { error } = await supabase.rpc("ocade_push_subscribe", {
    p_endpoint: subscription.endpoint,
    p_p256dh: keys.p256dh ?? "",
    p_auth: keys.auth ?? "",
  });
  if (error) {
    await subscription.unsubscribe().catch(() => false);
    throw new Error("OCADE could not turn notifications on here just now. Try again.");
  }
  return "on";
}

/** This browser stops receiving them, for whoever is signed in. */
export async function turnPushOff(): Promise<PushDeviceState> {
  const subscription = await (await registration())?.pushManager.getSubscription();
  if (!subscription) return "off";
  const supabase = await loadSupabaseClient();
  await supabase.rpc("ocade_push_unsubscribe", { p_endpoint: subscription.endpoint });
  await subscription.unsubscribe().catch(() => false);
  return "off";
}

/**
 * On sign-out: forget this browser's address in the browser itself. The record
 * left on the server is answered "gone" by the push service at the next send,
 * which removes it; and nobody new is reached here until they turn it on.
 */
export async function forgetPushOnThisBrowser(): Promise<void> {
  const subscription = await (await registration())?.pushManager.getSubscription();
  await subscription?.unsubscribe().catch(() => false);
}
