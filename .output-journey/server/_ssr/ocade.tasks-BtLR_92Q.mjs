import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as TasksWorkspace } from "./TasksWorkspace-kWT5Chen.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.tasks-BtLR_92Q.js
var import_jsx_runtime = require_jsx_runtime();
/**
* Tasks, inside OCADE where the work is.
*
* The same screen as `/settings/tasks` — shared component, one source of data
* (`ocade_automations` and `ocade_automation_runs`) — because two task lists
* that could disagree about whether a run is live would make every Stop button
* on both of them a guess.
*/
var SplitComponent = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TasksWorkspace, {
	backTo: "/ocade",
	backLabel: "Back to OCADE"
});
//#endregion
export { SplitComponent as component };
