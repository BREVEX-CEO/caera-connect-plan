import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "@/lib/security/session-middleware";

const selection = "id, title, source, due_on, snoozed_until, completed, created_at" as const;
const id = z.uuid();
const date = z.iso.date().nullable();

export const listObligations = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const readPage = (after?: string) => {
      const query = supabase
        .from("ocade_lifeos_obligations")
        .select(selection)
        .eq("user_id", userId)
        .order("id")
        .limit(200);
      return after ? query.gt("id", after) : query;
    };
    const first = await readPage();
    if (first.error) throw new Error("Your obligations could not be read.");
    const items = first.data;
    let page = items;
    while (page.length === 200) {
      const next = await readPage(page.at(-1)!.id);
      if (next.error) throw new Error("Your obligations could not be read.");
      page = next.data;
      items.push(...page);
    }
    return items;
  });

export const saveObligation = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((value) =>
    z
      .strictObject({
        id: id.nullable(),
        title: z.string().trim().min(1).max(120),
        source: z.string().trim().max(300),
        due_on: date,
        snoozed_until: date,
        completed: z.boolean(),
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    const { id: item, ...fields } = data;
    const table = context.supabase.from("ocade_lifeos_obligations");
    const query = item
      ? table.update(fields).eq("id", item).eq("user_id", context.userId)
      : table.insert({ user_id: context.userId, ...fields });
    const result = await query.select("id").single();
    if (result.error) throw new Error("That obligation could not be saved.");
  });

export const removeObligation = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((value) => z.strictObject({ id }).parse(value))
  .handler(async ({ data, context }) => {
    const result = await context.supabase
      .from("ocade_lifeos_obligations")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id")
      .single();
    if (result.error) throw new Error("That obligation could not be removed.");
  });
