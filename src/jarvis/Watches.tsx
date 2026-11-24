import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addJarvisWatch,
  deleteJarvisWatch,
  listJarvisDevices,
  listJarvisWatches,
  setJarvisWatchActive,
} from "@/lib/jarvis/functions";
import { useSession } from "@/lib/session";

/**
 * WHEN A FILE ARRIVES (REPO-61/71): the companion notices new files in one folder of the
 * computer's JARVIS folder by itself, with no AI involved, and each new file starts one run of
 * what the person wrote, with fresh permission checks. Pause or remove a watch at any time.
 */
export function Watches() {
  const { user } = useSession();
  const client = useQueryClient();
  const queryKey = ["jarvis", "watches", user?.id ?? ""];
  const watches = useQuery({ queryKey, queryFn: () => listJarvisWatches() });
  const devices = useQuery({
    queryKey: ["jarvis", "devices", user?.id ?? ""],
    queryFn: () => listJarvisDevices(),
  });
  const live = (devices.data ?? []).filter((device) => device.state !== "removed");
  const [deviceId, setDeviceId] = useState("");
  const [folder, setFolder] = useState("");
  const [what, setWhat] = useState("");
  const refresh = () => void client.invalidateQueries({ queryKey });
  const add = useMutation({
    mutationFn: () => addJarvisWatch({ data: { deviceId: deviceId || live[0]!.id, folder, what } }),
    onSuccess: () => {
      setFolder("");
      setWhat("");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const toggle = useMutation({
    mutationFn: (row: { id: string; active: boolean }) =>
      setJarvisWatchActive({ data: { id: row.id, active: !row.active } }),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteJarvisWatch({ data: { id } }),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (live.length && folder.trim() && what.trim()) add.mutate();
  };
  const name = (id: string) => live.find((device) => device.id === id)?.name ?? "A computer";
  return (
    <section
      aria-labelledby="jarvis-watches"
      className="mt-4 space-y-2 border-t border-border/60 pt-3"
    >
      <h3 id="jarvis-watches" className="font-medium">
        When a file arrives
      </h3>
      <p className="text-xs text-muted-foreground">
        Your computer notices new files in one folder of its JARVIS folder by itself, with no AI
        involved. Each new file starts what you write here once.
      </p>
      {live.length === 0 ? (
        <p className="text-xs text-muted-foreground">Pair a computer first.</p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          {/* Visible labels, examples as placeholders: nothing to remember once typing starts. */}
          {live.length > 1 ? (
            <label className="block text-xs text-muted-foreground">
              Computer
              <select
                value={deviceId || live[0]!.id}
                onChange={(event) => setDeviceId(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              >
                {live.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block text-xs text-muted-foreground">
            Folder inside the JARVIS folder
            <input
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
              placeholder="Invoices"
              maxLength={200}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            What JARVIS does with each new file
            <input
              value={what}
              onChange={(event) => setWhat(event.target.value)}
              placeholder="Add it to the invoice ledger"
              maxLength={400}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
          <button
            type="submit"
            disabled={add.isPending || !folder.trim() || !what.trim()}
            className="rounded-full border border-border px-3 py-1 hover:bg-accent disabled:opacity-50"
          >
            {add.isPending ? "Saving…" : "Watch this folder"}
          </button>
        </form>
      )}
      <ul className="space-y-1">
        {(watches.data ?? []).map((row) => (
          <li key={row.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate">
                {row.folder}: {row.what}
              </span>
              <span className="block text-xs text-muted-foreground">
                {name(row.device_id)} · {row.active ? "Watching" : "Paused"}
              </span>
            </span>
            <button
              type="button"
              aria-label={
                row.active ? `Pause watching ${row.folder}` : `Resume watching ${row.folder}`
              }
              onClick={() => toggle.mutate(row)}
              className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent"
            >
              {row.active ? (
                <Pause className="h-4 w-4" aria-hidden />
              ) : (
                <Play className="h-4 w-4" aria-hidden />
              )}
            </button>
            <button
              type="button"
              aria-label={`Stop watching ${row.folder}`}
              onClick={() => remove.mutate(row.id)}
              className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
