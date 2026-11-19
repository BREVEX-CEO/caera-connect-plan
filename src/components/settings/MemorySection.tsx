import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState, type FormEvent } from "react";
import { useSession } from "@/lib/session";
import { Action, Confirm, Pending, Row, Toggle, describeWhen } from "./rows";

/**
 * MEMORY: WHAT THE PERSON ASKED OCADE TO REMEMBER (plan 14E.1; UX-04, UX-27, UX-29, UX-34).
 *
 * Off until the person turns it on. Only what they type here is kept: nothing is inferred from
 * chats, files or screens. Turning it off stops its use in Chat at once and keeps the items;
 * Forget removes an item, and Forget everything removes them all. Every state shown is the
 * database's own answer.
 */
interface Memory {
  id: string;
  content: string;
  created_at: string;
}

async function readMemory(userId: string): Promise<{ enabled: boolean; items: Memory[] }> {
  const { supabase } = await import("@/integrations/supabase/client");
  const [profile, items] = await Promise.all([
    supabase.from("profiles").select("memory_enabled").eq("id", userId).single(),
    supabase
      .from("jarvis_memories")
      .select("id, content, created_at")
      .order("created_at", { ascending: false }),
  ]);
  if (profile.error || items.error) throw new Error("memory_unavailable");
  return { enabled: profile.data.memory_enabled, items: items.data };
}

export function MemorySection() {
  const { user } = useSession();
  const client = useQueryClient();
  const id = useId();
  const [problem, setProblem] = useState<string | null>(null);
  const [forgettingAll, setForgettingAll] = useState(false);
  const memory = useQuery({
    queryKey: ["memory", user?.id],
    queryFn: () => readMemory(user!.id),
    enabled: Boolean(user),
    staleTime: 0,
  });
  const refresh = () => client.invalidateQueries({ queryKey: ["memory", user?.id] });
  const change = useMutation({
    mutationFn: async (run: () => PromiseLike<{ error: { message: string } | null }>) => {
      const { error } = await run();
      if (error) throw new Error("That could not be saved. Nothing was changed.");
    },
    onSuccess: () => {
      setProblem(null);
      setForgettingAll(false);
      void refresh();
    },
    onError: (error) => setProblem(error.message),
  });
  const supabase = () => import("@/integrations/supabase/client").then((m) => m.supabase);

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const field = form.elements.namedItem("memory") as HTMLTextAreaElement;
    const content = field.value.trim();
    if (!content || !user) return;
    change.mutate(async () => {
      const result = await (
        await supabase()
      )
        .from("jarvis_memories")
        .insert({ user_id: user.id, content });
      if (!result.error) field.value = "";
      return result;
    });
  };

  return (
    <div className="border-b border-border/50 py-2">
      <Pending
        query={memory}
        loading="Reading your memory…"
        problem="Your memory could not be read. Nothing was changed."
      />
      {memory.data ? (
        <>
          <Row
            label="Memory"
            description="When on, Chat uses what you ask OCADE to remember below. Only what you type here is kept; nothing is learned from your chats, files or screen. Off keeps the items but stops using them."
          >
            <Toggle
              label="Memory"
              checked={memory.data.enabled}
              onChange={(enabled) =>
                change.mutate(async () =>
                  (await supabase()).rpc("ocade_set_memory_enabled", { p_enabled: enabled }),
                )
              }
            />
          </Row>
          <form onSubmit={add} className="space-y-2 py-3">
            <label
              className="block text-[0.8125rem] text-muted-foreground"
              htmlFor={`${id}-memory`}
            >
              Something to remember (up to 500 characters; never a password or key)
            </label>
            <textarea
              id={`${id}-memory`}
              name="memory"
              maxLength={500}
              rows={2}
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={change.isPending}
              className="h-8 rounded-md border border-border px-3 text-sm text-foreground hover:bg-accent disabled:opacity-50"
            >
              Remember
            </button>
          </form>
          {memory.data.items.length === 0 ? (
            <p className="pb-3 text-[0.8125rem] text-muted-foreground">Nothing remembered.</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {memory.data.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 py-2">
                  <div className="min-w-0 text-sm">
                    <p className="break-words text-foreground">{item.content}</p>
                    <p className="text-[0.8125rem] text-muted-foreground">
                      You added this {describeWhen(item.created_at)}
                    </p>
                  </div>
                  <Action
                    label="Forget"
                    busy={change.isPending}
                    onClick={() =>
                      change.mutate(async () =>
                        (await supabase()).from("jarvis_memories").delete().eq("id", item.id),
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          {memory.data.items.length > 0 ? (
            <Row label="Forget everything" description="Removes every remembered item for good.">
              {forgettingAll ? (
                <Confirm
                  label="Forget all"
                  busy={change.isPending}
                  onConfirm={() =>
                    change.mutate(async () =>
                      (await supabase()).from("jarvis_memories").delete().eq("user_id", user!.id),
                    )
                  }
                  onCancel={() => setForgettingAll(false)}
                />
              ) : (
                <Action label="Forget all" destructive onClick={() => setForgettingAll(true)} />
              )}
            </Row>
          ) : null}
          {problem ? (
            <p role="alert" className="pb-2 text-[0.8125rem] text-destructive">
              {problem}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
