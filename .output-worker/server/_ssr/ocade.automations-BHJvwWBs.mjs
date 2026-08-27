import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-BvyzyYvI.mjs";
import { Cn as Eye, N as ShieldAlert, St as OctagonX, Wt as LoaderCircle, a as WifiOff, h as Trash2, ir as Check, it as Plus, pt as Pause, qn as CirclePlay, r as Workflow, st as Play, t as X } from "../_libs/lucide-react.mjs";
import { d as riskOf, p as subscribeCompanionAdapter, s as getCompanion, t as COMPANION_UNAVAILABLE_REASON, u as redactForAudit } from "./companion-bridge-CJ48JKAT.mjs";
import { r as bootstrapCompanion } from "./tauri-companion-u0J6qjWn.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as DialogHeader, i as DialogFooter, n as DialogContent, o as DialogTitle, t as Dialog } from "./dialog-CCT-3-fg.mjs";
import { t as computerUseChannelDecision } from "./computer-use-settings-EFoxzXrd.mjs";
import { o as decideRetry, s as describeRunEnqueue, t as IN_FLIGHT_STATUSES } from "./ocade-automations-Dh0tqTFk.mjs";
import { t as EmptyState } from "./EmptyState-Bm7ErAtz.mjs";
import { t as SetupRequiredState } from "./SetupRequiredState-CYfm-mjI.mjs";
import { t as classifyUnavailable } from "./unavailable-reason-BKLY-mVD.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { a as deleteAutomation, d as startAutomationRun, f as updateAutomation, i as decideAutomationRun, l as previewAutomation, n as cancelAutomationRun, o as listAutomationRuns, r as createAutomation, s as listAutomations, t as cancelAllRuns } from "./ocade-automations.functions-DLxP9cbw.mjs";
import { t as useOnline } from "./use-online-DzqlfJYh.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.automations-BHJvwWBs.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ACTIVE = ["pending", "running"];
function latestRunFor(runs, automationId) {
	return runs.filter((r) => r.automationId === automationId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
}
/**
* Decide what to start. Deterministic and side-effect free — the caller
* performs the actual starts.
*/
function selectDueAutomations(automations, runs, now = /* @__PURE__ */ new Date(), maxConcurrent = 3) {
	const nowMs = now.getTime();
	if (!Number.isFinite(nowMs)) throw new RangeError("Automation scheduling requires a valid clock.");
	const concurrencyLimit = Number.isFinite(maxConcurrent) && maxConcurrent >= 0 ? Math.floor(maxConcurrent) : 3;
	const due = [];
	const skipped = [];
	let inFlight = runs.filter((r) => ACTIVE.includes(r.status)).length;
	const ordered = [...automations].sort((a, b) => {
		return (a.nextRunAt ? Date.parse(a.nextRunAt) : Number.POSITIVE_INFINITY) - (b.nextRunAt ? Date.parse(b.nextRunAt) : Number.POSITIVE_INFINITY);
	});
	for (const a of ordered) {
		if (!a.enabled) {
			skipped.push({
				automationId: a.id,
				reason: "disabled"
			});
			continue;
		}
		if (a.paused) {
			skipped.push({
				automationId: a.id,
				reason: "paused"
			});
			continue;
		}
		if (!a.nextRunAt) {
			skipped.push({
				automationId: a.id,
				reason: "manual"
			});
			continue;
		}
		const scheduledAt = Date.parse(a.nextRunAt);
		if (!Number.isFinite(scheduledAt)) {
			skipped.push({
				automationId: a.id,
				reason: "invalid_schedule"
			});
			continue;
		}
		if (scheduledAt > nowMs) {
			skipped.push({
				automationId: a.id,
				reason: "not_due"
			});
			continue;
		}
		const last = latestRunFor(runs, a.id);
		if (last && ACTIVE.includes(last.status)) {
			skipped.push({
				automationId: a.id,
				reason: "already_running"
			});
			continue;
		}
		if (last && last.status === "awaiting_approval") {
			skipped.push({
				automationId: a.id,
				reason: "awaiting_approval"
			});
			continue;
		}
		if (last && last.status === "failed") {
			const retry = decideRetry({
				status: "failed",
				attempt: last.attempt,
				maxAttempts: a.maxAttempts
			});
			const readyAt = last.nextAttemptAt ? Date.parse(last.nextAttemptAt) : Date.parse(last.createdAt) + retry.delayMs;
			if (!Number.isFinite(readyAt)) {
				skipped.push({
					automationId: a.id,
					reason: "invalid_run_state"
				});
				continue;
			}
			if (retry.retry && readyAt > nowMs) {
				skipped.push({
					automationId: a.id,
					reason: "backoff"
				});
				continue;
			}
			if (!retry.retry) {
				if (scheduledAt > nowMs) {
					skipped.push({
						automationId: a.id,
						reason: "not_due"
					});
					continue;
				}
			}
		}
		if (inFlight >= concurrencyLimit) {
			skipped.push({
				automationId: a.id,
				reason: "concurrency_limit"
			});
			continue;
		}
		due.push(a.id);
		inFlight++;
	}
	return {
		due,
		skipped
	};
}
/** When the next retry of a failed run becomes eligible. */
function retryReadyAt(run, maxAttempts) {
	const createdAt = Date.parse(run.createdAt);
	if (!Number.isFinite(createdAt)) return {
		retry: false,
		readyAt: null,
		reason: "Retry timing is unavailable because the persisted run time is invalid."
	};
	const decision = decideRetry({
		status: "failed",
		attempt: run.attempt,
		maxAttempts
	});
	return {
		retry: decision.retry,
		readyAt: decision.retry ? new Date(createdAt + decision.delayMs) : null,
		reason: decision.reason
	};
}
/** Human-readable explanation used in the run history and audit trail. */
function describeSkip(reason) {
	switch (reason) {
		case "disabled": return "Turned off.";
		case "paused": return "Paused.";
		case "manual": return "Runs only when you start it.";
		case "not_due": return "Not due yet.";
		case "already_running": return "A run is already in progress.";
		case "awaiting_approval": return "Waiting for your approval.";
		case "backoff": return "Waiting before the next retry.";
		case "concurrency_limit": return "Too many runs in progress — it will start shortly.";
		case "invalid_schedule": return "The saved schedule is invalid and must be corrected.";
		case "invalid_run_state": return "The saved retry state is invalid and must be repaired.";
		default: return "Skipped.";
	}
}
/**
* How much time is left, and whether the deadline still holds.
*
* Refuses a nonsensical window (deadline before start) by reporting it rather
* than returning a misleading positive remaining.
*/
function checkDeadline(state, now) {
	const startedAt = state.startedAt.getTime();
	const deadline = state.deadline.getTime();
	const current = now.getTime();
	const total = deadline - startedAt;
	if (!Number.isFinite(startedAt) || !Number.isFinite(deadline) || !Number.isFinite(current) || total <= 0) return {
		valid: false,
		reason: "The deadline window has invalid dates or does not end after it starts.",
		remainingMs: 0,
		withinDeadline: false,
		fractionElapsed: 1
	};
	const remainingMs = deadline - current;
	return {
		valid: true,
		remainingMs,
		withinDeadline: remainingMs > 0,
		fractionElapsed: (current - startedAt) / total
	};
}
/**
* Decide whether to start the next step, given how long it is estimated to take.
*
* A safety margin is applied so a step that would finish *just* at the deadline
* — with no room for the estimate being slightly optimistic — is not started.
* The margin defaults to 10% of the step estimate, floored at one second.
*/
function shouldStartStep(state, now, estimatedStepMs, marginMs) {
	if (!Number.isFinite(estimatedStepMs) || estimatedStepMs < 0) return {
		start: false,
		reason: "The step has no valid time estimate, so OCADE can't judge whether it fits the deadline.",
		remainingMs: 0,
		shortByMs: 0
	};
	if (marginMs !== void 0 && (!Number.isFinite(marginMs) || marginMs < 0)) return {
		start: false,
		reason: "The deadline safety margin is invalid.",
		remainingMs: 0,
		shortByMs: 0
	};
	const check = checkDeadline(state, now);
	if (!check.valid) return {
		start: false,
		reason: check.reason ?? "The deadline window is invalid.",
		remainingMs: 0,
		shortByMs: 0
	};
	const { remainingMs } = check;
	const margin = marginMs ?? Math.max(1e3, estimatedStepMs * .1);
	const need = estimatedStepMs + margin;
	if (!Number.isSafeInteger(Math.ceil(need))) return {
		start: false,
		reason: "The step time budget exceeds the safe numeric range.",
		remainingMs,
		shortByMs: 0
	};
	if (remainingMs <= 0) return {
		start: false,
		reason: `The deadline has already passed by ${formatMs(-remainingMs)}. OCADE won't start further steps.`,
		remainingMs,
		shortByMs: need
	};
	if (need > remainingMs) {
		const shortByMs = need - remainingMs;
		return {
			start: false,
			reason: `This step needs about ${formatMs(estimatedStepMs)} (plus a ${formatMs(margin)} margin) but only ${formatMs(remainingMs)} is left before the deadline — short by ${formatMs(shortByMs)}. OCADE won't start work it can't finish in time; it stops cleanly here instead.`,
			remainingMs,
			shortByMs
		};
	}
	return {
		start: true,
		reason: `About ${formatMs(remainingMs)} left, enough for this ~${formatMs(estimatedStepMs)} step.`,
		remainingMs
	};
}
function formatMs(ms) {
	const abs = Math.abs(Math.round(ms));
	if (abs < 1e3) return `${abs} ms`;
	const s = abs / 1e3;
	if (s < 60) return `${s.toFixed(s >= 10 ? 0 : 1)} s`;
	const m = s / 60;
	return `${m.toFixed(m >= 10 ? 0 : 1)} min`;
}
/**
* Shared automation worker lifecycle.
*
* This module deliberately owns no database client, timer, or native adapter.
* Instead it defines the atomic persistence and execution contracts those
* runtimes must implement. That keeps the state machine testable while making
* the critical boundary explicit: a queued row is not execution, and an
* executor's `ok` is not success until an independent verifier confirms it.
*/
function operationId(runId, stepIndex) {
	return `${runId}:step:${stepIndex}`;
}
async function completeCancellation(claim, store, executor, receipts, now, error = null) {
	try {
		await executor.cancel(claim.id);
	} catch {}
	return await store.complete(claim, {
		status: "cancelled",
		error: error ? redactForAudit(error) : null,
		finishedAt: now().toISOString()
	}) ? {
		status: "cancelled",
		receipts
	} : {
		status: "lost_claim",
		reason: "The worker no longer owns this run, so it could not record cancellation.",
		receipts
	};
}
async function stopForUnavailableCancellationChannel(claim, store, executor, receipts, now) {
	try {
		await executor.cancel(claim.id);
	} catch {}
	return failOrRetry(claim, store, "Cancellation monitoring became unavailable, so the worker stopped rather than run without an emergency brake.", receipts, now);
}
async function completePause(claim, store, executor, receipts, now) {
	try {
		await executor.cancel(claim.id);
	} catch {}
	const reason = "Paused by the user. Resume will continue from the first unverified step.";
	return await store.suspend(claim, {
		reason,
		pausedAt: now().toISOString()
	}) ? {
		status: "paused",
		reason,
		receipts
	} : {
		status: "lost_claim",
		reason: "The worker no longer owns this run, so it could not record the pause.",
		receipts
	};
}
function stopForControl(claim, store, executor, receipts, now, reason) {
	if (reason === "unavailable") return stopForUnavailableCancellationChannel(claim, store, executor, receipts, now);
	if (reason === "paused") return completePause(claim, store, executor, receipts, now);
	return completeCancellation(claim, store, executor, receipts, now);
}
async function failOrRetry(claim, store, reason, receipts, now, terminalRecovery) {
	const decision = decideRetry({
		status: "failed",
		attempt: claim.attempt,
		maxAttempts: claim.maxAttempts
	});
	const safeReason = redactForAudit(reason);
	if (decision.retry) {
		const nextAttemptAt = new Date(now().getTime() + decision.delayMs).toISOString();
		const attempt = claim.attempt + 1;
		return await store.requeue(claim, {
			status: "pending",
			attempt,
			nextAttemptAt,
			error: safeReason
		}) ? {
			status: "deferred",
			reason: safeReason,
			attempt,
			nextAttemptAt,
			receipts
		} : {
			status: "lost_claim",
			reason: "The worker no longer owns this run, so it could not schedule the retry.",
			receipts
		};
	}
	let finalReason = safeReason;
	if (terminalRecovery) {
		const recovery = await terminalRecovery();
		if (recovery.status === "lost_claim") return {
			status: "lost_claim",
			reason: recovery.reason,
			receipts
		};
		finalReason = `${safeReason} Recovery: ${recovery.detail}`;
	}
	return await store.complete(claim, {
		status: "failed",
		error: finalReason,
		finishedAt: now().toISOString()
	}) ? {
		status: "failed",
		reason: finalReason,
		receipts
	} : {
		status: "lost_claim",
		reason: "The worker no longer owns this run, so it could not record the failure.",
		receipts
	};
}
async function rollbackCompletedSteps(claim, throughStepIndex, store, executor, verifier, receipts, now) {
	let rolledBack = 0;
	const missing = [];
	const failed = [];
	for (let stepIndex = throughStepIndex; stepIndex >= 0; stepIndex--) {
		const step = claim.steps[stepIndex];
		if (!step || step.risk === "read_only") continue;
		if (!step.rollbackAction) {
			missing.push(stepIndex + 1);
			continue;
		}
		const operationId = `${claim.id}:rollback:${stepIndex}`;
		const startedAt = now().toISOString();
		let execution;
		try {
			execution = await executor.execute(step.rollbackAction, {
				runId: claim.id,
				operationId,
				confirmed: true
			});
		} catch (error) {
			execution = {
				ok: false,
				detail: error instanceof Error ? error.message : "The rollback executor failed."
			};
		}
		let verification = {
			verified: false,
			evidence: execution.detail
		};
		if (execution.ok) try {
			verification = await verifier.verify({
				action: step.rollbackAction,
				executionDetail: execution.detail,
				runId: claim.id,
				operationId
			});
		} catch (error) {
			verification = {
				verified: false,
				evidence: error instanceof Error ? error.message : "Rollback verification failed."
			};
		}
		const verified = execution.ok && verification.verified;
		const receipt = {
			runId: claim.id,
			stepIndex,
			phase: "rollback",
			operationId,
			actionKind: step.rollbackAction.kind,
			status: verified ? "succeeded" : "failed",
			executionOk: execution.ok,
			verified,
			detail: redactForAudit(verification.evidence || execution.detail),
			startedAt,
			finishedAt: now().toISOString()
		};
		if (!await store.appendReceipt(claim, receipt)) return {
			status: "lost_claim",
			reason: "The worker lost its claim while recording a rollback receipt."
		};
		receipts.push(receipt);
		if (verified) rolledBack += 1;
		else failed.push(stepIndex + 1);
	}
	if (missing.length === 0 && failed.length === 0) return {
		status: "recovered",
		detail: rolledBack > 0 ? `${rolledBack} prepared inverse ${rolledBack === 1 ? "action was" : "actions were"} independently verified.` : "No completed mutating step required rollback."
	};
	const parts = [];
	if (missing.length > 0) parts.push(`steps without an automatic inverse: ${missing.join(", ")}`);
	if (failed.length > 0) parts.push(`rollback verification failed for steps: ${failed.join(", ")}`);
	return {
		status: "incomplete",
		detail: `${parts.join("; ")}. Manual recovery is required.`
	};
}
/**
* Whether the deadline forbids starting the next action.
*
* This used to re-implement `skills/deadline` inline, down to the same safety
* margin of `max(1s, estimate * 10%)`. Two copies of a rule that decides
* whether to start real, side-effecting automation work is one copy too many —
* they drift, and the drift is silent. The shared module is also the stricter
* of the two: it rejects a step budget that overflows the safe numeric range,
* which the inline version did not check.
*/
function deadlineFailure(claim, now, step) {
	if (!claim.deadlineAt) return null;
	const deadlineMs = Date.parse(claim.deadlineAt);
	if (!Number.isFinite(deadlineMs)) return "The persisted run deadline is invalid, so execution failed closed.";
	const state = {
		startedAt: new Date(Math.min(now.getTime(), deadlineMs - 1)),
		deadline: new Date(deadlineMs)
	};
	if (step?.estimatedDurationMs !== void 0) {
		const decision = shouldStartStep(state, now, step.estimatedDurationMs);
		return decision.start ? null : decision.reason;
	}
	return checkDeadline(state, now).withinDeadline ? null : "The run deadline passed before the next action could start.";
}
function approvalFailure(claim, now, step) {
	if (!step.requiresConfirmation) return null;
	if (!claim.confirmed || !claim.approvalExpiresAt) return "This step requires a current human approval.";
	const expiresMs = Date.parse(claim.approvalExpiresAt);
	if (!Number.isFinite(expiresMs) || expiresMs <= now.getTime()) return "The human approval expired before the next confirm-tier action.";
	return null;
}
async function completeApprovalWait(claim, store, reason, receipts, now) {
	const safeReason = redactForAudit(reason);
	return await store.awaitApproval(claim, {
		reason: safeReason,
		requestedAt: now().toISOString()
	}) ? {
		status: "awaiting_approval",
		reason: safeReason,
		receipts
	} : {
		status: "lost_claim",
		reason: "The worker no longer owns this run, so it could not renew approval.",
		receipts
	};
}
async function completeDeadlineFailure(claim, store, reason, receipts, now) {
	const safeReason = redactForAudit(reason);
	return await store.complete(claim, {
		status: "failed",
		error: safeReason,
		finishedAt: now().toISOString()
	}) ? {
		status: "failed",
		reason: safeReason,
		receipts
	} : {
		status: "lost_claim",
		reason: "The worker no longer owns this run, so it could not record the deadline failure.",
		receipts
	};
}
/**
* Claim and execute one persisted automation run.
*
* Successful receipts are appended before the next action starts, so recovery
* resumes at `nextStepIndex` instead of replaying already-confirmed effects.
*/
async function runAutomationWorker(input) {
	const now = input.now ?? (() => /* @__PURE__ */ new Date());
	const claim = await input.store.claim({
		runId: input.runId,
		workerId: input.workerId,
		now: now().toISOString()
	});
	if (!claim) return {
		status: "not_claimed",
		reason: "The run is not eligible or another worker already claimed it."
	};
	const receipts = [];
	const cancellation = input.store.watchCancellation(claim);
	try {
		for (let stepIndex = claim.nextStepIndex; stepIndex < claim.steps.length; stepIndex++) {
			if (cancellation.signal.aborted) return stopForControl(claim, input.store, input.executor, receipts, now, cancellation.reason());
			const needsApproval = approvalFailure(claim, now(), claim.steps[stepIndex]);
			if (needsApproval) return completeApprovalWait(claim, input.store, needsApproval, receipts, now);
			const beforeControl = deadlineFailure(claim, now(), claim.steps[stepIndex]);
			if (beforeControl) return completeDeadlineFailure(claim, input.store, beforeControl, receipts, now);
			if (!await input.store.heartbeat(claim, now().toISOString())) return {
				status: "lost_claim",
				reason: "The worker lost its atomic claim before the next action.",
				receipts
			};
			const afterHeartbeat = deadlineFailure(claim, now(), claim.steps[stepIndex]);
			if (afterHeartbeat) return completeDeadlineFailure(claim, input.store, afterHeartbeat, receipts, now);
			if (cancellation.signal.aborted) return stopForControl(claim, input.store, input.executor, receipts, now, cancellation.reason());
			const step = claim.steps[stepIndex];
			const opId = operationId(claim.id, stepIndex);
			const startedAt = now().toISOString();
			let execution;
			try {
				execution = await input.executor.execute(step.action, {
					runId: claim.id,
					operationId: opId,
					confirmed: claim.confirmed,
					signal: cancellation.signal
				});
			} catch (error) {
				execution = {
					ok: false,
					detail: error instanceof Error ? error.message : "The action executor failed."
				};
			}
			if (cancellation.signal.aborted) {
				const controlReason = cancellation.reason();
				if (controlReason === "paused" && !execution.ok) return completePause(claim, input.store, input.executor, receipts, now);
				const ambiguous = execution.ok;
				const receipt = {
					runId: claim.id,
					stepIndex,
					phase: "execute",
					operationId: opId,
					actionKind: step.action.kind,
					status: controlReason === "unavailable" || controlReason === "paused" ? "failed" : "cancelled",
					executionOk: execution.ok,
					verified: false,
					detail: ambiguous ? "Control arrived after the executor returned success. The action may have changed the computer, was not independently verified, and requires manual recovery." : controlReason === "unavailable" ? "Cancellation monitoring became unavailable before the failed action could be verified." : "Cancelled before the failed action could be verified.",
					startedAt,
					finishedAt: now().toISOString()
				};
				if (!await input.store.appendReceipt(claim, receipt)) return {
					status: "lost_claim",
					reason: "The worker lost its claim while recording cancellation.",
					receipts
				};
				receipts.push(receipt);
				if (ambiguous) {
					try {
						await input.executor.cancel(claim.id);
					} catch {}
					const reason = "The executor returned success after control was requested, but the effect could not be verified. Automatic replay is disabled; manual recovery is required.";
					return controlReason === "requested" ? completeCancellation(claim, input.store, input.executor, receipts, now, reason) : completeDeadlineFailure(claim, input.store, reason, receipts, now);
				}
				return controlReason === "unavailable" ? stopForUnavailableCancellationChannel(claim, input.store, input.executor, receipts, now) : controlReason === "paused" ? completePause(claim, input.store, input.executor, receipts, now) : completeCancellation(claim, input.store, input.executor, receipts, now);
			}
			let verification = {
				verified: false,
				evidence: execution.detail
			};
			if (execution.ok) try {
				verification = await input.verifier.verify({
					action: step.action,
					executionDetail: execution.detail,
					runId: claim.id,
					operationId: opId
				});
			} catch (error) {
				verification = {
					verified: false,
					evidence: error instanceof Error ? error.message : "Verification failed."
				};
			}
			const verified = execution.ok && verification.verified;
			const receipt = {
				runId: claim.id,
				stepIndex,
				phase: "execute",
				operationId: opId,
				actionKind: step.action.kind,
				status: verified ? "succeeded" : "failed",
				executionOk: execution.ok,
				verified,
				detail: redactForAudit(verification.evidence || execution.detail),
				startedAt,
				finishedAt: now().toISOString()
			};
			if (!await input.store.appendReceipt(claim, receipt)) return {
				status: "lost_claim",
				reason: "The worker lost its atomic claim while recording an action receipt.",
				receipts
			};
			receipts.push(receipt);
			if (!verified) {
				const reason = execution.ok ? `Action ${stepIndex + 1} could not be independently verified: ${receipt.detail}` : `Action ${stepIndex + 1} failed: ${receipt.detail}`;
				return failOrRetry(claim, input.store, reason, receipts, now, () => rollbackCompletedSteps(claim, stepIndex, input.store, input.executor, input.verifier, receipts, now));
			}
		}
		return await input.store.complete(claim, {
			status: "succeeded",
			error: null,
			finishedAt: now().toISOString()
		}) ? {
			status: "succeeded",
			receipts
		} : {
			status: "lost_claim",
			reason: "Every action verified, but the worker lost its claim before finalization.",
			receipts
		};
	} finally {
		cancellation.dispose();
	}
}
/**
* Desktop automation worker supervisor.
*
* The supervisor is the preflight boundary above `runAutomationWorker`: it
* checks that a real companion is available and that every queued action has an
* independent verifier before it claims anything. An unavailable machine stays
* queued and visible instead of consuming attempts or becoming false failure.
*/
var AutomationVerifierRegistry = class {
	verifiers = /* @__PURE__ */ new Map();
	observationEvidence = /* @__PURE__ */ new Map();
	register(kind, verifier) {
		this.verifiers.set(kind, verifier);
	}
	/**
	* Register a verifier backed by a separate observation path. The desktop
	* host accepts only this provenance; a unit-test or executor-trusting
	* verifier may still exercise the supervisor but cannot start the live host.
	*/
	registerObservationBacked(kind, verifier, observationEvidence) {
		const evidence = observationEvidence.trim();
		if (!evidence) throw new Error("An observation-backed verifier requires provenance evidence.");
		this.verifiers.set(kind, verifier);
		this.observationEvidence.set(kind, evidence);
	}
	get(kind) {
		return this.verifiers.get(kind) ?? null;
	}
	observationBackedKinds() {
		return [...this.observationEvidence.keys()].sort();
	}
	missing(steps) {
		return [...new Set(steps.map((step) => step.action.kind))].filter((kind) => !this.verifiers.has(kind)).sort();
	}
};
function executorFor(companion) {
	return {
		async execute(action, opts) {
			const result = await companion.execute(action, opts);
			return {
				ok: result.ok,
				detail: result.detail
			};
		},
		cancel: (runId) => companion.cancel(runId)
	};
}
function verifierFor(registry) {
	return { async verify(input) {
		const verifier = registry.get(input.action.kind);
		if (!verifier) return {
			verified: false,
			evidence: `No independent verifier is registered for ${input.action.kind}.`
		};
		return verifier(input);
	} };
}
var AutomationWorkerSupervisor = class {
	input;
	now;
	constructor(input) {
		this.input = input;
		this.now = input.now ?? (() => /* @__PURE__ */ new Date());
	}
	async run(runId) {
		let status;
		try {
			status = await this.input.companion.status();
		} catch (error) {
			return {
				status: "idle",
				reason: error instanceof Error ? `The companion status check failed: ${error.message}` : COMPANION_UNAVAILABLE_REASON
			};
		}
		if (!status.available) return {
			status: "idle",
			reason: status.reason ?? "The OCADE Native Companion isn't connected. Computer control requires the signed companion app."
		};
		const candidate = await this.input.persistence.inspectEligibleRun(runId);
		if (!candidate) return {
			status: "not_eligible",
			reason: "The run is not pending, is still in backoff, was cancelled, or no longer exists."
		};
		if (candidate.steps.length === 0) return {
			status: "not_eligible",
			reason: "The run has no executable steps, so the supervisor will not claim it."
		};
		const missingVerifiers = this.input.verifiers.missing(candidate.steps);
		if (missingVerifiers.length > 0) return {
			status: "blocked",
			reason: `No independent verifier is registered for: ${missingVerifiers.join(", ")}. The run remains queued.`,
			missingVerifiers
		};
		return runAutomationWorker({
			runId,
			workerId: this.input.workerId,
			store: this.input.store,
			executor: executorFor(this.input.companion),
			verifier: verifierFor(this.input.verifiers),
			now: this.now
		});
	}
	/** Recover claims whose heartbeat is older than the configured threshold. */
	recoverStale(staleAfterMs) {
		const staleBefore = new Date(this.now().getTime() - staleAfterMs).toISOString();
		return this.input.persistence.recoverStale(staleBefore);
	}
};
var DIGEST = /^[a-f0-9]{64}$/;
function safeError(error) {
	return redactForAudit(error instanceof Error ? error.message : "The native observation channel failed.").replace(/\b(token|authorization|api[_-]?key|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");
}
function isRecord(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function validDigest(value) {
	return typeof value === "string" && DIGEST.test(value);
}
function canonicalTimestamp(value) {
	if (typeof value !== "string") return false;
	const parsed = new Date(value);
	return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}
function baseFailure(value, request, now, maxAgeMs, futureToleranceMs) {
	if (!isRecord(value)) return "The native observer returned a malformed response.";
	if (value.source !== "native-os-observer-v1") return "The response did not come from the trusted native observation channel.";
	if (value.kind !== request.kind || value.runId !== request.runId || value.operationId !== request.operationId) return "The native observation did not match this run and operation.";
	if (!canonicalTimestamp(value.observedAt)) return "The native observation timestamp is invalid.";
	const age = now.getTime() - Date.parse(value.observedAt);
	if (age > maxAgeMs) return "The native observation is stale.";
	if (age < -futureToleranceMs) return "The native observation is from the future.";
	return null;
}
async function digestObservationValue(value) {
	if (!globalThis.crypto?.subtle) throw new Error("Secure hashing is unavailable for native observation verification.");
	const bytes = new TextEncoder().encode(value);
	const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function normalized(value) {
	return value.normalize("NFKC").trim();
}
function isNativeObservationAdapter(value) {
	return Boolean(value) && typeof value === "object" && typeof value.observe === "function";
}
function createNativeObservationVerifierRegistry(observer, options = {}) {
	const registry = new AutomationVerifierRegistry();
	const now = options.now ?? (() => /* @__PURE__ */ new Date());
	const maxAgeMs = Math.max(100, Math.min(options.maxAgeMs ?? 1e4, 6e4));
	const futureToleranceMs = Math.max(0, Math.min(options.futureToleranceMs ?? 2e3, 1e4));
	async function observe(action, runId, operationId) {
		const request = {
			kind: action.kind,
			runId,
			operationId
		};
		let value;
		try {
			value = await observer.observe(request);
		} catch (error) {
			return {
				value: null,
				failure: `Native observation failed: ${safeError(error)}`
			};
		}
		const failure = baseFailure(value, request, now(), maxAgeMs, futureToleranceMs);
		return {
			value: isRecord(value) ? value : null,
			failure
		};
	}
	registry.registerObservationBacked("window.focus", async ({ action, runId, operationId }) => {
		if (action.kind !== "window.focus") return {
			verified: false,
			evidence: "Verifier/action kind mismatch."
		};
		const result = await observe(action, runId, operationId);
		if (result.failure || !result.value) return {
			verified: false,
			evidence: result.failure ?? "Native observation failed."
		};
		const expected = await digestObservationValue(normalized(action.target));
		return result.value.activeTargetDigest === expected && validDigest(result.value.activeTargetDigest) ? {
			verified: true,
			evidence: "Window focus verified through a fresh native OS observation."
		} : {
			verified: false,
			evidence: "The independently observed active window did not match."
		};
	}, "Fresh active-window identity hash from the native OS observer.");
	registry.registerObservationBacked("window.arrange", async ({ action, runId, operationId }) => {
		if (action.kind !== "window.arrange") return {
			verified: false,
			evidence: "Verifier/action kind mismatch."
		};
		const result = await observe(action, runId, operationId);
		if (result.failure || !result.value) return {
			verified: false,
			evidence: result.failure ?? "Native observation failed."
		};
		if (result.value.layout !== action.layout) return {
			verified: false,
			evidence: "The independently observed window layout did not match."
		};
		if (action.target) {
			const expected = await digestObservationValue(normalized(action.target));
			if (result.value.targetDigest !== expected || !validDigest(result.value.targetDigest)) return {
				verified: false,
				evidence: "The independently observed arranged window did not match."
			};
		}
		return {
			verified: true,
			evidence: "Window arrangement verified through a fresh native OS observation."
		};
	}, "Fresh window-bounds classification and target hash from the native OS observer.");
	registry.registerObservationBacked("app.open", async ({ action, runId, operationId }) => {
		if (action.kind !== "app.open") return {
			verified: false,
			evidence: "Verifier/action kind mismatch."
		};
		const result = await observe(action, runId, operationId);
		if (result.failure || !result.value) return {
			verified: false,
			evidence: result.failure ?? "Native observation failed."
		};
		const expected = await digestObservationValue(normalized(action.appId));
		return result.value.runningAppDigest === expected && validDigest(result.value.runningAppDigest) ? {
			verified: true,
			evidence: "Running application verified through a fresh native OS observation."
		} : {
			verified: false,
			evidence: "The independently observed running application did not match."
		};
	}, "Fresh running-process/application identity hash from the native OS observer.");
	registry.registerObservationBacked("file.open", async ({ action, runId, operationId }) => {
		if (action.kind !== "file.open") return {
			verified: false,
			evidence: "Verifier/action kind mismatch."
		};
		const result = await observe(action, runId, operationId);
		if (result.failure || !result.value) return {
			verified: false,
			evidence: result.failure ?? "Native observation failed."
		};
		const expected = await digestObservationValue(normalized(action.path));
		return result.value.activeFileDigest === expected && validDigest(result.value.activeFileDigest) ? {
			verified: true,
			evidence: "Active file verified through a fresh native OS observation."
		} : {
			verified: false,
			evidence: "The independently observed active file did not match."
		};
	}, "Fresh active-document canonical-path hash from the native OS observer.");
	registry.registerObservationBacked("clipboard.write", async ({ action, runId, operationId }) => {
		if (action.kind !== "clipboard.write") return {
			verified: false,
			evidence: "Verifier/action kind mismatch."
		};
		const result = await observe(action, runId, operationId);
		if (result.failure || !result.value) return {
			verified: false,
			evidence: result.failure ?? "Native observation failed."
		};
		const expected = await digestObservationValue(action.text);
		return result.value.clipboardDigest === expected && validDigest(result.value.clipboardDigest) ? {
			verified: true,
			evidence: "Clipboard write verified through a fresh native OS observation."
		} : {
			verified: false,
			evidence: "The independently observed clipboard hash did not match."
		};
	}, "Fresh clipboard-content hash from the native OS observer; plaintext is never returned.");
	return registry;
}
function abortError() {
	const error = /* @__PURE__ */ new Error("Cancelled before a concurrency slot became available.");
	error.name = "AbortError";
	return error;
}
/**
* Run many operations with bounded concurrency, collecting every result in
* input order.
*
* Uses a `Limiter`, so at most `maxConcurrent` run at once. A rejection is
* surfaced (the returned promise rejects) rather than hidden — a "parallel
* reads" helper that silently dropped a failed read would report partial data
* as complete.
*/
async function mapWithConcurrency(items, maxConcurrent, fn, options = {}) {
	if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) throw new Error("A concurrency of at least 1 is required.");
	const maxItems = options.maxItems ?? 1e4;
	if (!Number.isInteger(maxItems) || maxItems < 0) throw new Error("The item budget must be a non-negative integer.");
	if (items.length > maxItems) throw new Error(`The batch exceeds its ${maxItems}-item budget.`);
	if (options.signal?.aborted) throw abortError();
	const results = new Array(items.length);
	let cursor = 0;
	let stopped = false;
	const worker = async () => {
		while (!stopped) {
			if (options.signal?.aborted) {
				stopped = true;
				throw abortError();
			}
			const index = cursor++;
			if (index >= items.length) return;
			try {
				results[index] = await fn(items[index], index);
			} catch (error) {
				stopped = true;
				throw error;
			}
		}
	};
	const workerCount = Math.min(maxConcurrent, items.length);
	await Promise.all(Array.from({ length: workerCount }, () => worker()));
	return results;
}
/**
* Lifecycle-safe controller for the persisted automation queue.
*
* Discovering a row is not an execution attempt. A row counts as claimed only
* when the supervisor returns an outcome that can occur after an atomic claim,
* and it counts as successful only when the worker reports verified success.
*/
var EMPTY_RECOVERY = {
	paused: 0,
	expired: 0,
	cancelled: 0,
	failed: 0,
	requeued: 0
};
function safeInteger(value, fallback, maximum) {
	if (!Number.isFinite(value) || !value || value < 1) return fallback;
	return Math.min(Math.floor(value), maximum);
}
function emptyTick(status, reason) {
	return {
		status,
		discovered: 0,
		dispatched: 0,
		claimed: 0,
		succeeded: 0,
		failed: 0,
		cancelled: 0,
		paused: 0,
		awaitingApproval: 0,
		deferred: 0,
		lostClaim: 0,
		notClaimed: 0,
		idle: 0,
		blocked: 0,
		notEligible: 0,
		errors: 0,
		staleRecovery: null,
		results: [],
		reason
	};
}
function claimedOutcome(outcome) {
	return [
		"succeeded",
		"failed",
		"cancelled",
		"paused",
		"awaiting_approval",
		"deferred",
		"lost_claim"
	].includes(outcome.status);
}
function safeErrorDetail(error, fallback) {
	return redactForAudit(error instanceof Error ? error.message : fallback).replace(/\b(token|authorization|api[_-]?key|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");
}
function recordOutcome(tick, outcome) {
	if (claimedOutcome(outcome)) tick.claimed += 1;
	switch (outcome.status) {
		case "succeeded":
			tick.succeeded += 1;
			break;
		case "failed":
			tick.failed += 1;
			break;
		case "cancelled":
			tick.cancelled += 1;
			break;
		case "paused":
			tick.paused += 1;
			break;
		case "awaiting_approval":
			tick.awaitingApproval += 1;
			break;
		case "deferred":
			tick.deferred += 1;
			break;
		case "lost_claim":
			tick.lostClaim += 1;
			break;
		case "not_claimed":
			tick.notClaimed += 1;
			break;
		case "idle":
			tick.idle += 1;
			break;
		case "blocked":
			tick.blocked += 1;
			break;
		case "not_eligible":
			tick.notEligible += 1;
			break;
	}
}
var AutomationWorkerController = class {
	input;
	isOnline;
	now;
	maxBatch;
	concurrency;
	pollIntervalMs;
	staleAfterMs;
	activeRunIds = /* @__PURE__ */ new Set();
	timer = null;
	tickPromise = null;
	started = false;
	state = {
		lifecycle: "stopped",
		inFlight: 0,
		lastTickAt: null,
		lastError: null
	};
	constructor(input) {
		this.input = input;
		this.isOnline = input.isOnline ?? (() => true);
		this.now = input.now ?? (() => /* @__PURE__ */ new Date());
		this.maxBatch = safeInteger(input.maxBatch, 20, 100);
		this.concurrency = safeInteger(input.concurrency, 2, 8);
		this.pollIntervalMs = safeInteger(input.pollIntervalMs, 15e3, 3e5);
		this.staleAfterMs = safeInteger(input.staleAfterMs, 12e4, 864e5);
	}
	getState() {
		return { ...this.state };
	}
	start() {
		if (this.started) return;
		this.started = true;
		this.loop();
	}
	async stop() {
		this.started = false;
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		if (this.tickPromise) await this.tickPromise;
		this.state = {
			...this.state,
			lifecycle: "stopped",
			inFlight: 0
		};
	}
	/**
	* Poll once. Concurrent callers receive the same promise, so a slow poll
	* cannot overlap the next timer or duplicate in-process dispatch.
	*/
	tick() {
		if (this.tickPromise) return this.tickPromise;
		this.tickPromise = this.performTick().finally(() => {
			this.tickPromise = null;
		});
		return this.tickPromise;
	}
	async loop() {
		await this.tick();
		if (!this.started) return;
		this.timer = setTimeout(() => void this.loop(), this.pollIntervalMs);
	}
	async performTick() {
		const tickAt = this.now().toISOString();
		if (!this.isOnline()) {
			const result = emptyTick("offline", "Automation queue polling is paused while offline.");
			this.state = {
				lifecycle: "offline",
				inFlight: 0,
				lastTickAt: tickAt,
				lastError: null
			};
			return result;
		}
		this.state = {
			...this.state,
			lifecycle: "polling",
			lastTickAt: tickAt,
			lastError: null
		};
		try {
			const staleRecovery = await this.input.supervisor.recoverStale(this.staleAfterMs);
			const listed = await this.input.source.listEligibleRunIds({
				limit: this.maxBatch,
				now: tickAt
			});
			const runIds = [...new Set(listed.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim()))].slice(0, this.maxBatch);
			const result = emptyTick("completed");
			result.staleRecovery = {
				...EMPTY_RECOVERY,
				...staleRecovery
			};
			result.discovered = runIds.length;
			await mapWithConcurrency(runIds, this.concurrency, async (runId) => {
				if (this.activeRunIds.has(runId)) return;
				this.activeRunIds.add(runId);
				this.state = {
					...this.state,
					inFlight: this.activeRunIds.size
				};
				result.dispatched += 1;
				try {
					const outcome = await this.input.supervisor.run(runId);
					result.results.push({
						runId,
						outcome
					});
					recordOutcome(result, outcome);
				} catch (error) {
					const detail = safeErrorDetail(error, "Unknown supervisor failure.");
					result.errors += 1;
					result.results.push({
						runId,
						error: detail
					});
				} finally {
					this.activeRunIds.delete(runId);
					this.state = {
						...this.state,
						inFlight: this.activeRunIds.size
					};
				}
			});
			this.state = {
				lifecycle: "idle",
				inFlight: 0,
				lastTickAt: tickAt,
				lastError: result.errors > 0 ? `${result.errors} run dispatch(es) failed.` : null
			};
			return result;
		} catch (error) {
			const detail = safeErrorDetail(error, "Unknown queue polling failure.");
			const result = emptyTick("error", detail);
			result.errors = 1;
			this.state = {
				lifecycle: "error",
				inFlight: 0,
				lastTickAt: tickAt,
				lastError: detail
			};
			return result;
		}
	}
};
function describeAutomationControllerState(state) {
	switch (state.lifecycle) {
		case "stopped": return "Automation queue controller stopped. No rows are being polled or claimed.";
		case "offline": return "Automation queue controller paused while offline. Queued rows remain pending.";
		case "polling": return `Automation queue controller polling; ${state.inFlight} run(s) are currently dispatched.`;
		case "error": return `Automation queue controller error: ${state.lastError ?? "unknown failure"}`;
		case "idle": return state.lastError ? `Automation queue controller idle after an error: ${state.lastError}` : "Automation queue controller idle and waiting for eligible work.";
	}
}
function asClaimRow(data) {
	return Array.isArray(data) ? data[0] ?? null : data;
}
function boundedString(value, maximum, allowEmpty = false) {
	return typeof value === "string" && value.length <= maximum && (allowEmpty || value.trim().length > 0);
}
function isCompanionAction(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const action = value;
	switch (action.kind) {
		case "screen.read":
		case "window.list":
		case "clipboard.read":
		case "selection.read": return true;
		case "window.focus": return boundedString(action.target, 300);
		case "window.arrange": return [
			"left",
			"right",
			"maximize",
			"restore"
		].includes(String(action.layout)) && (action.target === void 0 || boundedString(action.target, 300));
		case "app.open": return boundedString(action.appId, 300);
		case "file.open": return boundedString(action.path, 1e3);
		case "text.type":
		case "selection.replace":
		case "clipboard.write": return boundedString(action.text, 5e3, true);
		default: return false;
	}
}
function isRunStep(value) {
	if (!value || typeof value !== "object") return false;
	const step = value;
	if (!isCompanionAction(step.action)) return false;
	const canonicalRisk = riskOf(step.action);
	if (canonicalRisk === "prohibited") return false;
	const requiresConfirmation = canonicalRisk === "confirm" || canonicalRisk === "high";
	if (step.risk !== canonicalRisk || step.requiresConfirmation !== requiresConfirmation || !boundedString(step.summary, 4e3)) return false;
	if (step.estimatedDurationMs !== void 0 && (!Number.isFinite(step.estimatedDurationMs) || step.estimatedDurationMs < 0 || step.estimatedDurationMs > 864e5)) return false;
	if (step.rollbackAction !== void 0) {
		if (canonicalRisk === "read_only" || !isCompanionAction(step.rollbackAction) || riskOf(step.rollbackAction) === "prohibited") return false;
	}
	if (step.rollbackSummary !== void 0 && !boundedString(step.rollbackSummary, 4e3)) return false;
	return step.rollbackAction !== void 0 || step.rollbackSummary === void 0;
}
function parseClaim(data) {
	const row = asClaimRow(data);
	if (!row) return null;
	if (typeof row.id !== "string" || !row.id.trim() || row.id.length > 300 || typeof row.claim_token !== "string" || !row.claim_token.trim() || row.claim_token.length > 300 || !Array.isArray(row.execution_steps) || row.execution_steps.length === 0 || row.execution_steps.length > 50 || !row.execution_steps.every(isRunStep) || !Number.isInteger(row.attempt) || !Number.isInteger(row.max_attempts) || !Number.isInteger(row.next_step_index) || row.attempt < 1 || row.max_attempts < 1 || row.max_attempts > 10 || row.attempt > row.max_attempts || typeof row.confirmed !== "boolean" || row.deadline_at !== null && (typeof row.deadline_at !== "string" || !Number.isFinite(Date.parse(row.deadline_at))) || row.approval_expires_at !== null && (typeof row.approval_expires_at !== "string" || !Number.isFinite(Date.parse(row.approval_expires_at))) || row.next_step_index < 0 || row.next_step_index > row.execution_steps.length) throw new Error("Supabase returned an invalid automation worker claim.");
	return {
		id: row.id,
		claimToken: row.claim_token,
		steps: row.execution_steps,
		attempt: row.attempt,
		maxAttempts: row.max_attempts,
		nextStepIndex: row.next_step_index,
		confirmed: row.confirmed,
		deadlineAt: row.deadline_at,
		approvalExpiresAt: row.approval_expires_at
	};
}
function parseSteps(value) {
	if (!Array.isArray(value) || !value.every(isRunStep)) throw new Error("Supabase returned invalid automation execution steps.");
	return value;
}
function unwrapBoolean(result, operation) {
	if (result.error) throw new Error(`${operation}: ${result.error.message}`);
	return result.data === true;
}
var SupabaseAutomationWorkerStore = class {
	client;
	cancellationPollMs;
	constructor(client, cancellationPollMs = 750) {
		this.client = client;
		this.cancellationPollMs = cancellationPollMs;
	}
	async claim(input) {
		const result = await this.client.rpc("ocade_claim_automation_run", {
			p_run_id: input.runId,
			p_worker_id: input.workerId
		});
		if (result.error) throw new Error(`Could not claim automation run: ${result.error.message}`);
		return parseClaim(result.data);
	}
	watchCancellation(claim) {
		const controller = new AbortController();
		let reason = null;
		let disposed = false;
		const poll = async () => {
			try {
				const state = await this.client.cancellationState(claim.id, claim.claimToken);
				if (disposed || state === "active") return;
				reason = state === "requested" ? "requested" : state === "paused" ? "paused" : "unavailable";
				controller.abort();
			} catch {
				if (disposed) return;
				reason = "unavailable";
				controller.abort();
			}
		};
		poll();
		const timer = setInterval(() => void poll(), this.cancellationPollMs);
		return {
			signal: controller.signal,
			reason: () => reason,
			dispose: () => {
				disposed = true;
				clearInterval(timer);
			}
		};
	}
	async heartbeat(claim, _now) {
		return unwrapBoolean(await this.client.rpc("ocade_heartbeat_automation_run", {
			p_run_id: claim.id,
			p_claim_token: claim.claimToken
		}), "Could not heartbeat automation run");
	}
	async appendReceipt(claim, receipt) {
		return unwrapBoolean(await this.client.rpc("ocade_append_automation_receipt", {
			p_run_id: claim.id,
			p_claim_token: claim.claimToken,
			p_step_index: receipt.stepIndex,
			p_phase: receipt.phase,
			p_operation_id: receipt.operationId,
			p_action_kind: receipt.actionKind,
			p_status: receipt.status,
			p_execution_ok: receipt.executionOk,
			p_verified: receipt.verified,
			p_detail: receipt.detail,
			p_started_at: receipt.startedAt,
			p_finished_at: receipt.finishedAt
		}), "Could not append automation receipt");
	}
	async complete(claim, completion) {
		return unwrapBoolean(await this.client.rpc("ocade_complete_automation_run", {
			p_run_id: claim.id,
			p_claim_token: claim.claimToken,
			p_status: completion.status,
			p_error: completion.error,
			p_finished_at: completion.finishedAt
		}), "Could not finalize automation run");
	}
	async requeue(claim, retry) {
		return unwrapBoolean(await this.client.rpc("ocade_requeue_automation_run", {
			p_run_id: claim.id,
			p_claim_token: claim.claimToken,
			p_attempt: retry.attempt,
			p_next_attempt_at: retry.nextAttemptAt,
			p_error: retry.error
		}), "Could not requeue automation run");
	}
	async suspend(claim, pause) {
		return unwrapBoolean(await this.client.rpc("ocade_suspend_automation_run", {
			p_run_id: claim.id,
			p_claim_token: claim.claimToken,
			p_reason: pause.reason,
			p_paused_at: pause.pausedAt
		}), "Could not pause automation run");
	}
	async awaitApproval(claim, wait) {
		return unwrapBoolean(await this.client.rpc("ocade_expire_automation_approval", {
			p_run_id: claim.id,
			p_claim_token: claim.claimToken,
			p_reason: wait.reason,
			p_requested_at: wait.requestedAt
		}), "Could not renew automation approval");
	}
};
/**
* Narrow bridge around the generated Supabase client. Remove the casts after
* the READY-TO-APPLY migration is applied and database types are regenerated.
*/
function createSupabaseAutomationWorkerClient(supabase) {
	const client = supabase;
	const from = supabase.from.bind(supabase);
	return {
		rpc: (name, args) => client.rpc(name, args),
		async cancellationState(runId, claimToken) {
			const { data, error } = await from("ocade_automation_runs").select("status, claim_token, lease_expires_at, cancel_requested_at, pause_requested_at").eq("id", runId).maybeSingle();
			if (error) throw new Error(error.message);
			if (!data || data.status !== "running" || data.claim_token !== claimToken) return "lost_claim";
			if (!data.lease_expires_at || Date.parse(data.lease_expires_at) <= Date.now()) return "lost_claim";
			if (data.pause_requested_at) return "paused";
			return data.cancel_requested_at ? "requested" : "active";
		}
	};
}
function createSupabaseAutomationSupervisorPersistence(supabase) {
	const client = supabase;
	const from = supabase.from.bind(supabase);
	return {
		async inspectEligibleRun(runId) {
			const { data, error } = await from("ocade_automation_runs").select("id, status, execution_steps, next_attempt_at, deadline_at, cancel_requested_at").eq("id", runId).maybeSingle();
			if (error) throw new Error(error.message);
			if (!data || data.status !== "pending" || data.cancel_requested_at || data.deadline_at && Date.parse(data.deadline_at) <= Date.now() || data.next_attempt_at && Date.parse(data.next_attempt_at) > Date.now()) return null;
			return {
				id: data.id,
				steps: parseSteps(data.execution_steps)
			};
		},
		async recoverStale(staleBefore) {
			const { data, error } = await client.rpc("ocade_recover_stale_automation_runs", { p_stale_before: staleBefore });
			if (error) throw new Error(error.message);
			return {
				paused: Number(data?.paused ?? 0),
				expired: Number(data?.expired ?? 0),
				cancelled: Number(data?.cancelled ?? 0),
				failed: Number(data?.failed ?? 0),
				requeued: Number(data?.requeued ?? 0)
			};
		}
	};
}
function createSupabaseAutomationQueueSource(supabase) {
	const from = supabase.from.bind(supabase);
	return { async listEligibleRunIds({ limit, now }) {
		const parsedNow = new Date(now);
		if (!Number.isFinite(parsedNow.getTime()) || parsedNow.toISOString() !== now) throw new Error("Automation queue polling requires a valid timestamp.");
		const safeLimit = Math.max(1, Math.min(Number.isFinite(limit) ? Math.floor(limit) : 20, 100));
		const { data, error } = await from("ocade_automation_runs").select("id").eq("status", "pending").is("cancel_requested_at", null).or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`).or(`deadline_at.is.null,deadline_at.gt.${now}`).order("created_at", { ascending: true }).limit(safeLimit);
		if (error) throw new Error(error.message);
		if (!Array.isArray(data)) throw new Error("Supabase returned an invalid automation queue response.");
		return data.map((row) => row?.id).filter((id) => typeof id === "string");
	} };
}
/**
* Authenticated desktop host for the automation queue.
*
* This is the only composition root that may start the queue controller. It
* refuses web runtimes, signed-out sessions, unavailable companions, and
* verifier registries without independent-observation provenance.
*/
var WEB_RUNTIME_REASON = "Automation worker host stopped: queue execution runs only inside the signed desktop app.";
var SIGNED_OUT_REASON = "Automation worker host stopped: sign in before this device can poll or claim your queue.";
var VERIFIER_REASON = "Automation worker host stopped: no observation-backed action verifier is installed.";
function desktopRuntime() {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
function secureWorkerId() {
	if (!globalThis.crypto?.randomUUID) throw new Error("Secure ephemeral worker identity is unavailable.");
	return `desktop-${globalThis.crypto.randomUUID()}`;
}
function safeHostError(error, fallback) {
	return redactForAudit(error instanceof Error ? error.message : fallback).replace(/\b(token|authorization|api[_-]?key|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");
}
var DesktopAutomationWorkerHost = class {
	input;
	isDesktopRuntime;
	workerIdFactory;
	controller = null;
	subscription = null;
	startPromise = null;
	generation = 0;
	state = {
		status: "stopped",
		reason: WEB_RUNTIME_REASON
	};
	constructor(input) {
		this.input = input;
		this.isDesktopRuntime = input.isDesktopRuntime ?? desktopRuntime;
		this.workerIdFactory = input.workerIdFactory ?? secureWorkerId;
	}
	getState() {
		return this.state.status === "running" ? {
			...this.state,
			controller: { ...this.state.controller }
		} : { ...this.state };
	}
	start() {
		if (this.state.status === "running") return Promise.resolve(this.getState());
		if (this.startPromise) return this.startPromise;
		const generation = ++this.generation;
		this.startPromise = this.startOnce(generation).finally(() => {
			this.startPromise = null;
		});
		return this.startPromise;
	}
	async stop(reason = "Automation worker host stopped. No queue rows will be polled or claimed.") {
		++this.generation;
		this.subscription?.unsubscribe();
		this.subscription = null;
		const controller = this.controller;
		this.controller = null;
		if (controller) await controller.stop();
		this.setState({
			status: "stopped",
			reason
		});
	}
	async startOnce(generation) {
		if (!this.isDesktopRuntime()) return this.setState({
			status: "stopped",
			reason: WEB_RUNTIME_REASON
		});
		this.setState({
			status: "starting",
			reason: "Checking desktop runtime, authentication, companion, and verifier readiness."
		});
		try {
			const auth = await this.input.supabase.auth.getUser();
			if (generation !== this.generation) return this.getState();
			if (auth.error) return this.setState({
				status: "error",
				reason: `Automation worker authentication failed: ${safeHostError(auth.error.message, "unknown failure")}`
			});
			if (!auth.data.user?.id) return this.setState({
				status: "stopped",
				reason: SIGNED_OUT_REASON
			});
			const companionStatus = await this.input.companion.status();
			if (generation !== this.generation) return this.getState();
			if (!companionStatus.available) return this.setState({
				status: "stopped",
				reason: `Automation worker host stopped: ${companionStatus.reason ?? "The OCADE Native Companion isn't connected. Computer control requires the signed companion app."}`
			});
			if (this.input.verifiers.observationBackedKinds().length === 0) return this.setState({
				status: "stopped",
				reason: VERIFIER_REASON
			});
			const workerId = this.workerIdFactory();
			if (!workerId.trim()) throw new Error("Secure ephemeral worker identity is empty.");
			const controller = this.input.createController ? this.input.createController(workerId) : this.composeController(workerId);
			const authListener = this.input.supabase.auth.onAuthStateChange((event) => {
				if (event === "SIGNED_OUT") this.stop("Automation worker host stopped after sign-out. Queued rows remain pending.");
			});
			if (generation !== this.generation) {
				authListener.data.subscription.unsubscribe();
				await controller.stop();
				return this.getState();
			}
			this.controller = controller;
			this.subscription = authListener.data.subscription;
			controller.start();
			return this.setState({
				status: "running",
				reason: "Automation worker host is polling. A run is successful only after atomic claim, execution, persistence, and independent observation.",
				controller: controller.getState()
			});
		} catch (error) {
			this.subscription?.unsubscribe();
			this.subscription = null;
			const controller = this.controller;
			this.controller = null;
			if (controller) await controller.stop();
			return this.setState({
				status: "error",
				reason: `Automation worker host could not start: ${safeHostError(error, "unknown failure")}`
			});
		}
	}
	composeController(workerId) {
		const supervisor = new AutomationWorkerSupervisor({
			store: new SupabaseAutomationWorkerStore(createSupabaseAutomationWorkerClient(this.input.supabase)),
			persistence: createSupabaseAutomationSupervisorPersistence(this.input.supabase),
			companion: this.input.companion,
			verifiers: this.input.verifiers,
			workerId
		});
		return new AutomationWorkerController({
			source: createSupabaseAutomationQueueSource(this.input.supabase),
			supervisor,
			...this.input.controllerOptions
		});
	}
	setState(state) {
		this.state = state;
		try {
			this.input.onStateChange?.(this.getState());
		} catch {}
		return this.getState();
	}
};
function describeAutomationWorkerHost(state) {
	return state.status === "running" ? `${state.reason} ${describeAutomationControllerState(state.controller)}` : state.reason;
}
/**
* Keeps one desktop worker host bound to the latest validated in-memory
* companion adapter. Adapter changes are serialized so an old secure session
* is stopped before its replacement can poll.
*/
var AutomationWorkerCompanionSession = class {
	input;
	started = false;
	generation = 0;
	desiredAdapter = null;
	host = null;
	unsubscribe = null;
	transition = Promise.resolve();
	bootstrapAttempt = null;
	constructor(input) {
		this.input = input;
	}
	safeReason(error, fallback) {
		return redactForAudit(error instanceof Error ? error.message : fallback).replace(/\b(token|authorization|api[_-]?key|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");
	}
	start() {
		if (!this.started) {
			this.started = true;
			this.generation += 1;
			this.unsubscribe = this.input.subscribe((adapter) => {
				this.bind(adapter);
			});
		}
		return this.retryBootstrap();
	}
	retryBootstrap() {
		if (!this.started) return this.start();
		if (this.bootstrapAttempt) return this.bootstrapAttempt;
		const generation = this.generation;
		const tracked = (async () => {
			try {
				const result = await this.input.bootstrap();
				if (!this.started || generation !== this.generation) return;
				if (!result.installed) {
					this.input.onBootstrapUnavailable(result.reason);
					return;
				}
				await this.bind(this.input.getCompanion());
			} catch (error) {
				if (this.started && generation === this.generation) this.input.onError(this.safeReason(error, "The secure companion session could not be opened."));
			}
		})().finally(() => {
			if (this.bootstrapAttempt === tracked) this.bootstrapAttempt = null;
		});
		this.bootstrapAttempt = tracked;
		return this.bootstrapAttempt;
	}
	bind(adapter) {
		if (!this.started || this.desiredAdapter === adapter) return this.transition;
		this.desiredAdapter = adapter;
		this.transition = this.transition.then(async () => {
			const previous = this.host;
			this.host = null;
			if (previous) await previous.stop("Automation worker stopped because the companion session changed.");
			if (!this.started || this.desiredAdapter !== adapter) return;
			const next = this.input.createHost(adapter);
			this.host = next;
			await next.start();
		}).catch((error) => {
			if (this.started) this.input.onError(this.safeReason(error, "The automation worker could not follow the companion session."));
		});
		return this.transition;
	}
	async stop() {
		if (!this.started && !this.host) return;
		this.started = false;
		this.generation += 1;
		this.bootstrapAttempt = null;
		this.desiredAdapter = null;
		this.unsubscribe?.();
		this.unsubscribe = null;
		await this.transition;
		const host = this.host;
		this.host = null;
		if (host) await host.stop("Automation worker host stopped because the Automations surface closed.");
	}
};
var RISK_LABEL = {
	read_only: "Read only",
	low: "Low risk",
	confirm: "Needs confirmation",
	high: "High risk",
	prohibited: "Prohibited"
};
var ACTION_LABEL = {
	"screen.read": "Read the visible screen",
	"window.list": "List open windows",
	"accessibility.read": "Read the focused accessibility tree",
	"window.focus": "Focus a window",
	"window.arrange": "Arrange a window",
	"app.open": "Open an application",
	"file.open": "Open a file",
	"text.type": "Type approved text",
	"clipboard.read": "Read the clipboard",
	"clipboard.write": "Write to the clipboard",
	"selection.read": "Read the current selection",
	"selection.replace": "Replace the current selection"
};
var ACTION_KINDS = Object.keys(ACTION_LABEL);
function actionNeedsValue(kind) {
	return ![
		"screen.read",
		"window.list",
		"accessibility.read",
		"clipboard.read",
		"selection.read",
		"window.arrange"
	].includes(kind);
}
function draftAction(kind, value, layout) {
	const trimmed = value.trim();
	switch (kind) {
		case "screen.read":
		case "window.list":
		case "accessibility.read":
		case "clipboard.read":
		case "selection.read": return { kind };
		case "window.focus": return trimmed ? {
			kind,
			target: trimmed
		} : null;
		case "window.arrange": return {
			kind,
			layout
		};
		case "app.open": return trimmed ? {
			kind,
			appId: trimmed
		} : null;
		case "file.open": return trimmed ? {
			kind,
			path: trimmed
		} : null;
		case "text.type":
		case "clipboard.write":
		case "selection.replace": return trimmed ? {
			kind,
			text: value
		} : null;
	}
}
function describeTrigger(t) {
	switch (t.kind) {
		case "manual": return "Runs only when you start it";
		case "interval": return `Every ${t.everyMinutes} minute${t.everyMinutes === 1 ? "" : "s"}`;
		case "daily": return `Daily at ${String(t.atHourUtc).padStart(2, "0")}:${String(t.atMinuteUtc ?? 0).padStart(2, "0")} UTC`;
		case "condition": return `When: ${t.expression}`;
		default: return "Unknown trigger";
	}
}
function AutomationsPage() {
	const [rows, setRows] = (0, import_react.useState)(null);
	const [unavailable, setUnavailable] = (0, import_react.useState)(null);
	const [workerStatus, setWorkerStatus] = (0, import_react.useState)(null);
	const [runs, setRuns] = (0, import_react.useState)(null);
	const online = useOnline();
	const [selectedId, setSelectedId] = (0, import_react.useState)(null);
	/** Why the scheduler passed over each automation, keyed by id. */
	const [skipReasons, setSkipReasons] = (0, import_react.useState)({});
	const [newName, setNewName] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [preview, setPreview] = (0, import_react.useState)(null);
	const [confirmDelete, setConfirmDelete] = (0, import_react.useState)(null);
	const [editName, setEditName] = (0, import_react.useState)("");
	const [editEnabled, setEditEnabled] = (0, import_react.useState)(true);
	const [editTrigger, setEditTrigger] = (0, import_react.useState)({ kind: "manual" });
	const [editActions, setEditActions] = (0, import_react.useState)([]);
	const [editRequiresApproval, setEditRequiresApproval] = (0, import_react.useState)(true);
	const [editMaxAttempts, setEditMaxAttempts] = (0, import_react.useState)(3);
	const [newActionKind, setNewActionKind] = (0, import_react.useState)("screen.read");
	const [newActionValue, setNewActionValue] = (0, import_react.useState)("");
	const [newActionLayout, setNewActionLayout] = (0, import_react.useState)("left");
	const refresh = (0, import_react.useCallback)(async () => {
		setUnavailable(null);
		try {
			const list = await listAutomations();
			setRows(list);
			setSelectedId((cur) => cur && list.some((r) => r.id === cur) ? cur : list[0]?.id ?? null);
			setRuns(await listAutomationRuns({ data: {} }));
		} catch (e) {
			setRows(null);
			setRuns(null);
			setUnavailable(e instanceof Error ? e.message : "Automations aren't available until the database is set up.");
		}
	}, []);
	(0, import_react.useEffect)(() => {
		refresh();
	}, [refresh]);
	(0, import_react.useEffect)(() => {
		let active = true;
		const computerRefusal = computerUseChannelDecision("thisComputer") ?? computerUseChannelDecision("backgroundTasks");
		if (computerRefusal) {
			setWorkerStatus(computerRefusal);
			return;
		}
		const session = new AutomationWorkerCompanionSession({
			bootstrap: () => bootstrapCompanion(),
			getCompanion,
			subscribe: subscribeCompanionAdapter,
			createHost: (companion) => {
				return new DesktopAutomationWorkerHost({
					supabase,
					companion,
					verifiers: isNativeObservationAdapter(companion) ? createNativeObservationVerifierRegistry(companion) : new AutomationVerifierRegistry(),
					controllerOptions: { isOnline: () => navigator.onLine },
					onStateChange: (state) => {
						if (active) setWorkerStatus(describeAutomationWorkerHost(state));
					}
				});
			},
			onBootstrapUnavailable: (reason) => {
				if (active) setWorkerStatus(reason);
			},
			onError: (reason) => {
				if (active) setWorkerStatus(reason);
			}
		});
		session.start();
		return () => {
			active = false;
			session.stop();
		};
	}, []);
	/**
	* Scheduler tick. It decides which automations may be queued and records
	* those run requests. Actual action execution belongs to a separate worker;
	* creating a pending row here must never be presented as completed work.
	*/
	(0, import_react.useEffect)(() => {
		if (!rows || rows.length === 0) return;
		if (computerUseChannelDecision("backgroundTasks")) return;
		if (!online) return;
		let cancelled = false;
		async function tick() {
			const now = /* @__PURE__ */ new Date();
			const decision = selectDueAutomations((rows ?? []).map((a) => ({
				id: a.id,
				enabled: a.enabled,
				paused: a.paused,
				maxAttempts: a.max_attempts,
				nextRunAt: a.next_run_at,
				lastRunAt: a.last_run_at
			})), (runs ?? []).map((r) => ({
				id: r.id,
				automationId: r.automation_id,
				status: r.status,
				attempt: r.attempt,
				createdAt: r.created_at,
				nextAttemptAt: null
			})), now);
			if (!cancelled) setSkipReasons(Object.fromEntries(decision.skipped.map((s) => [s.automationId, describeSkip(s.reason)])));
			if (decision.due.length === 0 || cancelled) return;
			for (const id of decision.due) {
				if (cancelled) return;
				try {
					await startAutomationRun({ data: { id } });
				} catch {}
			}
			if (!cancelled) await refresh();
		}
		tick();
		const timer = setInterval(() => void tick(), 6e4);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [
		rows,
		runs,
		refresh,
		online
	]);
	const selected = rows?.find((r) => r.id === selectedId) ?? null;
	(0, import_react.useEffect)(() => {
		if (!selected) return;
		setEditName(selected.name);
		setEditEnabled(selected.enabled);
		setEditTrigger(selected.trigger);
		setEditActions(selected.actions);
		setEditRequiresApproval(selected.requires_approval);
		setEditMaxAttempts(selected.max_attempts);
		setNewActionKind("screen.read");
		setNewActionValue("");
		setNewActionLayout("left");
	}, [selected]);
	const selectedRuns = runs?.filter((r) => !selectedId || r.automation_id === selectedId) ?? [];
	const activeRuns = (runs ?? []).filter((r) => IN_FLIGHT_STATUSES.includes(r.status));
	async function handleCreate() {
		const name = newName.trim();
		if (!name) return;
		setBusy(true);
		try {
			const a = await createAutomation({ data: { name } });
			toast.success(`Automation “${a.name}” created. It runs only when you start it until you add a schedule.`);
			setNewName("");
			await refresh();
			setSelectedId(a.id);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not create the automation.");
		} finally {
			setBusy(false);
		}
	}
	async function togglePause(a) {
		try {
			await updateAutomation({ data: {
				id: a.id,
				paused: !a.paused
			} });
			toast.success(a.paused ? "Automation resumed." : "Automation paused.");
			await refresh();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not update the automation.");
		}
	}
	function addDraftAction() {
		const action = draftAction(newActionKind, newActionValue, newActionLayout);
		if (!action) {
			toast.error("Enter the target or content for this step.");
			return;
		}
		if (editActions.length >= 50) {
			toast.error("An automation can contain at most 50 steps.");
			return;
		}
		setEditActions((current) => [...current, action]);
		setNewActionValue("");
	}
	async function saveDefinition(a) {
		const name = editName.trim();
		if (!name) {
			toast.error("Give this automation a name.");
			return;
		}
		setBusy(true);
		try {
			await updateAutomation({ data: {
				id: a.id,
				name,
				enabled: editEnabled,
				trigger: editTrigger,
				actions: editActions,
				requiresApproval: editRequiresApproval,
				maxAttempts: editMaxAttempts
			} });
			toast.success("Automation definition saved. Preview it before the next real run.");
			await refresh();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not save the automation.");
		} finally {
			setBusy(false);
		}
	}
	async function showPreview(a) {
		try {
			const plan = await previewAutomation({ data: { id: a.id } });
			setPreview({
				name: a.name,
				plan
			});
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not build the preview.");
		}
	}
	async function run(a, dryRun) {
		if (!dryRun) {
			const channelRefusal = computerUseChannelDecision("thisComputer");
			if (channelRefusal) {
				toast.error(channelRefusal);
				return;
			}
		}
		setBusy(true);
		try {
			const notice = describeRunEnqueue(await startAutomationRun({ data: {
				id: a.id,
				dryRun
			} }));
			toast[notice.tone](notice.message);
			await refresh();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not start the run.");
		} finally {
			setBusy(false);
		}
	}
	async function decide(runId, decision) {
		try {
			await decideAutomationRun({ data: {
				runId,
				decision
			} });
			toast.success(decision === "approved" ? "Run approved and queued — no action has executed yet." : "Run denied — nothing was executed.");
			await refresh();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not record the decision.");
		}
	}
	async function cancel(runId) {
		try {
			const result = await cancelAutomationRun({ data: { runId } });
			toast.success(result.status === "cancelled" ? "Run cancelled before execution." : "Cancellation requested — waiting for the worker to confirm it stopped.");
			await refresh();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not cancel the run.");
		}
	}
	async function emergencyStop() {
		try {
			const result = await cancelAllRuns();
			toast.success(`Emergency stop recorded: ${result.cancelled} queued run(s) cancelled; ${result.cancellationRequested} running worker(s) told to stop.`);
			await refresh();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not stop the runs.");
		}
	}
	async function reallyDelete(a) {
		setBusy(true);
		try {
			await deleteAutomation({ data: { id: a.id } });
			toast.success("Automation deleted.");
			setConfirmDelete(null);
			await refresh();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not delete the automation.");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "OCADE",
			title: "Automations",
			description: "Repeatable OCADE tasks. Every run is previewed and risk-checked first, and anything that touches protected information is refused outright.",
			actions: activeRuns.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "ghost",
				size: "sm",
				onClick: () => void emergencyStop(),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OctagonX, { className: "mr-1.5 h-4 w-4" }),
					" Stop all (",
					activeRuns.length,
					")"
				]
			}) : void 0
		}),
		!online && !unavailable ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mb-4 flex items-start gap-2 p-3 text-xs",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WifiOff, {
				className: "mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]",
				"aria-hidden": true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-muted-foreground",
				children: "You're offline, so scheduled runs are paused rather than failed — nothing is retried against a connection that isn't there. They resume as soon as you reconnect."
			})]
		}) : null,
		workerStatus ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mb-4 flex items-start gap-2 p-3 text-xs",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, {
				className: "mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]",
				"aria-hidden": true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-muted-foreground",
				children: workerStatus
			})]
		}) : null,
		unavailable ? (() => {
			const state = classifyUnavailable(unavailable, {
				migrationTitle: "Automations need the database migration",
				migrationNote: "The migration, RLS policies, rollback and verification SQL are prepared and ready to apply. Applying them enables persistence; real execution still requires a connected, verified worker.",
				loadTitle: "Automations couldn't be loaded"
			});
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupRequiredState, {
				title: state.title,
				description: state.description,
				detail: state.detail,
				status: state.migrationMissing ? "setup_required" : "failed",
				action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => void refresh(),
					className: "rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent/30",
					children: "Try again"
				})
			});
		})() : rows === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "flex items-center gap-2 p-6 text-sm text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
				className: "h-4 w-4 animate-spin",
				"aria-hidden": true
			}), " Loading automations…"]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
					className: "p-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: newName,
							onChange: (e) => setNewName(e.target.value),
							onKeyDown: (e) => e.key === "Enter" && void handleCreate(),
							placeholder: "New automation name",
							"aria-label": "New automation name",
							className: "h-9 text-sm"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							onClick: () => void handleCreate(),
							disabled: busy || !newName.trim(),
							size: "sm",
							className: "h-9 shrink-0",
							children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-4 w-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "sr-only",
								children: "Create automation"
							})]
						})]
					})
				}), rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Workflow, {
						className: "h-6 w-6",
						"aria-hidden": true
					}),
					title: "No automations yet",
					description: "Create one to repeat an OCADE task on demand or on a schedule."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					"aria-label": "Automations",
					className: "flex flex-col gap-1",
					children: rows.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setSelectedId(a.id),
						"aria-current": a.id === selectedId ? "true" : void 0,
						className: cn("flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors", a.id === selectedId ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Workflow, {
								className: "h-4 w-4 shrink-0",
								"aria-hidden": true
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block truncate",
									children: a.name
								}), skipReasons[a.id] ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block truncate text-[10px] opacity-70",
									children: skipReasons[a.id]
								}) : null]
							}),
							a.paused ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-auto text-[9px] uppercase",
								children: "Paused"
							}) : null
						]
					}, a.id))
				})]
			}), selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
					className: "flex flex-col gap-3 p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "truncate text-sm font-semibold",
									children: selected.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted-foreground",
									children: describeTrigger(selected.trigger)
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "ml-auto flex flex-wrap gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										variant: "ghost",
										size: "sm",
										onClick: () => void showPreview(selected),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "mr-1.5 h-4 w-4" }), " Preview"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "ghost",
										size: "sm",
										onClick: () => void run(selected, true),
										disabled: busy,
										children: "Dry run"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										size: "sm",
										onClick: () => void run(selected, false),
										disabled: busy || selected.paused,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "mr-1.5 h-4 w-4" }), " Run"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										variant: "ghost",
										size: "sm",
										onClick: () => void togglePause(selected),
										children: [selected.paused ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CirclePlay, { className: "h-4 w-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "h-4 w-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "sr-only",
											children: selected.paused ? "Resume" : "Pause"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										variant: "ghost",
										size: "sm",
										onClick: () => setConfirmDelete(selected),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "sr-only",
											children: "Delete"
										})]
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: selected.actions.length === 0 ? "No steps yet. This automation will do nothing until steps are added." : `${selected.actions.length} step${selected.actions.length === 1 ? "" : "s"} · ${selected.requires_approval ? "Requires approval" : "Runs without approval"}`
						}),
						selected.actions.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: "Steps execute through the Native Companion. Until it is connected and verified, runs are recorded and previewed but no computer action is performed."
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
							className: "rounded-md border border-border/60 p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
								className: "cursor-pointer text-xs font-medium",
								children: "Edit definition and steps"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 space-y-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid gap-3 sm:grid-cols-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "text-xs font-medium",
											children: ["Name", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												value: editName,
												onChange: (event) => setEditName(event.target.value),
												className: "mt-1 h-8 text-xs",
												maxLength: 200
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "text-xs font-medium",
											children: ["Schedule", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												value: editTrigger.kind,
												onChange: (event) => {
													const kind = event.target.value;
													if (kind === "manual") setEditTrigger({ kind });
													else if (kind === "interval") setEditTrigger({
														kind,
														everyMinutes: 60
													});
													else if (kind === "daily") setEditTrigger({
														kind,
														atHourUtc: 9,
														atMinuteUtc: 0
													});
												},
												className: "mt-1 block h-8 w-full rounded-md border border-border/60 bg-transparent px-2 text-xs",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "manual",
														children: "Manual only"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "interval",
														children: "Recurring interval"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "daily",
														children: "Daily UTC"
													}),
													editTrigger.kind === "condition" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "condition",
														children: "Condition (saved; evaluator unavailable)"
													}) : null
												]
											})]
										})]
									}),
									editTrigger.kind === "interval" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "block text-xs font-medium",
										children: ["Every minutes", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											type: "number",
											min: 1,
											max: 43200,
											value: editTrigger.everyMinutes,
											onChange: (event) => setEditTrigger({
												kind: "interval",
												everyMinutes: Math.max(1, Math.min(43200, Number(event.target.value) || 1))
											}),
											className: "mt-1 h-8 text-xs"
										})]
									}) : editTrigger.kind === "daily" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid gap-3 sm:grid-cols-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "text-xs font-medium",
											children: ["Hour UTC", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												type: "number",
												min: 0,
												max: 23,
												value: editTrigger.atHourUtc,
												onChange: (event) => setEditTrigger({
													...editTrigger,
													atHourUtc: Math.max(0, Math.min(23, Number(event.target.value) || 0))
												}),
												className: "mt-1 h-8 text-xs"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "text-xs font-medium",
											children: ["Minute UTC", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												type: "number",
												min: 0,
												max: 59,
												value: editTrigger.atMinuteUtc ?? 0,
												onChange: (event) => setEditTrigger({
													...editTrigger,
													atMinuteUtc: Math.max(0, Math.min(59, Number(event.target.value) || 0))
												}),
												className: "mt-1 h-8 text-xs"
											})]
										})]
									}) : editTrigger.kind === "condition" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-[color:var(--state-warning)]",
										children: "Conditional evaluation is not connected in this build. Switch to a supported schedule before expecting automatic runs."
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap gap-4 text-xs",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "checkbox",
													checked: editEnabled,
													onChange: (event) => setEditEnabled(event.target.checked)
												}), "Enabled"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "checkbox",
													checked: editRequiresApproval,
													onChange: (event) => setEditRequiresApproval(event.target.checked)
												}), "Always require approval"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "flex items-center gap-2",
												children: ["Attempts", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
													type: "number",
													min: 1,
													max: 10,
													value: editMaxAttempts,
													onChange: (event) => setEditMaxAttempts(Math.max(1, Math.min(10, Number(event.target.value) || 1))),
													className: "h-7 w-16 text-xs"
												})]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mb-2 text-xs font-medium",
										children: "Steps"
									}), editActions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted-foreground",
										children: "Add at least one step. Empty real runs are blocked rather than left permanently queued."
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
										className: "space-y-1.5",
										children: editActions.map((action, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "flex items-center gap-2 rounded-md bg-secondary/40 px-2 py-1.5 text-xs",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-muted-foreground",
													children: [index + 1, "."]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "flex-1",
													children: ACTION_LABEL[action.kind]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
													type: "button",
													size: "sm",
													variant: "ghost",
													className: "h-7",
													onClick: () => setEditActions((current) => current.filter((_, actionIndex) => actionIndex !== index)),
													children: "Remove"
												})
											]
										}, `${action.kind}-${index}`))
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
												value: newActionKind,
												onChange: (event) => {
													setNewActionKind(event.target.value);
													setNewActionValue("");
												},
												className: "h-8 rounded-md border border-border/60 bg-transparent px-2 text-xs",
												"aria-label": "New step type",
												children: ACTION_KINDS.map((kind) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: kind,
													children: ACTION_LABEL[kind]
												}, kind))
											}),
											newActionKind === "window.arrange" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												value: newActionLayout,
												onChange: (event) => setNewActionLayout(event.target.value),
												className: "h-8 rounded-md border border-border/60 bg-transparent px-2 text-xs",
												"aria-label": "Window layout",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "left",
														children: "Left"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "right",
														children: "Right"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "maximize",
														children: "Maximize"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "restore",
														children: "Restore"
													})
												]
											}) : actionNeedsValue(newActionKind) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												value: newActionValue,
												onChange: (event) => setNewActionValue(event.target.value),
												placeholder: "Target or approved content",
												className: "h-8 text-xs",
												maxLength: 5e3
											}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "self-center text-xs text-muted-foreground",
												children: "No target needed"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												type: "button",
												size: "sm",
												variant: "ghost",
												className: "h-8",
												onClick: addDraftAction,
												children: "Add step"
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex justify-end",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											size: "sm",
											onClick: () => void saveDefinition(selected),
											disabled: busy || !editName.trim(),
											children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-1.5 h-4 w-4 animate-spin" }) : null, "Save definition"]
										})
									})
								]
							})]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
					className: "p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mb-2 text-sm font-semibold",
						children: "Run history"
					}), selectedRuns.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: "No runs yet."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "flex flex-col gap-1.5",
						children: selectedRuns.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-sidebar-accent/40",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: cn("rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide", r.status === "succeeded" && "bg-[color:var(--state-success)]/15 text-[color:var(--state-success)]", r.status === "failed" && "bg-destructive/15 text-destructive", r.status === "blocked" && "bg-destructive/15 text-destructive", r.status === "awaiting_approval" && "bg-[color:var(--state-warning)]/15 text-[color:var(--state-warning)]", ![
										"succeeded",
										"failed",
										"blocked",
										"awaiting_approval"
									].includes(r.status) && "bg-secondary text-muted-foreground"),
									children: r.cancel_requested_at ? "cancellation requested" : r.status.replace("_", " ")
								}),
								r.dry_run ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] uppercase text-muted-foreground",
									children: "dry run"
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted-foreground",
									children: new Date(r.created_at).toLocaleString()
								}),
								r.blocked_reason ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-destructive",
									children: r.blocked_reason
								}) : null,
								r.status === "failed" ? (() => {
									const retry = retryReadyAt({
										attempt: r.attempt,
										createdAt: r.created_at
									}, selected?.max_attempts ?? 3);
									return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs text-muted-foreground",
										children: retry.retry && retry.readyAt ? `Retrying after ${retry.readyAt.toLocaleTimeString()}` : retry.reason
									});
								})() : null,
								r.status === "awaiting_approval" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "ml-auto flex gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										size: "sm",
										variant: "ghost",
										onClick: () => void decide(r.id, "approved"),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "mr-1 h-3.5 w-3.5" }), " Approve"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										size: "sm",
										variant: "ghost",
										onClick: () => void decide(r.id, "denied"),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "mr-1 h-3.5 w-3.5" }), " Deny"]
									})]
								}) : ["pending", "running"].includes(r.status) && !r.cancel_requested_at ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "ghost",
									className: "ml-auto",
									onClick: () => void cancel(r.id),
									children: "Cancel"
								}) : null
							]
						}, r.id))
					})]
				})]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Workflow, {
					className: "h-6 w-6",
					"aria-hidden": true
				}),
				title: "Select an automation",
				description: "Choose one on the left, or create a new automation."
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: !!preview,
			onOpenChange: (o) => !o && setPreview(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
				className: "max-w-lg",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogTitle, { children: ["Preview — ", preview?.name] }) }),
					preview ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-3 text-sm",
						children: [preview.plan.blocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-destructive",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, {
								className: "mt-0.5 h-4 w-4 shrink-0",
								"aria-hidden": true
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: preview.plan.blockedReason ?? "This automation contains a step that can never run." })]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: [
								"Highest risk:",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium text-foreground",
									children: RISK_LABEL[preview.plan.highestRisk] ?? preview.plan.highestRisk
								}),
								preview.plan.requiresApproval ? " · needs your approval" : ""
							]
						}), preview.plan.steps.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: "This automation has no steps."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
							className: "flex flex-col gap-1.5",
							children: preview.plan.steps.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-start gap-2 rounded-md bg-secondary/40 px-2.5 py-1.5 text-[13px]",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "mt-0.5 text-[10px] text-muted-foreground",
										children: i + 1
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "flex-1",
										children: s.summary
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] uppercase text-muted-foreground",
										children: RISK_LABEL[s.risk] ?? s.risk
									})
								]
							}, i))
						})]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogFooter, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: () => setPreview(null),
						children: "Close"
					}) })
				]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: !!confirmDelete,
			onOpenChange: (o) => !o && setConfirmDelete(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Delete this automation?" }) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-muted-foreground",
					children: [
						"“",
						confirmDelete?.name,
						"” and its run history will be permanently deleted. This cannot be undone."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					onClick: () => setConfirmDelete(null),
					children: "Cancel"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					onClick: () => confirmDelete && void reallyDelete(confirmDelete),
					disabled: busy,
					children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-1.5 h-4 w-4 animate-spin" }) : null, "Delete automation"]
				})] })
			] })
		})
	] });
}
//#endregion
export { AutomationsPage as component };
