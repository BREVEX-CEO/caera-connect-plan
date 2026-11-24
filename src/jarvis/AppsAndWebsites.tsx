import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { listJarvisAccess, listJarvisDevices } from "@/lib/jarvis/functions";
import { listSkills } from "@/lib/jarvis/skills.functions";
import { directory, search, type EntryKind, type EntryState } from "@/lib/jarvis/directory";
import { useSession } from "@/lib/session";

const TABS: { id: EntryKind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "app", label: "Apps" },
  { id: "website", label: "Websites" },
  { id: "tools", label: "Tool servers" },
  { id: "skill", label: "Skills" },
  { id: "account", label: "Accounts" },
];

const STATE: Record<EntryState, string> = {
  allowed: "Allowed",
  needs_permission: "Needs permission",
  approved: "Approved on the computer, not allowed for JARVIS yet",
  yours: "Your skill",
  not_available: "Not available yet: OCADE has not finished registering with this provider",
};

/**
 * Settings > Devices > Apps & Websites (plan 14E.6, 14E.8): search what JARVIS can use, with each
 * entry's true state. Permissions are changed in the computer's own list above; accounts become
 * connectable only once a registered integration exists.
 */
export function AppsAndWebsites() {
  const { user } = useSession();
  const account = user?.id ?? "";
  const [tab, setTab] = useState<EntryKind | "all">("all");
  const [query, setQuery] = useState("");
  const devices = useQuery({
    queryKey: ["jarvis", "devices", account],
    queryFn: () => listJarvisDevices(),
    enabled: Boolean(user),
  });
  const live = (devices.data ?? []).filter((device) => device.state !== "removed");
  const access = useQueries({
    queries: live.map((device) => ({
      queryKey: ["jarvis", "access", account, device.id],
      queryFn: () => listJarvisAccess({ data: { deviceId: device.id } }),
    })),
  });
  const skills = useQuery({
    queryKey: ["jarvis", "skills", account],
    queryFn: () => listSkills(),
    enabled: Boolean(user),
  });
  const grants = useMemo(
    () => new Map(live.map((device, index) => [device.id, access[index]?.data ?? []])),
    [live, access],
  );
  const entries = search(
    directory(live, grants, skills.data ?? []).filter((e) => tab === "all" || e.kind === tab),
    query,
  );
  return (
    <section aria-labelledby="apps-websites" className="mt-6 space-y-3">
      <h3 id="apps-websites" className="text-sm font-medium">
        Apps &amp; Websites
      </h3>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search apps, websites, tool servers, skills and accounts"
        aria-label="Search apps and websites"
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
      />
      <div role="tablist" aria-label="Kinds" className="flex flex-wrap gap-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-7 rounded-full px-3 py-1 text-xs ${tab === item.id ? "bg-foreground text-background" : "border border-border hover:bg-accent"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {devices.isPending ? <p className="text-xs text-muted-foreground">Reading…</p> : null}
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground" role="status">
          Nothing matches. Pair a computer above to list its apps, or try another word.
        </p>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
          {entries.slice(0, 200).map((entry) => (
            <li key={entry.key} className="flex items-start justify-between gap-3 py-1">
              <span className="min-w-0">
                <span className="block truncate">{entry.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {entry.kind === "account" ? "Account connection" : entry.detail}
                  {entry.device ? ` · ${entry.device}` : ""}
                </span>
              </span>
              <span className="max-w-[50%] text-right text-xs text-muted-foreground">
                {STATE[entry.state]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
