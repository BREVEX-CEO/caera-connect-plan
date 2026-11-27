/**
 * REPO-51: why a step did not happen, in words for the person (the planner reads `REPAIR_HINTS`
 * instead). One sentence per companion refusal the person can understand; a code not listed here has
 * no sentence, so nothing is invented about it.
 */
const REASONS: Record<string, string> = {
  element_stale: "The app changed after JARVIS looked at it, so JARVIS did not click.",
  stale_selector: "The page changed after JARVIS read it, so JARVIS did not act on it.",
  selector_not_found: "JARVIS could not find that button or field on the page.",
  selector_not_unique: "More than one button or field matched, so JARVIS did not guess.",
  element_not_found: "JARVIS could not find that control in the app.",
  element_ambiguous: "More than one control matched, so JARVIS did not guess.",
  window_changed: "A different window came up, so JARVIS stopped before acting on it.",
  window_gone: "The window was closed.",
  window_minimized: "The window is minimised. Restore it so JARVIS can continue.",
  window_blocked: "A dialog is open in front of the window. Answer or close it first.",
  window_ambiguous: "More than one window matched, so JARVIS did not guess.",
  window_not_responding: "The app is not responding.",
  not_changed: "Nothing changed in the app in time.",
  focus_lost: "Another window took focus, so JARVIS stopped typing.",
  user_active: "You were using the computer, so JARVIS waited.",
  stale_image: "The picture of the window was out of date, so JARVIS did not click.",
  inspect_first: "JARVIS has to look at the app before it acts on it.",
  page_gone: "The page was closed.",
  page_left_site: "The page moved to a site this task is not allowed to use.",
  output_exists: "A file with that name already exists, and JARVIS never replaces your files.",
  file_changed: "The file changed after JARVIS read it, so JARVIS did not overwrite it.",
  file_changed_during_write:
    "You saved the file while JARVIS was editing it. Both versions were kept.",
  find_not_unique: "The text to replace appears more than once, so JARVIS did not guess.",
  file_in_use: "Another program is using the file.",
  file_open_in_app: "The file is open in an app. Close it there, or change it in that app.",
  path_outside_workspace: "That file is outside the JARVIS folder.",
  write_outside_output: "JARVIS writes new files only into the 'OCADE output' folder.",
  insufficient_storage: "There is not enough free disk space.",
  wait_timed_out: "The expected change did not happen in time.",
  expectation_unmet: "The step ran, but the result was not what was expected.",
  batch_stopped:
    "An earlier step in the same group did not go as planned, so this one did not run.",
  deadline_passed: "The step was too late to run.",
  timeout: "The step took too long.",
  stopped: "You stopped the task.",
};

export function failureReason(errorCode: string | null | undefined): string | null {
  return errorCode && Object.hasOwn(REASONS, errorCode) ? REASONS[errorCode]! : null;
}
