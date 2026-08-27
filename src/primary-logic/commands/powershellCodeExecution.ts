/**
 * PowerShell commands that run something OCADE cannot read.
 *
 * Ported from the archive's `utils/powershell/dangerousCmdlets.ts`.
 *
 * WHY THIS IS A SEPARATE CONCERN FROM "DESTRUCTIVE"
 * ------------------------------------------------
 * `powershellDestructiveWarning` already recognises commands that delete or
 * overwrite things. These are different: they do not destroy anything by
 * themselves, they EXECUTE SOMETHING ELSE. `Invoke-Expression (Invoke-RestMethod
 * https://…)` is a download-and-run in eleven characters, and nothing about the
 * text says what will actually happen.
 *
 * That is exactly the case the permission layer already handles for bash, where
 * `$(...)` and backticks make a command unreadable and unreadable beats any
 * allow rule. Without this table the same reasoning stopped at the shell
 * boundary: a rule saying `Bash(powershell:*)` covered every one of these,
 * because the bash parser sees one command called `powershell` and cannot look
 * inside its argument.
 *
 * ADAPTED, AND WHY
 * ----------------
 * The donor split these across validator lists used by a permission dialog and
 * a suggestion gate. OCADE needs one question answered -- does this run code
 * nobody can see? -- so the lists are merged into one set and one predicate.
 * The `ARG_GATED_CMDLETS` list is deliberately NOT included: those are safe
 * cmdlets whose ARGUMENTS can be dangerous, which is a judgement the donor's
 * full PowerShell parser made and this does not have.
 */

/** Cmdlets that execute a script file or a script block. */
const SCRIPT_EXECUTION = [
  'invoke-command',
  'invoke-expression',
  'iex',
  'icm',
  'start-job',
  'start-threadjob',
  'register-scheduledjob',
  'register-engineevent',
  'register-objectevent',
  'register-wmievent',
  'new-pssession',
  'enter-pssession',
]

/** Loading a module runs its code. Installing one downloads it first. */
const MODULE_LOADING = [
  'import-module',
  'ipmo',
  'install-module',
  'save-module',
  'update-module',
  'install-script',
  'save-script',
]

/** Fetches. Paired with an execution cmdlet this is download-and-run. */
const NETWORK = ['invoke-webrequest', 'invoke-restmethod', 'iwr', 'irm', 'curl', 'wget']

/** Rebinding a name changes what every later command in the script means. */
const ALIAS_HIJACK = [
  'set-alias',
  'sal',
  'new-alias',
  'nal',
  'set-variable',
  'sv',
  'new-variable',
  'nv',
]

/** Process creation through WMI/CIM, which looks nothing like a spawn. */
const WMI_SPAWN = ['invoke-wmimethod', 'iwmi', 'invoke-cimmethod']

/** Spawning a process, compiling a type, instantiating a COM object. */
const SPAWNERS = ['start-process', 'saps', 'add-type', 'new-object']

/**
 * The shells themselves, which are NOT in the set above -- and the distinction
 * cost a test to find.
 *
 * Putting `powershell` in the opacity table made `powershell Get-Date` ask for
 * permission, which is a rule nobody would leave switched on for a day. Naming
 * the shell says nothing about whether what follows is readable; the cmdlets
 * above are what say that.
 *
 * The donor kept this list for a different job, and it is the right one: never
 * OFFER `powershell:*` as an allow-rule suggestion. A wildcard on a shell is a
 * wildcard on everything the shell can reach, whoever writes it and however
 * carefully.
 */
export const NEVER_SUGGEST_AS_PREFIX: ReadonlySet<string> = new Set([
  'pwsh',
  'powershell',
  'cmd',
  'wsl',
  'bash',
  'sh',
  'zsh',
  ...SPAWNERS,
])

export const POWERSHELL_CODE_EXECUTION: ReadonlySet<string> = new Set([
  ...SCRIPT_EXECUTION,
  ...MODULE_LOADING,
  ...NETWORK,
  ...ALIAS_HIJACK,
  ...WMI_SPAWN,
  ...SPAWNERS,
])

/**
 * Does this text invoke a PowerShell command that runs something else?
 *
 * Matched on word boundaries and case-insensitively, because PowerShell is
 * case-insensitive and `IEX`, `iex` and `Invoke-Expression` are the same call.
 * A hyphenated cmdlet name cannot be matched with `\b` on its right side --
 * `\b` sits between `e` and `-` -- so the boundary is written explicitly.
 */
export function invokesPowerShellCodeExecution(text: string): string | null {
  if (!text) return null
  const lowered = text.toLowerCase()
  for (const cmdlet of POWERSHELL_CODE_EXECUTION) {
    const pattern = new RegExp(`(^|[\\s;|(&{'"\`])${cmdlet}([\\s;|)&}'"\`]|$)`)
    if (pattern.test(lowered)) return cmdlet
  }
  return null
}
