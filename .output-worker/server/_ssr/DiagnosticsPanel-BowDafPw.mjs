import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { C as Stethoscope, M as ShieldCheck, m as TriangleAlert, p as Undo2 } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/DiagnosticsPanel-BowDafPw.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var SIGNATURES = [
	{
		failureClass: "dependency",
		patterns: [
			/cannot find module/i,
			/module not found/i,
			/unresolved import/i,
			/no matching version found/i,
			/peer dep/i
		],
		rationale: "The error names a module or version that can't be resolved.",
		repairs: [{
			action: "Reinstall dependencies from the lockfile (a clean install, not an upgrade).",
			verifyBy: "Re-run the command that failed; the missing-module error should be gone.",
			rollback: "The lockfile is unchanged, so the previous node_modules can be restored by reinstalling it.",
			needsCheckpoint: false
		}, {
			action: "If a specific version is missing, check whether the lockfile and manifest disagree — reconcile them without upgrading unrelated packages.",
			verifyBy: "Install succeeds and the named version is present.",
			rollback: "Revert the manifest/lockfile edit.",
			needsCheckpoint: true
		}]
	},
	{
		failureClass: "corrupted_cache",
		patterns: [
			/checksum mismatch/i,
			/corrupt/i,
			/unexpected end of (file|json)/i,
			/integrity check/i
		],
		rationale: "A checksum or integrity failure points at a corrupted cache rather than a code fault.",
		repairs: [{
			action: "Clear the tool's cache directory and let it repopulate.",
			verifyBy: "Re-run the operation; the integrity error should not recur.",
			rollback: "Caches are regenerated from sources, so clearing one loses nothing that can't be re-fetched.",
			needsCheckpoint: true
		}]
	},
	{
		failureClass: "permission",
		patterns: [
			/permission denied/i,
			/EACCES/i,
			/operation not permitted/i,
			/access is denied/i
		],
		rationale: "The error is an access denial, not a logic error.",
		repairs: [{
			action: "Check the file/directory ownership and mode for the path named in the error, and correct only that path.",
			verifyBy: "Re-run the operation on that path; the denial should be gone.",
			rollback: "Record the prior mode/owner before changing, and restore it if the fix doesn't help.",
			needsCheckpoint: true
		}]
	},
	{
		failureClass: "missing_runtime",
		patterns: [
			/command not found/i,
			/is not recognized as/i,
			/no such file or directory.*(node|python|java|dotnet)/i
		],
		rationale: "A required runtime or executable isn't on the path.",
		repairs: [{
			action: "Confirm the runtime is installed and on PATH for this shell; report the version found.",
			verifyBy: "The runtime responds to a --version check.",
			rollback: "No change is made by checking; installation, if needed, is a separate approved step.",
			needsCheckpoint: false
		}]
	},
	{
		failureClass: "network",
		patterns: [
			/ETIMEDOUT/i,
			/ECONNREFUSED/i,
			/getaddrinfo/i,
			/network is unreachable/i,
			/TLS handshake/i
		],
		rationale: "The failure is a network-level error, not the application's own logic.",
		repairs: [{
			action: "Retry once after a short backoff; transient network errors often clear on their own.",
			verifyBy: "The request succeeds on retry.",
			rollback: "A read retry changes nothing; nothing to roll back.",
			needsCheckpoint: false
		}]
	},
	{
		failureClass: "database",
		patterns: [
			/connection refused.*(5432|3306|1433|27017)/i,
			/too many connections/i,
			/database.*does not exist/i,
			/relation .* does not exist/i
		],
		rationale: "The error is a database connectivity or schema problem.",
		repairs: [{
			action: "Check the database is reachable and the connection string points at the right instance; do not alter schema yet.",
			verifyBy: "A read-only connection test succeeds.",
			rollback: "A connection test is read-only; nothing to roll back.",
			needsCheckpoint: false
		}]
	},
	{
		failureClass: "config",
		patterns: [
			/invalid configuration/i,
			/unexpected token .* in .*\.(json|ya?ml)/i,
			/missing required (field|key|env)/i,
			/ENOENT.*\.(env|config|rc)/i
		],
		rationale: "A configuration file is missing, malformed, or incomplete.",
		repairs: [{
			action: "Validate the named config file against its schema and show the exact line/key at fault.",
			verifyBy: "The config parses and the required keys are present.",
			rollback: "Any edit is to config only; keep a copy of the prior file to restore.",
			needsCheckpoint: true
		}]
	},
	{
		failureClass: "low_memory",
		patterns: [
			/out of memory/i,
			/ENOMEM/i,
			/heap out of memory/i,
			/killed.*signal 9/i
		],
		rationale: "The process ran out of memory rather than hitting a logic error.",
		repairs: [{
			action: "Report the memory ceiling and peak usage; recommend a lower batch size or a higher limit rather than retrying unchanged.",
			verifyBy: "The operation completes within the memory budget.",
			rollback: "A recommendation changes nothing until the user applies it.",
			needsCheckpoint: false
		}]
	},
	{
		failureClass: "driver_mismatch",
		patterns: [
			/driver version mismatch/i,
			/incompatible driver/i,
			/kernel module .* not loaded/i,
			/CUDA driver version is insufficient/i,
			/this nvidia driver/i
		],
		rationale: "The error points at a driver whose version doesn't match what the software expects.",
		repairs: [{
			action: "Report the installed driver version and the version the software requires; do NOT install a driver automatically — driver changes are high-risk and need explicit approval.",
			verifyBy: "The versions are shown side by side so the user can decide.",
			rollback: "Reporting changes nothing. Any driver change the user approves is a separate step with its own restore point.",
			needsCheckpoint: false
		}]
	},
	{
		failureClass: "broken_plugin",
		patterns: [
			/failed to load (plugin|extension|addon)/i,
			/plugin .* (crashed|incompatible|disabled)/i,
			/extension host terminated/i,
			/unknown plugin/i
		],
		rationale: "A plugin or extension failed to load, which can break the host without the host's own code being at fault.",
		repairs: [{
			action: "Disable the named plugin and restart the host to confirm it's the cause — the least invasive test, and reversible.",
			verifyBy: "With the plugin disabled, the host starts cleanly.",
			rollback: "Re-enable the plugin; disabling is a toggle, nothing is deleted.",
			needsCheckpoint: true
		}, {
			action: "If disabling confirms the plugin, check for an update or a compatible version rather than editing the host.",
			verifyBy: "The updated plugin loads without the error.",
			rollback: "Keep the prior plugin version to reinstall if the update is worse.",
			needsCheckpoint: true
		}]
	},
	{
		failureClass: "file_format",
		patterns: [
			/unsupported file format/i,
			/invalid (file )?header/i,
			/cannot (open|parse|decode) .* file/i,
			/not a valid .* (file|document|image|archive)/i,
			/magic (number|bytes) mismatch/i
		],
		rationale: "The file can't be read as the format it's expected to be — a data problem, not a code one.",
		repairs: [{
			action: "Identify the file's real format from its contents (magic bytes), and report the mismatch between that and its extension — without altering the file.",
			verifyBy: "The true format is named; the user can convert or re-export from the source.",
			rollback: "The file is only read, never modified, so there is nothing to undo.",
			needsCheckpoint: false
		}]
	},
	{
		failureClass: "gpu",
		priority: 1,
		patterns: [
			/out of (video |GPU )memory/i,
			/CUDA out of memory/i,
			/device-side assert/i,
			/no CUDA-capable device/i,
			/VRAM/i,
			/GPU is not available/i
		],
		rationale: "The error is a GPU limitation — out of video memory or no usable device — rather than a logic fault.",
		repairs: [{
			action: "Recommend a smaller batch, lower resolution, or CPU fallback that fits the available VRAM; do not simply retry the same workload.",
			verifyBy: "The workload completes within the GPU's memory, or runs on CPU.",
			rollback: "A recommendation changes nothing until applied; a settings change is reverted by restoring the prior value.",
			needsCheckpoint: false
		}]
	},
	{
		failureClass: "solver_instability",
		patterns: [
			/did not converge/i,
			/divergence detected/i,
			/NaN (detected|in residual)/i,
			/solution became unstable/i,
			/maximum iterations reached/i,
			/timestep too large/i
		],
		rationale: "A numerical solver failed to converge or went unstable — a modelling/parameter issue, never something to paper over.",
		repairs: [{
			action: "Report the divergence point and recommend a smaller timestep, tighter tolerance, or better initial conditions. NEVER present a non-converged run as a result.",
			verifyBy: "A re-run converges within tolerance, confirmed by the solver's own residuals — not assumed.",
			rollback: "Parameter changes are recorded; the prior setup can be restored. The failed run produced no valid output to undo.",
			needsCheckpoint: true
		}]
	}
];
/**
* Diagnose a failure from its symptoms.
*
* Confidence rises with the number of independent symptom lines that point at
* the same class. A single vague line is a guess; several agreeing lines are a
* diagnosis. It never returns a repair for a class it only weakly suspects —
* it asks for more first.
*/
function diagnose(symptoms) {
	if (symptoms.length === 0) return {
		failureClass: "unknown",
		confidence: 0,
		rationale: "No symptoms were provided, so there's nothing to diagnose.",
		repairs: [],
		gatherMore: "Share the error message, the exit code, or the relevant log lines."
	};
	const uniqueSymptoms = [...new Map(symptoms.filter((symptom) => typeof symptom.text === "string" && symptom.text.trim().length > 0).map((symptom) => [`${symptom.source}:${symptom.text.trim()}`, symptom])).values()];
	const scores = /* @__PURE__ */ new Map();
	for (const sig of SIGNATURES) {
		const hits = uniqueSymptoms.filter((symptom) => sig.patterns.some((pattern) => pattern.test(symptom.text))).length;
		if (hits > 0) scores.set(sig.failureClass, {
			hits,
			sig
		});
	}
	if (scores.size === 0) return {
		failureClass: "unknown",
		confidence: .1,
		rationale: "Nothing in the symptoms matches a known failure signature.",
		repairs: [],
		gatherMore: "Capture the full error with its stack trace, the tool and version, and the command that triggered it. OCADE won't change anything on a signature it doesn't recognise."
	};
	const ranked = [...scores.values()].sort((a, b) => b.hits - a.hits || (b.sig.priority ?? 0) - (a.sig.priority ?? 0));
	const top = ranked[0];
	if (ranked.length > 1 && ranked[1].hits === top.hits && (ranked[1].sig.priority ?? 0) === (top.sig.priority ?? 0)) return {
		failureClass: "unknown",
		confidence: .2,
		rationale: "The symptoms point equally strongly at more than one failure class.",
		repairs: [],
		gatherMore: "The evidence is conflicting. Capture the exact failing command, exit code, and adjacent log lines before changing anything."
	};
	const confidence = Number(Math.min(.9, .4 + top.hits * .2).toFixed(2));
	const diagnosis = {
		failureClass: top.sig.failureClass,
		confidence,
		rationale: top.sig.rationale,
		repairs: confidence >= .5 ? top.sig.repairs.map((repair) => ({ ...repair })) : []
	};
	if (confidence < .5) diagnosis.gatherMore = "This is a best guess from limited signal. Before changing anything, capture a fuller log or the exact failing command so OCADE can confirm the cause.";
	return diagnosis;
}
/**
* Software Error Healing (§11), made usable.
*
* Paste an error; OCADE classifies it from the evidence, ranks the likely
* cause, and proposes the least-invasive repair FIRST — each repair showing how
* it would be verified and how it rolls back. Every number and every repair
* here comes from the real `diagnose` engine the tests exercise.
*
* The two honesty rules are visible in the surface: a thin signal is shown as a
* guess with "gather more" rather than a confident repair, and no repair is
* ever shown without its rollback.
*/
var SAMPLE = "Error: Cannot find module 'left-pad'\n    at require (node:internal/modules/cjs/loader)";
function DiagnosticsPanel() {
	const [text, setText] = (0, import_react.useState)(SAMPLE);
	const [result, setResult] = (0, import_react.useState)(null);
	function run() {
		const symptoms = text.split("\n").map((t) => t.trim()).filter(Boolean).map((t) => ({
			text: t,
			source: "log"
		}));
		setResult(diagnose(symptoms));
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "mb-1 flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stethoscope, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " Diagnose a software error"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-3 text-xs text-muted-foreground",
				children: "Paste an error or log lines. OCADE classifies it, ranks the likely cause, and proposes the least-invasive fix first — with how it’s verified and how it undoes. A weak signal is shown as a guess, not a confident repair."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
				htmlFor: "diag-input",
				className: "text-xs font-medium text-foreground",
				children: "Error or log"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
				id: "diag-input",
				value: text,
				onChange: (e) => setText(e.target.value),
				rows: 4,
				spellCheck: false,
				className: "mt-1 w-full resize-y rounded-md border border-border/60 bg-background/40 p-2 font-mono text-[11px] text-foreground"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					className: "h-8",
					onClick: run,
					children: "Diagnose"
				})
			}),
			result ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				className: cn("mt-3 rounded-lg border p-3 text-xs", result.confidence >= .5 && result.repairs.length > 0 ? "border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10" : "border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-center gap-1.5 font-medium text-foreground",
						children: [
							result.repairs.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
								className: "h-3.5 w-3.5",
								"aria-hidden": true
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
								className: "h-3.5 w-3.5",
								"aria-hidden": true
							}),
							labelFor(result.failureClass),
							" · ",
							Math.round(result.confidence * 100),
							"% confidence"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-muted-foreground",
						children: result.rationale
					}),
					result.gatherMore ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1.5 rounded border border-border/60 bg-secondary/25 p-2 text-[11px] text-muted-foreground",
						children: result.gatherMore
					}) : null,
					result.repairs.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
						className: "mt-2 flex flex-col gap-2",
						children: result.repairs.map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-lg border border-border/60 p-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-[12px] font-medium text-foreground",
									children: [
										i + 1,
										". ",
										r.action,
										r.needsCheckpoint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "ml-1 rounded bg-[color:var(--state-warning)]/15 px-1 py-0.5 text-[9px] uppercase text-[color:var(--state-warning)]",
											children: "checkpoint first"
										}) : null
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-0.5 text-[11px] text-muted-foreground",
									children: ["Verify: ", r.verifyBy]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-0.5 flex items-start gap-1 text-[11px] text-muted-foreground",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Undo2, {
											className: "mt-0.5 h-3 w-3 shrink-0",
											"aria-hidden": true
										}),
										" Undo: ",
										r.rollback
									]
								})
							]
						}, i))
					}) : null
				]
			}) : null
		]
	});
}
function labelFor(kind) {
	return {
		dependency: "Dependency error",
		corrupted_cache: "Corrupted cache",
		permission: "Permission problem",
		missing_runtime: "Missing runtime",
		config: "Configuration error",
		network: "Network failure",
		database: "Database problem",
		low_memory: "Out of memory",
		driver_mismatch: "Driver mismatch",
		broken_plugin: "Broken plugin",
		file_format: "File-format error",
		gpu: "GPU limitation",
		solver_instability: "Solver instability",
		unknown: "Unrecognised error"
	}[kind];
}
//#endregion
export { DiagnosticsPanel as t };
