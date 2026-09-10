import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ClipboardList, Copy, MessageSquareText, Search, Wrench } from "lucide-react";

/**
 * STARTING PROMPTS, INSIDE ARTIFACTS.
 *
 * `PLAN.md` §4: "Studio, templates, generated outputs, and live outputs into
 * Artifacts." Templates were a destination of their own holding four
 * paragraphs, which is the shape §17 calls a wall of buttons: a rail entry, a
 * page load and a back button, to read something that fits in a card.
 *
 * WHAT THEY ARE, SAID PLAINLY. These are reusable openings for a conversation.
 * Nothing here runs, schedules or automates anything, and the old page was
 * careful about that — it is carried across, because a "template" that looks
 * like a workflow is a promise the product does not keep.
 */

const TEMPLATES = [
  {
    title: "Research brief",
    icon: Search,
    prompt:
      "Research this topic, separate verified facts from inference, cite the strongest evidence, and end with the open questions that still matter.",
  },
  {
    title: "Work plan",
    icon: ClipboardList,
    prompt:
      "Turn this goal into an execution plan with milestones, dependencies, risks, owners or decision points, and a clear definition of done.",
  },
  {
    title: "Build / debug",
    icon: Wrench,
    prompt:
      "Inspect the evidence first, identify the smallest root-cause fix, implement it without weakening safety checks, and verify the result before calling it complete.",
  },
  {
    title: "Decision memo",
    icon: MessageSquareText,
    prompt:
      "Compare the realistic options, state the tradeoffs and unknowns, recommend one choice, and explain what evidence would change the recommendation.",
  },
] as const;

export function TemplatesSection() {
  const [copied, setCopied] = useState<string | null>(null);

  /*
   * COPY, RATHER THAN A BUTTON THAT CLAIMS TO OPEN CHAT WITH IT.
   *
   * Chat takes a conversation id in its search params, not a prompt, so a
   * "Use this" button would have to invent a conversation before the person
   * has decided to start one. Copying puts the text where they can edit it
   * first, which is what people do with a starting prompt anyway.
   */
  const copy = async (title: string, prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(title);
      window.setTimeout(() => setCopied((current) => (current === title ? null : current)), 2_000);
    } catch {
      // A refused clipboard is not an error worth a dialog: the text is on
      // screen and can be selected. Saying nothing false is the whole job.
      setCopied(null);
    }
  };

  return (
    <section aria-labelledby="artifacts-templates" className="mt-8">
      <h2 id="artifacts-templates" className="text-sm font-semibold text-foreground">
        Starting prompts
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Reusable openings for a conversation. Nothing here runs on its own.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {TEMPLATES.map((template) => {
          const Icon = template.icon;
          const isCopied = copied === template.title;
          return (
            <article
              key={template.title}
              className="rounded-xl border border-border/60 bg-card/30 p-4"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                <h3 className="text-sm font-medium text-foreground">{template.title}</h3>
                <button
                  onClick={() => void copy(template.title, template.prompt)}
                  className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border/60 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {isCopied ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {isCopied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {template.prompt}
              </p>
            </article>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Paste one into{" "}
        <Link to="/ocade" className="text-foreground underline underline-offset-4">
          Chat
        </Link>
        , and move durable multi-step work into{" "}
        <Link to="/ocade/tasks" className="text-foreground underline underline-offset-4">
          Tasks
        </Link>{" "}
        when it needs a schedule.
      </p>
    </section>
  );
}
