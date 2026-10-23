import { useEffect, useRef, type RefObject, type UIEvent } from "react";

/** How near the end still counts as reading the newest line, in pixels. */
const NEAR_END_PX = 96;

/**
 * A transcript follows a streaming answer only while the person is at its end. Scrolled up
 * to read something earlier, they stay where they are; scrolling back down follows again
 * (plan.md §16; follow intent as in DeepSeek Harness `use-scroll-follow.ts`, MIT).
 * `changed` is anything that grows the transcript; `reset` (a conversation opening) jumps
 * to the end and follows again.
 */
export function useFollowBottom(
  end: RefObject<HTMLElement | null>,
  changed: unknown,
  reset?: unknown,
): (event: UIEvent<HTMLElement>) => void {
  const following = useRef(true);
  useEffect(() => {
    following.current = true;
  }, [reset]);
  useEffect(() => {
    if (following.current) end.current?.scrollIntoView({ block: "end" });
  }, [changed, reset, end]);
  return (event) => {
    const box = event.currentTarget;
    following.current = box.scrollHeight - box.scrollTop - box.clientHeight <= NEAR_END_PX;
  };
}
