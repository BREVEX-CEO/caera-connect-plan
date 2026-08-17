import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, MessageSquareText, Search, Wrench } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";

export const Route = createFileRoute("/_authenticated/ocade/templates")({
  head: () => ({ meta: [{ title: "Templates — OCADE" }, { name: "robots", content: "noindex" }] }),
  component: TemplatesPage,
});

const TEMPLATES = [
  {
    title: "Research brief",
    icon: Search,
    prompt: "Research this topic, separate verified facts from inference, cite the strongest evidence, and end with the open questions that still matter.",
  },
  {
    title: "Work plan",
    icon: ClipboardList,
    prompt: "Turn this goal into an execution plan with milestones, dependencies, risks, owners or decision points, and a clear definition of done.",
  },
  {
    title: "Build / debug",
    icon: Wrench,
    prompt: "Inspect the evidence first, identify the smallest root-cause fix, implement it without weakening safety checks, and verify the result before calling it complete.",
  },
  {
    title: "Decision memo",
    icon: MessageSquareText,
    prompt: "Compare the realistic options, state the tradeoffs and unknowns, recommend one choice, and explain what evidence would change the recommendation.",
  },
] as const;

function TemplatesPage() {
  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Templates"
        description="Small reusable starting prompts. These are plain local product templates—no template is presented as an autonomous workflow until a real task runtime is attached to it."
      />
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {TEMPLATES.map((template) => {
          const Icon = template.icon;
          return (
            <article key={template.title} className="rounded-xl border border-border/60 bg-card/30 p-4">
              <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" aria-hidden /><h2 className="text-sm font-medium">{template.title}</h2></div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{template.prompt}</p>
            </article>
          );
        })}
      </div>
      <p className="mt-5 text-xs text-muted-foreground">
        Use a template in <Link to="/ocade" className="text-foreground underline underline-offset-4">Chat</Link>, then move durable multi-step execution into <Link to="/ocade/tasks" className="text-foreground underline underline-offset-4">Tasks</Link> when needed.
      </p>
    </>
  );
}
