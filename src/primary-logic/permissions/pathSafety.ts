/**
 * Which paths are too important to touch on a model's say-so.
 *
 * Ported from the archive's `src/utils/permissions/pathValidation.ts` --
 * specifically `isDangerousRemovalPath`, `expandTilde` and
 * `getGlobBaseDirectory`, which are the parts of that file that are rules
 * rather than filesystem access.
 *
 * WHY THIS MATTERS IN A BROWSER
 * -----------------------------
 * OCADE's file tools take a path from the model and hand it to the companion.
 * The companion checks its own approved folders, which is the right last line
 * -- but it is the ONLY line, and it is on the other side of a network hop. A
 * request to empty the home directory should not have to travel to another
 * process before anything notices. The decision belongs where every other
 * permission decision is made, which is in the browser, before the call leaves.
 *
 * ADAPTED, AND WHY
 * ----------------
 * - `homedir()` and `dirname()` from Node are gone. Home is passed in (the
 *   companion reports it; when it has not, the tilde rules simply do not fire)
 *   and the parent directory is computed on the normalised string, which is all
 *   the donor's checks ever needed it for.
 * - `process.platform` is gone. Both separator conventions are handled on every
 *   platform, because the browser deciding this does not know -- and must not
 *   guess -- what the machine at the other end is running.
 * - The donor returned a boolean used to force a confirmation prompt. Here the
 *   same boolean carries a reason, because OCADE has to SAY what it objected to
 *   rather than silently asking again.
 */

const WINDOWS_DRIVE_ROOT_REGEX = /^[A-Za-z]:\/?$/
const WINDOWS_DRIVE_CHILD_REGEX = /^[A-Za-z]:\/[^/]+$/
const GLOB_PATTERN_REGEX = /[*?[\]{}]/

/**
 * Collapse separators so `C:\\Windows` -- valid in PowerShell -- cannot slip
 * past a check written against single slashes. The donor's note, and its bug.
 */
export function normalizePath(path: string): string {
  const forwardSlashed = path.replace(/[\\/]+/g, '/')
  return forwardSlashed === '/' ? forwardSlashed : forwardSlashed.replace(/\/$/, '')
}

/**
 * Expand a leading `~`. `~username` is deliberately NOT supported: resolving
 * another account's home from a model-supplied string is a way to reach a
 * directory nobody approved.
 */
export function expandTilde(path: string, home: string | null): string {
  if (!home) return path
  if (path === '~' || path.startsWith('~/') || path.startsWith('~\\')) {
    return home + path.slice(1)
  }
  return path
}

/** The directory a glob is rooted at, so a pattern is judged by where it looks. */
export function globBaseDirectory(path: string): string {
  const match = path.match(GLOB_PATTERN_REGEX)
  if (!match || match.index === undefined) return path
  const beforeGlob = path.slice(0, match.index)
  const lastSeparator = Math.max(beforeGlob.lastIndexOf('/'), beforeGlob.lastIndexOf('\\'))
  if (lastSeparator === -1) return '.'
  return beforeGlob.slice(0, lastSeparator) || '/'
}

/** Whether a path names a location whose loss would not be recoverable. */
export type PathRisk = {
  dangerous: boolean
  /** A sentence naming what was objected to. Null when nothing was. */
  reason: string | null
}

const SAFE: PathRisk = { dangerous: false, reason: null }

/**
 * Is this a place that must never be emptied, moved or deleted on a model's
 * say-so?
 *
 * The donor's list, unchanged: everything, a filesystem root, a Windows drive
 * root, the user's home directory, and any direct child of a root -- `/usr`,
 * `/etc`, `C:/Program Files`. A direct child of root is included because those
 * are system directories by convention on every platform, and losing one is
 * indistinguishable from losing the machine.
 *
 * Deeper paths are NOT dangerous by this rule. `/usr/local/share/something` is
 * ordinary work, and a rule that objected to it would be ignored within a day.
 */
export function dangerousPath(path: string, home: string | null = null): PathRisk {
  const raw = path.trim()
  if (!raw) return SAFE

  /*
   * `~` IS the home folder, whatever it resolves to.
   *
   * The donor expanded the tilde first and compared the result against
   * `homedir()`, which meant the rule could only fire on a machine whose home
   * the checker knew. In a browser deciding about someone else's computer that
   * is never true — so the literal form is recognised as itself. No expansion,
   * no lookup, and nothing to be wrong about.
   */
  const bareTilde = normalizePath(globBaseDirectory(raw))
  if (bareTilde === '~') {
    return { dangerous: true, reason: 'that is the whole home folder' }
  }

  const expanded = expandTilde(raw, home)
  const normalized = normalizePath(globBaseDirectory(expanded))

  if (normalized === '*' || normalized === '' || raw === '*' || raw.endsWith('/*')) {
    return { dangerous: true, reason: 'that would match everything' }
  }

  if (normalized === '/') {
    return { dangerous: true, reason: 'that is the root of the filesystem' }
  }

  if (WINDOWS_DRIVE_ROOT_REGEX.test(normalized)) {
    return { dangerous: true, reason: 'that is a whole drive' }
  }

  if (home && normalized === normalizePath(home)) {
    return { dangerous: true, reason: 'that is the whole home folder' }
  }

  // A direct child of a root: the parent is the root itself.
  const lastSeparator = normalized.lastIndexOf('/')
  if (lastSeparator === 0 && normalized.length > 1) {
    return { dangerous: true, reason: 'that is a system folder at the top of the disk' }
  }

  if (WINDOWS_DRIVE_CHILD_REGEX.test(normalized)) {
    return { dangerous: true, reason: 'that is a system folder at the top of the drive' }
  }

  return SAFE
}

/**
 * Does this path try to climb out of wherever it was rooted?
 *
 * The donor's `containsPathTraversal`, kept because the rule above is only
 * meaningful if `approved/../..` cannot be used to reach past it.
 */
export function containsPathTraversal(path: string): boolean {
  return /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(path)
}
