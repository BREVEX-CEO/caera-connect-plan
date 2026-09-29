/**
 * Talking to JARVIS while it works.
 *
 * A turn that drives a computer can run for minutes. The person keeps talking
 * during it: "what are you doing?", "wait", "use the other file", "stop". Each
 * is answered at once and changes the work at the next safe point (before the
 * next model step or device action), never by racing the action in flight.
 */
import type { JarvisTaskRow } from "./jarvis.functions";

export type WorkIntent = "stop" | "pause" | "continue" | "status" | "redirect";

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(ocade|jarvis|hey ocade|hey jarvis|ok|okay|please)\s+/, "")
    .replace(/\s+(please|now|jarvis|ocade)$/, "");

/** What a message typed or spoken during work asks for. */
export function workIntent(text: string): WorkIntent {
  const said = words(text);
  if (
    /^(stop|stop it|stop that|stop jarvis|stop the task|cancel( it| that| the task)?|abort)$/.test(
      said,
    )
  ) {
    return "stop";
  }
  if (
    /^(wait|wait a (second|sec|moment|minute)|pause|pause (it|that|the task|jarvis)|hold on|hang on|one (second|sec|moment))$/.test(
      said,
    )
  ) {
    return "pause";
  }
  if (
    /^(continue|carry on|resume|go on|go ahead|keep going|you can continue|ok continue)$/.test(said)
  ) {
    return "continue";
  }
  if (
    /^(what are you (doing|working on)|what('s| is) (happening|going on)|status|how('s| is) it going|where are you( up to)?|what step are you on|are you (done|finished)( yet)?|what are you up to)$/.test(
      said,
    )
  ) {
    return "status";
  }
  return "redirect";
}

/** A truthful one-line answer to "what are you doing?", from the task's real state. */
export function statusReply(
  task: Pick<JarvisTaskRow, "title" | "plan" | "current_step" | "status" | "checkpoint"> | null,
  paused: boolean,
  lastActivity?: string | null,
): string {
  if (!task) return "I'm thinking about your request. Nothing is running on a computer yet.";
  const steps = task.plan.length;
  const step = Math.min(task.current_step, Math.max(0, steps - 1));
  const where = steps ? ` I'm on step ${step + 1} of ${steps}: ${task.plan[step]}.` : "";
  const last = lastActivity ?? task.checkpoint?.lastAction ?? null;
  const done = last ? ` Last: ${last.replace(/\.$/, "")}.` : "";
  if (paused) return `I've paused “${task.title}”.${where}${done} Say continue when you're ready.`;
  if (task.status === "taken_over")
    return `You have control of “${task.title}”. Say continue to hand it back.`;
  if (task.status === "waiting") return `“${task.title}” is waiting for you.${where}`;
  return `I'm working on “${task.title}”.${where}${done} You can keep talking — I'll carry on.`;
}

/** The mailbox and pause switch shared by the composer and one planning loop. */
export class LiveControl {
  private said: string[] = [];
  private gate: { promise: Promise<void>; open: () => void } | null = null;

  get paused(): boolean {
    return this.gate !== null;
  }

  /** Something the person said that the plan should take into account. */
  tell(text: string): void {
    this.said.push(text.slice(0, 2000));
  }

  /** What the person said since the last step, oldest first. */
  drain(): string[] {
    const out = this.said;
    this.said = [];
    return out;
  }

  pause(): void {
    if (this.gate) return;
    let open = () => undefined as void;
    const promise = new Promise<void>((resolve) => {
      open = resolve;
    });
    this.gate = { promise, open };
  }

  resume(): void {
    const gate = this.gate;
    this.gate = null;
    gate?.open();
  }

  /** Waits while paused; a Stop (abort) ends the wait at once. */
  async waitIfPaused(signal: AbortSignal): Promise<void> {
    while (this.gate && !signal.aborted) {
      const gate = this.gate;
      await new Promise<void>((resolve) => {
        const done = () => {
          signal.removeEventListener("abort", done);
          resolve();
        };
        signal.addEventListener("abort", done);
        void gate.promise.then(done);
      });
    }
  }
}

/** How a mid-work message reaches the planner: data about the person's wish, never page text. */
export function interjectionMessage(said: string[]): string {
  return `While you were working, the person said: ${JSON.stringify(said)}. Take it into account now: reply to them briefly in your text, change course if they asked for something different, and keep working unless they asked you to stop.`;
}
