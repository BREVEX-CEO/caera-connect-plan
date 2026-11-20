import { useQuery } from "@tanstack/react-query";
import { listJarvisAccess } from "@/lib/jarvis/functions";
import { listSkills } from "@/lib/jarvis/skills.functions";
import {
  deviceResources,
  rankApps,
  type InstalledApp,
  type MentionCandidate,
} from "@/lib/jarvis/mentions";

/** The selected computer's apps, websites and tool servers for the @ being typed, ranked. */
export function useMentionCandidates(
  device: { id: string; installed_apps: unknown; capabilities?: unknown } | null,
  query: string | null,
  account: string,
): { candidates: MentionCandidate[]; loading: boolean; failed: boolean } {
  const access = useQuery({
    queryKey: ["jarvis", "access", account, device?.id ?? ""],
    queryFn: () => listJarvisAccess({ data: { deviceId: device!.id } }),
    enabled: Boolean(account && device && query !== null),
  });
  const skills = useQuery({
    queryKey: ["jarvis", "skills", account],
    queryFn: () => listSkills(),
    enabled: Boolean(account && query !== null),
  });
  if (!device || query === null) return { candidates: [], loading: false, failed: false };
  const apps = (Array.isArray(device.installed_apps) ? device.installed_apps : []).filter(
    (app): app is InstalledApp =>
      Boolean(app) && typeof app.name === "string" && typeof app.exe === "string",
  );
  const grants = access.data ?? [];
  const caps = device.capabilities as { mcp?: unknown } | null | undefined;
  const mcp = Array.isArray(caps?.mcp) ? (caps.mcp as { id?: unknown }[]) : [];
  return {
    candidates: rankApps(
      deviceResources(apps, grants, mcp, skills.data ?? []),
      new Set(grants),
      query,
    ),
    loading: access.isPending,
    failed: access.isError,
  };
}
