import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

/**
 * The one unavoidable website limitation, stated before it can surprise users:
 * the browser needs a connection once to receive the application and model.
 */
export function LocalOnlyOfflineNotice() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [shellCached, setShellCached] = useState(false);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) {
        navigator.serviceWorker?.controller?.postMessage({ type: "OCADE_RETRY_OFFLINE_CACHE" });
      }
    };
    const onMessage = (event: MessageEvent<{ type?: string; complete?: boolean }>) => {
      if (event.data?.type === "OCADE_SHELL_CACHE_STATUS") {
        setShellCached(event.data.complete === true);
      }
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, []);

  return (
    <div
      role="status"
      className="mx-auto mb-3 flex max-w-5xl items-start gap-2 rounded-lg border border-border/60 bg-card/55 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground"
    >
      {online ? <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      <span>
        <strong className="font-medium text-foreground">OCADE AI is local-only.</strong>{" "}
        No prompt is routed to a cloud model. The very first website visit still needs a working
        connection to deliver the page and download the local model once — no website can avoid
        that initial delivery. Interrupted model and shell downloads retry automatically. After
        the application and model finish loading, later visits can run with the network disabled.
        {shellCached ? " The application shell is cached on this device." : ""}
      </span>
    </div>
  );
}
