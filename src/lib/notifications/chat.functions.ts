import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "@/lib/security/session-middleware";
import { chatHookKind } from "./chat-hook";

/** The connected chat app, without its secret address: only which provider and whether one is set. */
export const getChatHook = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ocade_chat_hooks")
      .select("kind")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Your chat app could not be read just now.");
    return { kind: data?.kind ?? null };
  });

/** Connect (or replace) the person's chat app, then send a test so they see it arrive. */
export const saveChatHook = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ url: z.string().trim().max(700) }).parse(i))
  .handler(async ({ data, context }) => {
    const { admit } = await import("@/lib/security/rate-limit.server");
    await admit(context.userId, "save_chat_hook");
    const kind = chatHookKind(data.url);
    if (!kind)
      throw new Error(
        "Paste the incoming-webhook address from Slack, Discord, Microsoft Teams or ntfy.sh.",
      );
    const { error } = await context.supabase
      .from("ocade_chat_hooks")
      .upsert({ user_id: context.userId, kind, url: data.url });
    if (error) throw new Error("That chat app could not be saved.");
    const { postToChat } = await import("./send.server");
    const state = await postToChat({
      userId: context.userId,
      title: "OCADE notifications will arrive here",
      body: "This is a test. Replies here are not read, and nothing here can approve anything.",
    });
    return { kind, test: state };
  });

export const removeChatHook = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("ocade_chat_hooks")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error("That chat app could not be removed.");
    return { removed: true };
  });
