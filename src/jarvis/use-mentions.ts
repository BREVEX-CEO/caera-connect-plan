import { useQuery } from "@tanstack/react-query";
import { listJarvisAccess } from "@/lib/jarvis/functions";
import { rankApps, type InstalledApp, type MentionCandidate } from "@/lib/jarvis/mentions";

/** The selected computer's apps for the @ being typed, ranked; allowed ones first. */
export function useMentionCandidates(
  device: { id: string; installed_apps: unknown } | null,
  query: string | null,
  account: string,
): { candidates: MentionCandidate[]; loading: boolean; failed: boolean } {
  const access = useQuery({
    queryKey: ["jarvis", "access", account, device?.id ?? ""],
    queryFn: () => listJarvisAccess({ data: { deviceId: device!.id } }),
    enabled: Boolean(account && device && query !== null),
  });
  if (!device || query === null) return { candidates: [], loading: false, failed: false };
  const apps = (Array.isArray(device.installed_apps) ? device.installed_apps : []).filter(
    (app): app is InstalledApp =>
      Boolean(app) && typeof app.name === "string" && typeof app.exe === "string",
  );
  return {
    candidates: rankApps(apps, new Set(access.data ?? []), query),
    loading: access.isPending,
    failed: access.isError,
  };
}
