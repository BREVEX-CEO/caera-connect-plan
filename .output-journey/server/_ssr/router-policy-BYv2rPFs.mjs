import { d as selectFixedModel, o as detectPlatform } from "./ocade-local-CUSjQ2bI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-policy-BYv2rPFs.js
/**
* Work that must be executed deterministically, never generated. Routing one of
* these to a language model is a category error: the answer is checkable, so
* guessing it is strictly worse than computing it.
*/
var DETERMINISTIC_TASKS = [
	"file_write",
	"shell",
	"http_request",
	"arithmetic",
	"checksum",
	"sql"
];
/**
* Rolling per-model, per-task performance record.
*
* Bounded on purpose: a session that never forgets would let a model's first
* cold-start minute outweigh an hour of warm performance.
*/
var PerfLedger = class PerfLedger {
	keep;
	byKey = /* @__PURE__ */ new Map();
	constructor(keep = 20) {
		this.keep = keep;
	}
	static key(modelId, task) {
		return `${modelId}::${task}`;
	}
	record(sample) {
		const k = PerfLedger.key(sample.modelId, sample.task);
		const list = this.byKey.get(k) ?? [];
		list.push(sample);
		if (list.length > this.keep) list.splice(0, list.length - this.keep);
		this.byKey.set(k, list);
	}
	/** Null when this model has never been measured on this task. */
	stats(modelId, task) {
		const list = this.byKey.get(PerfLedger.key(modelId, task));
		if (!list || list.length === 0) return null;
		const oks = list.filter((s) => s.ok);
		const times = oks.map((s) => s.firstTokenMs).sort((a, b) => a - b);
		const median = times.length === 0 ? Number.POSITIVE_INFINITY : times[Math.floor(times.length / 2)];
		return {
			samples: list.length,
			medianFirstTokenMs: median,
			successRate: list.length === 0 ? 0 : oks.length / list.length
		};
	}
	snapshot() {
		const out = {};
		for (const k of this.byKey.keys()) {
			const [modelId, task] = k.split("::");
			const s = this.stats(modelId, task);
			if (s) out[k] = s;
		}
		return out;
	}
};
/**
* Refuse deterministic work outright (P06.S02).
*
* Exported separately so callers can check before they even build a prompt.
*/
function isDeterministic(task) {
	return DETERMINISTIC_TASKS.includes(task);
}
/**
* Which local model serves a task.
*
* WHAT THIS USED TO DO, AND WHY IT NO LONGER DOES IT
* ---------------------------------------------------
* It chose. It filtered candidates by total RAM, excluded tiers without a
* discrete GPU, consulted a quarantine list, preferred a "profile" per task
* kind, and finally ranked whatever survived by measured first-token latency.
* Five inputs, and every one of them a proxy for a question nobody asked.
*
* It also disagreed with the tier policy about the same machine — the two lists
* of "which models need a GPU" were kept in different files — and it is how a
* Qwen3 build ended up serving Control + Work whose `/no_think` control token
* leaked into a tool argument.
*
* OCADE HAS ONE MODEL. `local/fixed-model.ts` names it, and this function now
* asks that authority instead of re-deriving an answer. It keeps its signature
* and its receipt so every existing caller and every diagnostics screen keeps
* working, and the receipt now tells the truth about how the decision was made:
* `device_matched` is gone, because nothing is matched to a device any more.
*
* The ONE branch that remains is capability, not preference: a request carrying
* an image needs a model that can read images, and the fixed model cannot.
*/
function routeTask(task, models, _ledger, policy = {}) {
	const at = (/* @__PURE__ */ new Date()).toISOString();
	const usable = models.filter((m) => !m.isCloudPointer);
	const choice = selectFixedModel({
		platform: detectPlatform(),
		installed: usable.map((m) => ({
			id: m.id,
			vision: m.vision,
			sizeBytes: m.sizeBytes,
			isCloudPointer: m.isCloudPointer
		})),
		visionRequired: task === "vision"
	});
	const rejected = choice.notChosen.map((row) => ({
		modelId: row.modelId,
		why: row.why
	}));
	if (!choice.ok || !choice.modelId) return {
		ok: false,
		receipt: {
			task,
			chosen: null,
			basis: "none",
			rejected,
			refusal: choice.reason,
			policy,
			at
		}
	};
	const model = usable.find((m) => m.id === choice.modelId);
	if (!model) return {
		ok: false,
		receipt: {
			task,
			chosen: null,
			basis: "none",
			rejected,
			refusal: choice.reason ?? "OCADE's engine is not installed on this computer yet.",
			policy,
			at
		}
	};
	return {
		ok: true,
		model,
		receipt: {
			task,
			chosen: model.id,
			basis: "unmeasured",
			rejected,
			policy,
			at
		}
	};
}
//#endregion
export { isDeterministic as n, routeTask as r, PerfLedger as t };
