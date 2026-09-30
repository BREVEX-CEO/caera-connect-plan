import { toast } from "sonner";
import { readJarvisAction, stopAllJarvis } from "./jarvis.functions";

/**
 * STOP JARVIS: every unfinished task of this account, on every device. The
 * server records it at once; "Stopped" is said only when every computer that
 * was running a step confirms it ended there. One authority for the page's
 * round STOP and the phone bubble's Stop.
 */
export async function stopEverywhere(recorded: () => void = () => undefined): Promise<void> {
  let result: Awaited<ReturnType<typeof stopAllJarvis>>;
  try {
    result = await stopAllJarvis();
  } catch {
    toast.error("JARVIS could not be stopped. Try again.");
    return;
  }
  recorded();
  if (!result.running.length) {
    toast.success(result.stopped ? "JARVIS stopped." : "Nothing was running.");
    return;
  }
  const id = toast.loading("Stopping…");
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const acks = await Promise.all(
      result.running.map((action) => readJarvisAction({ data: { id: action } }).catch(() => null)),
    );
    if (acks.every((a) => (a?.result as { status?: string } | null)?.status === "stopped")) {
      toast.success("JARVIS stopped.", { id });
      return;
    }
  }
  toast.warning("Your computer has not confirmed the stop yet. Check that it is online.", { id });
}
