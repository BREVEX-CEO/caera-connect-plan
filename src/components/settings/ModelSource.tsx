import { useQuery } from "@tanstack/react-query";
import { readByok, sourceLabel } from "@/lib/byok/connections";
import { useSettingsPanel } from "./settings-panel";

/**
 * WHICH SOURCE ANSWERS, AT THE COMPOSER (plan 14B.1B.4): "OCADE-managed" or "Your key: alias",
 * read from the server's own record of the person's choice. Pressing it opens Settings > BYOK,
 * the one place the choice is changed; it never changes on its own.
 */
export function ModelSource({ surface }: { surface: "chat" | "jarvis" }) {
  const settings = useSettingsPanel();
  const state = useQuery({ queryKey: ["byok"], queryFn: readByok, staleTime: 60_000 });
  if (state.isPending) return null;
  const label = state.isError ? "Model source unknown" : sourceLabel(state.data, surface);
  return (
    <button
      type="button"
      onClick={() => settings.open("byok")}
      title="Change which models answer, in Settings > BYOK"
      className="mr-1 h-6 max-w-[12rem] truncate rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
    >
      {label}
    </button>
  );
}
