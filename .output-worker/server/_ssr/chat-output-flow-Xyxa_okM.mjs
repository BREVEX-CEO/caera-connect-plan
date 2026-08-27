import { a as removeArtifact, c as sha256, l as verifyIntegrity, o as saveArtifact } from "./store-DGu3SiHe.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/chat-output-flow-Xyxa_okM.js
var ACTIVITY_KEY = "ocade.output-activity.v1";
function isActivity(value) {
	if (!value || typeof value !== "object") return false;
	const row = value;
	return typeof row.id === "string" && typeof row.at === "string" && row.action === "ocade.output.saved" && typeof row.artifactId === "string" && typeof row.outputName === "string" && typeof row.outputSha256 === "string" && typeof row.outputBytes === "number" && (row.result === "verified" || row.result === "not_confirmed") && typeof row.conversationId === "string" && typeof row.messageId === "string" && Array.isArray(row.sourceFiles);
}
function listLocalOutputActivity() {
	const storage = globalThis.localStorage;
	if (!storage) return {
		ok: false,
		reason: "Browser storage is unavailable, so local output activity cannot be read."
	};
	try {
		const raw = storage.getItem(ACTIVITY_KEY);
		if (!raw) return {
			ok: true,
			data: [],
			evidence: "No local output activity."
		};
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed) || !parsed.every(isActivity)) return {
			ok: false,
			reason: "Local output activity storage is corrupt. OCADE will not render it as an empty ledger."
		};
		return {
			ok: true,
			data: parsed,
			evidence: `${parsed.length} local output activity ${parsed.length === 1 ? "entry" : "entries"}.`
		};
	} catch {
		return {
			ok: false,
			reason: "Local output activity storage is corrupt. OCADE will not render it as an empty ledger."
		};
	}
}
function recordLocalOutputActivity(entry) {
	const existing = listLocalOutputActivity();
	if (!existing.ok) return existing;
	const storage = globalThis.localStorage;
	if (!storage) return {
		ok: false,
		reason: "Browser storage is unavailable, so local output activity could not be saved."
	};
	try {
		storage.setItem(ACTIVITY_KEY, JSON.stringify([entry, ...existing.data]));
		return {
			ok: true,
			data: entry,
			evidence: `Recorded output activity for “${entry.outputName}”.`
		};
	} catch (error) {
		return {
			ok: false,
			reason: `Local output activity could not be saved: ${error instanceof Error ? error.message : "storage refused it"}.`
		};
	}
}
/**
* Persist an assistant output, immediately re-hash it, then record the exact
* artifact id and digest in the local activity ledger.
*
* If the activity write fails, the artifact save is rolled back. This avoids a
* false-success split where the Artifacts surface shows an output that the
* Activity surface cannot account for.
*/
async function saveChatOutput(input) {
	const sourceFiles = [];
	for (const file of input.files) {
		const digest = await sha256(file.content);
		if (!digest.ok) return digest;
		sourceFiles.push({
			name: file.name,
			sha256: digest.data
		});
	}
	const saved = await saveArtifact({
		name: input.title,
		kind: "text",
		content: input.content,
		provenance: {
			producedBy: `ocade.chat:${input.conversationId}`,
			verified: input.producerVerified === true,
			evidence: input.producerEvidence
		},
		context: {
			conversationId: input.conversationId,
			messageId: input.messageId,
			...input.project ? {
				projectId: input.project.id,
				...input.project.name ? { projectName: input.project.name } : {},
				...input.project.instructions ? { projectInstructions: input.project.instructions } : {}
			} : {},
			files: sourceFiles
		},
		now: input.now,
		id: input.artifactId
	});
	if (!saved.ok) return saved;
	const integrity = await verifyIntegrity(saved.data.id);
	if (!integrity.ok || !integrity.data.intact) {
		removeArtifact(saved.data.id);
		return integrity.ok ? {
			ok: false,
			reason: "The saved output failed its immediate integrity check and was removed."
		} : integrity;
	}
	const recorded = recordLocalOutputActivity({
		id: input.activityId ?? `output-activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		at: (input.now ?? /* @__PURE__ */ new Date()).toISOString(),
		action: "ocade.output.saved",
		artifactId: saved.data.id,
		outputName: saved.data.name,
		outputSha256: saved.data.sha256,
		outputBytes: saved.data.byteLength,
		result: saved.data.provenance.verified ? "verified" : "not_confirmed",
		conversationId: input.conversationId,
		messageId: input.messageId,
		...input.project ? {
			projectId: input.project.id,
			...input.project.name ? { projectName: input.project.name } : {}
		} : {},
		sourceFiles
	});
	if (!recorded.ok) {
		const rollback = removeArtifact(saved.data.id);
		return {
			ok: false,
			reason: rollback.ok ? `${recorded.reason} The artifact save was rolled back.` : `${recorded.reason} The artifact also could not be rolled back: ${rollback.reason}`
		};
	}
	return {
		ok: true,
		data: {
			artifact: saved.data,
			integrity: integrity.data,
			activity: recorded.data
		},
		evidence: `Saved, re-hashed, and recorded “${saved.data.name}” in local activity.`
	};
}
//#endregion
export { saveChatOutput as n, listLocalOutputActivity as t };
