import { useEffect, useRef } from "react";
import Markdown from "react-markdown";
import { Copy } from "lucide-react";
import type { ChatMessageRecord } from "@/lib/ocade-chat-store";
import { cn } from "@/lib/utils";

/**
 * The transcript.
 *
 * A question is a compact bubble and an answer is plain prose across the
 * column, because that is what each one is: the question is a thing somebody
 * said and the answer is something to read. Giving both the same bubble makes
 * a long answer a wall.
 *
 * ONLY A REAL ANSWER GETS CONTROLS. `docs/PRD.md` forbids rendering a failed
 * request as a reply with Export and Save beside it, so Copy appears on a
 * finished assistant message and on nothing else.
 */
export function MessageList({
  messages,
  streaming,
  loading,
}: {
  messages: ChatMessageRecord[];
  streaming: string;
  loading: boolean;
}) {
  const bottom = useRef<HTMLDivElement>(null);

  // Follows the answer as it arrives, and lands on the last turn when a
  // conversation is opened.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length, streaming]);

  return (
    <div className="ocade-scroll flex-1 overflow-y-auto px-5 pt-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        {loading ? (
          <p className="text-sm text-muted-foreground" role="status">
            Opening this conversation…
          </p>
        ) : null}

        {messages.map((message) => (
          <Turn key={message.id} message={message} />
        ))}

        {streaming ? (
          <div className="text-[15px] leading-7 text-foreground">
            <Prose text={streaming} />
          </div>
        ) : null}

        <div ref={bottom} className="h-2" />
      </div>
    </div>
  );
}

function Turn({ message }: { message: ChatMessageRecord }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className={cn(
            "max-w-[85%] whitespace-pre-wrap rounded-2xl bg-secondary px-4 py-2.5 text-[15px] leading-6 text-secondary-foreground",
            message.unsynced && "opacity-70",
          )}
        >
          {message.content}
          {message.unsynced ? (
            <span className="mt-1 block text-xs text-muted-foreground">
              Waiting to be saved to your account.
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="group text-[15px] leading-7 text-foreground">
      <Prose text={message.content} />
      <button
        type="button"
        onClick={() => void navigator.clipboard?.writeText(message.content)}
        className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden />
        Copy
      </button>
    </div>
  );
}

/**
 * Markdown, with no HTML plugin and no syntax-highlighting bundle.
 *
 * `react-markdown` escapes HTML by default, which is the property that matters
 * here: a model's output is untrusted text, and a plugin that rendered raw HTML
 * would make every answer a place to put a script tag.
 */
function Prose({ text }: { text: string }) {
  return (
    <div className="[&_a]:text-foreground [&_a]:underline [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_h1]:mt-5 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-medium [&_li]:mt-1 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-3 [&_p:first-child]:mt-0 [&_pre]:ocade-scroll [&_pre]:mt-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-secondary [&_pre]:p-3 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
      <Markdown>{text}</Markdown>
    </div>
  );
}
