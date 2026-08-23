import { createFileRoute } from "@tanstack/react-router";
import { TasksWorkspace } from "@/components/ocade/TasksWorkspace";

/**
 * Kept as a route so existing links and bookmarks still resolve. The screen
 * itself lives in `TasksWorkspace` and is shared with `/ocade/tasks`.
 */
export const Route = createFileRoute("/_authenticated/settings/tasks")({
  head: () => ({
    meta: [{ title: "Tasks — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <TasksWorkspace backTo="/settings" backLabel="Back to Settings" />,
});
