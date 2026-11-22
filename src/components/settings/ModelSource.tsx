import { useQuery } from "@tanstack/react-query";
import { readByok, sourceLabel } from "@/lib/byok/connections";
import { useSettingsPanel } from "./settings-panel";

/**
 * WHICH SOURCE ANSWERS, AT THE COMPOSER (plan 14B.1B.4): "OCADE-managed" or "Your key: alias",
 * read from the server's own record of the person's choice. Pressing it opens Settings > BYOK,
 * the one place the choice is changed; it never changes on its own.
 */
export function ModelSource({
  surface,
  automatic = false,
}: {
  surface: "chat" | "jarvis";
  automatic?: boolean;
}) {
  const settings = useSettingsPanel();
  const state = useQuery({ queryKey: ["byok"], queryFn: readByok, staleTime: 60_000 });
  const source = state.isPending
    ? "Checking model source…"
    : state.isError
      ? "Model source unknown"
      : sourceLabel(state.data, surface);
  const label = automatic && state.isSuccess ? `Online source: ${source}` : source;
  return (
    <button
      type="button"
      onClick={() => settings.open("byok")}
      title="Change which models answer, in Settings > BYOK"
      className="mr-1 min-h-6 min-w-0 max-w-full rounded-md px-2 py-1 text-right text-xs break-words text-muted-foreground hover:text-foreground"
    >
      {label}
    </button>
  );
}
