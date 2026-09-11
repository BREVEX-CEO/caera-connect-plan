import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listProjects } from "@/lib/ocade-projects.functions";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskComments } from "@/components/ocade/TaskComments";
import { TaskAnalytics } from "@/components/ocade/TaskAnalytics";
import { TaskTimeline } from "@/components/ocade/TaskTimeline";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createUnifiedTask,
  listTasks,
  persistTask,
  removeTask,
  type UnifiedTask,
  type UnifiedTaskSource,
} from "@/lib/tasks/unified-task";
import {
  filterAndSortTasks,
  moveTaskToColumn,
  paginateTaskFeed,
  taskBoardColumn,
  taskFeedAuthor,
  taskSourceGroups,
  TASK_BOARD_COLUMNS,
  type TaskBoardColumn,
  type TaskBoardGroup,
  type TaskBoardSort,
} from "@/lib/tasks/task-board";
import { reconcileInterruptedRuns, subscribeToRuns } from "@/lib/tasks/runs";
import { useFormatters } from "@/lib/locale/use-formatters";

const SOURCES: Array<UnifiedTaskSource | "all"> = [
  "all",
  "work",
  "automation",
  "code",
  "research",
  "monitor",
  "system",
];

export function TaskBoard() {
  const formatters = useFormatters();
  const [tasks, setTasks] = useState<UnifiedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  /*
   * WHAT KIND OF TASK THIS IS, ASKED ONCE AND ONLY WHEN IT MATTERS.
   *
   * `docs/APP_FLOW.md`: "A task can be immediate, scheduled, recurring,
   * monitoring-style, action-required or remote Dispatch work. The creation
   * flow captures only the information required for the chosen task type."
   * Quick add wrote every one of them down as immediate work, so a task a
   * person meant for Friday sat in Queued looking overdue from the moment it
   * was created, and one that needed somebody's answer looked like something
   * OCADE was about to start.
   *
   * Three kinds are answered here because three are all this list owns:
   * recurring and monitoring work is an automation with a schedule, and it is
   * created below, on the same screen, by the form that owns it.
   */
  const [kind, setKind] = useState<"now" | "scheduled" | "action">("now");
  /*
   * The projects a task can be filed under, read from the account rather than
   * typed. Cached, because opening a task twice is the normal case and the list
   * changes about as often as somebody starts a project.
   */
  const projectQuery = useQuery({
    queryKey: ["task-board", "projects"],
    queryFn: () => listProjects(),
    staleTime: 60_000,
  });
  const projects = projectQuery.data ?? [];
  const [when, setWhen] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<UnifiedTaskSource | "all">("all");
  const [sort, setSort] = useState<TaskBoardSort>("updated");
  const [group, setGroup] = useState<TaskBoardGroup>("status");
  const [selected, setSelected] = useState<UnifiedTask | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "feed" | "analytics" | "timeline">("board");
  const [feedPage, setFeedPage] = useState(1);
  const [lastSeen, setLastSeen] = useState("");
  const [unreachable, setUnreachable] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const refresh = () =>
      listTasks().then(
        (items) => {
          if (!live) return;
          setTasks(items);
          setUnreachable(null);
          setLoading(false);
        },
        (error: unknown) => {
          if (!live) return;
          /*
           * NOT EMPTIED. A board that renders "no tasks" for an unreachable
           * account tells somebody their work is gone, which is the one thing
           * it must never say by accident.
           */
          setUnreachable(
            error instanceof Error ? error.message : "Your account could not be reached.",
          );
          setLoading(false);
        },
      );

    /*
     * RECONCILE BEFORE SHOWING ANYTHING.
     *
     * A run left mid-flight by a closed tab or a crash is still recorded as
     * executing, and this registry only holds runs THIS session started — so
     * nothing is going to finish it. Saying so first is what makes the board
     * true on the second visit, and it is what turns a stranded row into one
     * the user can pick back up.
     */
    void reconcileInterruptedRuns()
      .catch(() => undefined)
      .then(refresh);

    // Live runs write through to the same store, so a mission starting in
    // Cowork appears here without the user reloading.
    const unsubscribe = subscribeToRuns(() => {
      void refresh();
    });

    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    /*
     * WHAT THIS TAB HAS ALREADY LOOKED AT — not content, and deliberately per
     * tab. "New since I last looked" is a question about this session, so it is
     * `sessionStorage`: carrying it across devices would mark a feed as read on
     * a phone because a laptop had it open.
     */
    if (typeof sessionStorage !== "undefined") {
      setLastSeen(sessionStorage.getItem("ocade:task-feed:last-seen") ?? "");
      sessionStorage.setItem("ocade:task-feed:last-seen", new Date().toISOString());
    }
  }, []);

  const visible = useMemo(
    () => filterAndSortTasks(tasks, query, source, sort),
    [tasks, query, source, sort],
  );
  const feed = useMemo(() => paginateTaskFeed(visible, feedPage), [visible, feedPage]);
  const newCount = visible.filter((task) => !lastSeen || task.updatedAt > lastSeen).length;

  async function addTask() {
    if (!draft.trim()) return;
    if (kind === "scheduled" && !when) {
      toast.error("A scheduled task needs a date and time.");
      return;
    }
    const task = createUnifiedTask({
      source: "work",
      title: draft.trim(),
      /*
       * Stored as an instant, converted from the local time the person typed.
       * The column is a timestamptz and the board is read on other devices in
       * other zones; keeping the wall-clock string would make "Friday 9am"
       * mean a different moment on each of them.
       */
      ...(kind === "scheduled" ? { scheduledFor: new Date(when).toISOString() } : {}),
    });
    /*
     * A task that is waiting for a person is WAITING_USER from the start.
     * Leaving it CREATED would put it in Queued, where the board means "ready
     * to start" — and nothing here is ready until somebody answers.
     */
    const created =
      kind === "action"
        ? { ...task, status: "WAITING_USER" as const, currentStep: "Waiting for you" }
        : task;
    try {
      await persistTask(created);
    } catch (error) {
      // The task is NOT added to the list. Showing it would be the board saying
      // the work is recorded when nothing recorded it.
      toast.error(error instanceof Error ? error.message : "That task could not be saved.");
      return;
    }
    setTasks((current) => [created, ...current]);
    setDraft("");
    setWhen("");
    toast.success(
      kind === "scheduled"
        ? `Scheduled for ${formatters.dateTime(when)}.`
        : kind === "action"
          ? "Added, waiting for you."
          : "Task added to Queued.",
    );
  }

  async function move(task: UnifiedTask, destination: TaskBoardColumn) {
    try {
      const moved = moveTaskToColumn(task, destination);
      await persistTask(moved);
      setTasks((current) => current.map((item) => (item.id === moved.id ? moved : item)));
      setSelected((current) => (current?.id === moved.id ? moved : current));
      toast.success(`Moved “${task.title}” to ${destination}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This task cannot move there.");
    }
  }

  async function saveTask(task: UnifiedTask) {
    // Throws on failure, and every caller lets it: the screen must not show a
    // change the account refused.
    await persistTask(task);
    setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
    setSelected((current) => (current?.id === task.id ? task : current));
  }

  /**
   * File a task under a project, or unfile it.
   *
   * Persisted before the screen changes, like every other edit here: a board
   * that shows the new filing and then fails to save it has told the person
   * their work is somewhere it is not.
   */
  async function fileUnder(task: UnifiedTask, projectId: string | null) {
    try {
      await saveTask({
        ...task,
        projectId: projectId ?? undefined,
        updatedAt: new Date().toISOString(),
      });
      toast.success(
        projectId
          ? `Filed under ${projects.find((project) => project.id === projectId)?.name ?? "the project"}.`
          : "Unfiled.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That task could not be filed.");
    }
  }

  async function editSelectedTitle() {
    if (!selected) return;
    const title = window.prompt("Task title", selected.title)?.trim();
    if (!title || title === selected.title) return;
    try {
      await saveTask({ ...selected, title, updatedAt: new Date().toISOString() });
      toast.success("Task title updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That title could not be saved.");
    }
  }

  async function deleteSelected() {
    if (!selected || !window.confirm(`Delete “${selected.title}”? Its comments go with it.`)) {
      return;
    }
    try {
      await removeTask(selected.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That task could not be deleted.");
      return;
    }
    setTasks((current) => current.filter((task) => task.id !== selected.id));
    setSelected(null);
    toast.success("Task deleted.");
  }

  function card(task: UnifiedTask) {
    return (
      <article
        key={task.id}
        draggable
        onDragStart={() => setDraggedId(task.id)}
        onDragEnd={() => setDraggedId(null)}
        className="rounded-xl border border-border/60 bg-background/55 p-3 shadow-sm"
      >
        <button type="button" onClick={() => setSelected(task)} className="w-full text-left">
          <span className="block text-sm font-medium text-foreground">{task.title}</span>
          <span className="mt-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
            {task.source} · {task.status.replaceAll("_", " ").toLowerCase()}
          </span>
          {/*
            WHEN IT IS FOR, WHERE THE PERSON IS LOOKING. A scheduled task that
            reads exactly like an immediate one is a scheduled task nobody can
            plan around — and it sits in the same column, so the card is the
            only place the difference can appear. Rendered in the reader's own
            zone, from the instant the account holds.
          */}
          {task.scheduledFor ? (
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Scheduled for {formatters.dateTime(task.scheduledFor)}
            </span>
          ) : null}
          {task.currentStep ? (
            <span className="mt-2 block line-clamp-2 text-xs text-muted-foreground">
              {task.currentStep}
            </span>
          ) : null}
        </button>
      </article>
    );
  }

  return (
    <section
      aria-labelledby="task-board-title"
      className="mt-6 rounded-2xl border border-border/60 bg-card/35 p-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="task-board-title" className="text-sm font-semibold text-foreground">
            Task board
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            On-device tasks only. Closing an unfinished card cancels it; it never fabricates
            completion.
          </p>
        </div>
        <form
          className="flex w-full max-w-md flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void addTask();
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Quick add a task"
            aria-label="Quick add a task"
            className="min-w-[12rem] flex-1"
          />
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
            aria-label="Task type"
            className="min-h-10 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground"
          >
            <option value="now">Now</option>
            <option value="scheduled">Scheduled</option>
            <option value="action">Waiting for me</option>
          </select>
          {/* Only the field the chosen type needs, and only then. */}
          {kind === "scheduled" ? (
            <Input
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
              aria-label="Scheduled for"
              className="min-w-[13rem]"
            />
          ) : null}
          <Button type="submit" disabled={!draft.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </form>
      </div>

      <div className="mt-4 flex items-center gap-2" role="group" aria-label="Task view">
        <button
          type="button"
          aria-pressed={view === "board"}
          onClick={() => setView("board")}
          className="min-h-9 rounded-md border border-border/60 px-3 text-xs"
        >
          Board
        </button>
        <button
          type="button"
          aria-pressed={view === "feed"}
          onClick={() => setView("feed")}
          className="min-h-9 rounded-md border border-border/60 px-3 text-xs"
        >
          Activity feed{newCount ? ` · ${newCount} new` : ""}
        </button>
        <button
          type="button"
          aria-pressed={view === "analytics"}
          onClick={() => setView("analytics")}
          className="min-h-9 rounded-md border border-border/60 px-3 text-xs"
        >
          Analytics
        </button>
        <button
          type="button"
          aria-pressed={view === "timeline"}
          onClick={() => setView("timeline")}
          className="min-h-9 rounded-md border border-border/60 px-3 text-xs"
        >
          Timeline
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-muted-foreground">
          Filter tasks
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-1"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Source
          <select
            value={source}
            onChange={(event) => setSource(event.target.value as UnifiedTaskSource | "all")}
            className="mt-1 block min-h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm text-foreground"
          >
            {SOURCES.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All sources" : value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as TaskBoardSort)}
            className="mt-1 block min-h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm text-foreground"
          >
            <option value="updated">Recently updated</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Group tasks by
          <select
            value={group}
            onChange={(event) => setGroup(event.target.value as TaskBoardGroup)}
            className="mt-1 block min-h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm text-foreground"
          >
            <option value="status">Status</option>
            <option value="source">Source</option>
          </select>
        </label>
      </div>

      {unreachable ? (
        <p role="status" className="mt-4 text-sm text-destructive">
          Your tasks could not be read: {unreachable} This is not an empty board — nothing was lost,
          and it will fill in when your account is reachable again.
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Reading your tasks…</p>
      ) : view === "analytics" ? (
        <TaskAnalytics tasks={visible} />
      ) : view === "timeline" ? (
        <TaskTimeline tasks={visible} onChange={(task) => void saveTask(task)} />
      ) : view === "feed" ? (
        <section aria-labelledby="task-feed-title" className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 id="task-feed-title" className="text-sm font-medium">
                Device activity
              </h3>
              <p aria-live="polite" className="text-xs text-muted-foreground">
                {newCount
                  ? `${newCount} task updates since this feed was last opened.`
                  : "No new task updates."}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              Page {feed.page} of {feed.pages}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {feed.items.map((task) => (
              <article
                key={task.id}
                className="rounded-xl border border-border/60 bg-background/35 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{taskFeedAuthor(task)}</p>
                    <h4 className="mt-1 text-sm font-medium">{task.title}</h4>
                  </div>
                  <time dateTime={task.updatedAt} className="text-xs text-muted-foreground">
                    {formatters.dateTime(task.updatedAt)}
                  </time>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {task.currentStep ||
                    task.request ||
                    `Status changed to ${task.status.replaceAll("_", " ").toLowerCase()}.`}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(task)}
                    className="min-h-8 rounded-md border border-border/60 px-3 text-xs"
                  >
                    Open details
                  </button>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(task.id)}
                    className="min-h-8 rounded-md border border-border/60 px-3 text-xs"
                  >
                    Copy task reference
                  </button>
                </div>
              </article>
            ))}
            {!feed.items.length ? (
              <p className="rounded-xl border border-dashed border-border/50 p-4 text-sm text-muted-foreground">
                No task activity matches these filters. Add a task or clear a filter.
              </p>
            ) : null}
          </div>
          <nav aria-label="Task activity pages" className="mt-4 flex justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={feed.page <= 1}
              onClick={() => setFeedPage((page) => Math.max(1, page - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={feed.page >= feed.pages}
              onClick={() => setFeedPage((page) => Math.min(feed.pages, page + 1))}
            >
              Next
            </Button>
          </nav>
        </section>
      ) : group === "status" ? (
        <div className="mt-4 grid gap-3 xl:grid-cols-4">
          {TASK_BOARD_COLUMNS.map((column) => {
            const columnTasks = visible.filter((task) => taskBoardColumn(task) === column.id);
            return (
              <section
                key={column.id}
                aria-label={`${column.label}, ${columnTasks.length} tasks`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  const task = tasks.find((item) => item.id === draggedId);
                  setDraggedId(null);
                  if (task) void move(task, column.id);
                }}
                className="min-h-44 rounded-xl border border-border/50 bg-background/25 p-3"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium">{column.label}</h3>
                    <p className="text-[11px] text-muted-foreground">{column.description}</p>
                  </div>
                  <span
                    aria-label={`${columnTasks.length} tasks`}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs"
                  >
                    {columnTasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {columnTasks.map(card)}
                  {!columnTasks.length ? (
                    <p className="rounded-lg border border-dashed border-border/50 p-3 text-xs text-muted-foreground">
                      No tasks in this column.
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          {taskSourceGroups(visible).map(([name, items]) => (
            <section
              key={name}
              aria-label={`${name}, ${items.length} tasks`}
              className="rounded-xl border border-border/50 bg-background/25 p-3"
            >
              <div className="mb-3 flex justify-between">
                <h3 className="text-sm font-medium capitalize">{name}</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{items.length}</span>
              </div>
              <div className="space-y-2">{items.map(card)}</div>
            </section>
          ))}
          {!visible.length ? (
            <p className="rounded-xl border border-dashed border-border/50 p-4 text-sm text-muted-foreground">
              No task matches these filters.
            </p>
          ) : null}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3 text-sm">
              <nav aria-label="Task location" className="text-xs text-muted-foreground">
                Task board / <span className="text-foreground">{selected.title}</span>
              </nav>
              <dl className="grid grid-cols-[7rem_1fr] gap-2">
                <dt className="text-muted-foreground">Source</dt>
                <dd>{selected.source}</dd>
                {selected.scheduledFor ? (
                  <>
                    <dt className="text-muted-foreground">Scheduled for</dt>
                    <dd>{formatters.dateTime(selected.scheduledFor)}</dd>
                  </>
                ) : null}
                {/*
                  WHICH PROJECT THIS BELONGS TO, AND A WAY TO CHANGE IT.
                  A project is the shared context graph, and a task was the one
                  record that could not join it: the workspace could show the
                  conversation where work was agreed and the artifact it
                  eventually produced, and nothing about the task in between.
                */}
                <dt className="text-muted-foreground">Project</dt>
                <dd>
                  <select
                    aria-label="Project"
                    value={selected.projectId ?? ""}
                    onChange={(event) => void fileUnder(selected, event.target.value || null)}
                    className="min-h-9 w-full rounded-md border border-border/60 bg-background px-2 text-sm"
                  >
                    <option value="">Unfiled</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>{selected.status.replaceAll("_", " ")}</dd>
                <dt className="text-muted-foreground">Updated</dt>
                <dd>{formatters.dateTime(selected.updatedAt)}</dd>
                <dt className="text-muted-foreground">Request</dt>
                <dd>{selected.request || "No task description."}</dd>
                <dt className="text-muted-foreground">Receipts</dt>
                <dd>
                  {selected.receipts?.length
                    ? selected.receipts.join("; ")
                    : "No receipts recorded."}
                </dd>
              </dl>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void editSelectedTitle()}
                  className="min-h-9 rounded-md border border-border/60 px-3 text-xs"
                >
                  Edit title
                </button>
                <button
                  type="button"
                  onClick={() => void deleteSelected()}
                  className="min-h-9 rounded-md border border-destructive/40 px-3 text-xs text-destructive"
                >
                  Delete task
                </button>
              </div>
              <label className="block text-xs text-muted-foreground">
                Move task
                <select
                  aria-label="Move task"
                  value={taskBoardColumn(selected)}
                  onChange={(event) => void move(selected, event.target.value as TaskBoardColumn)}
                  className="mt-1 block min-h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm text-foreground"
                >
                  {TASK_BOARD_COLUMNS.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.label}
                    </option>
                  ))}
                </select>
              </label>
              <TaskComments key={selected.id} taskId={selected.id} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
