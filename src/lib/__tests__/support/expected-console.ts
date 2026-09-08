/**
 * CONSOLE OUTPUT AN AUDIT LEGITIMATELY CAUSES, CLASSIFIED RATHER THAN MUTED.
 *
 * The audits in this directory mount real product components with no session,
 * no credentials and — in the markup-only ones — no router. Each of those is a
 * deliberate choice: standing up a fake session to walk past a security gate is
 * not something a test should teach anyone to do, and OCADE responds by failing
 * closed, loudly. That is the correct behaviour, and it fills the run with
 * output.
 *
 * A RUN FULL OF EXPECTED NOISE IS A RUN IN WHICH A NEW ERROR GOES UNREAD, so
 * the answer is not to print it all and not to silence the channel. Every
 * message is matched against a named list with a reason attached; anything that
 * does not match still reaches the console AND is collected, so a test can
 * assert there was nothing unaccounted for.
 *
 * ONE LIST, SHARED. Three audit files hit the same messages, and three private
 * filters would drift — one of them would quietly grow a pattern broad enough
 * to swallow a real defect.
 */

export interface ExpectedMessage {
  pattern: RegExp;
  /** Why this message is correct behaviour, not a defect. */
  why: string;
}

export const EXPECTED_CONSOLE: ExpectedMessage[] = [
  {
    pattern: /Missing Supabase environment variable/i,
    why: "OCADE failing closed with no project configured — the behaviour that keeps a deployment off somebody else's database",
  },
  {
    pattern: /wasn't caught by any route|error boundary you provided/i,
    why: "React and the router reporting a render error to a boundary the harness itself supplies",
  },
  {
    pattern: /useRouter must be used inside a <RouterProvider>/i,
    why: "a markup-only audit rendering a panel without router context; the panel is inside the router in the product",
  },
  {
    pattern: /Not implemented: navigation to another Document/i,
    why: "jsdom refusing a real navigation the product legitimately performs",
  },
  {
    pattern: /Please use the `legacy` build in Node\.js environments/i,
    why: "pdfjs noticing its browser build running under Node; in the product it runs in a browser, which is the build it wants",
  },
];

export interface ConsoleWatch {
  /** Messages matched by the list above. */
  expected: string[];
  /** Everything else. A test should assert this is empty. */
  unexpected: string[];
  /** Put the real console back. */
  restore(): void;
}

/**
 * Intercept `console.error` AND `console.warn` for the duration of an audit.
 *
 * Both channels, because these messages arrive on either: the router's
 * uncaught-error notice is a warning, and the Supabase refusal reaches
 * whichever the caller used. Watching one leaves half the noise in the output
 * and half the property unasserted.
 */
export function watchConsole(): ConsoleWatch {
  const expected: string[] = [];
  const unexpected: string[] = [];
  const realError = console.error;
  const realWarn = console.warn;

  const classify =
    (fall: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      const line = args.map((arg) => String(arg)).join(" ");
      if (EXPECTED_CONSOLE.some((entry) => entry.pattern.test(line))) {
        expected.push(line);
        return;
      }
      unexpected.push(line);
      fall(...args);
    };

  console.error = classify(realError);
  console.warn = classify(realWarn);

  return {
    expected,
    unexpected,
    restore() {
      console.error = realError;
      console.warn = realWarn;
    },
  };
}
