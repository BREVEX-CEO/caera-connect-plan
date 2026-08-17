import { createFileRoute } from "@tanstack/react-router";
import { TasksWorkspace } from "@/components/ocade/TasksWorkspace";

/**
 * Tasks, inside OCADE where the work is.
 *
 * The same screen as `/settings/tasks` — shared component, one source of data
 * (`ocade_automations` and `ocade_automation_runs`) — because two task lists
 * that could disagree about whether a run is live would make every Stop button
 * on both of them a guess.
 */
export const Route = createFileRoute("/_authenticated/ocade/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — OCADE" },
      {
        name: "description",
        content: "Scheduled automations and their runs, with pause, resume and stop controls.",
      },
      { property: "og:title", content: "Tasks — OCADE" },
      {
        property: "og:description",
        content: "Scheduled automations and their runs on this OCADE account.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <TasksWorkspace backTo="/ocade" backLabel="Back to OCADE" />,
});
