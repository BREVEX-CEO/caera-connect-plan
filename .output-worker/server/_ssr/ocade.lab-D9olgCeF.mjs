import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Dn as DraftingCompass, Gt as ListChecks, Kn as CircleQuestionMark, M as ShieldCheck, N as ShieldAlert, On as Download, Or as AppWindow, Sn as FileCheckCorner, V as ScrollText, Wt as LoaderCircle, Y as RefreshCw, cn as Globe, dn as Gauge, dt as Pencil, et as Quote, j as ShieldQuestionMark, jn as Cpu, m as TriangleAlert, on as HardDrive, p as Undo2, pr as Boxes, tr as ChevronRight, un as GitBranch, w as Square, xn as FileCodeCorner } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { o as saveArtifact } from "./store-DGu3SiHe.mjs";
import { t as useServerFn } from "./useServerFn-CrZF2pjq.mjs";
import { i as parseUnifiedDiff, n as applyReversibly, r as buildPatchReceipt, t as applyPatch } from "./patch-BTnAw3PV.mjs";
import { C as methodRank, f as createTaskScope } from "./skill-pack-DE_iAXbW.mjs";
import { n as runResearchQuery } from "./research.functions-BmD_aneC.mjs";
import { a as independentSources, i as describeAssessment, n as assessIncidentClaim, o as rankSources, t as assessClaim } from "./claim-check-9ZutxkrV.mjs";
import { A as runPlannedStep, O as planStep, d as createDefaultExecutors, t as PackRegistry } from "./pack-registry-CPvQqgjI.mjs";
import { t as DiagnosticsPanel } from "./DiagnosticsPanel-BowDafPw.mjs";
import { Buffer } from "node:buffer";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.lab-D9olgCeF.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Research judgment, shown working.
*
* The two examples are chosen because they are the cases where an agent most
* commonly sounds authoritative and is wrong: apparent corroboration that is
* really one wire story, and an "accident" inferred from a red traffic layer.
*
* Both run the real modules — the verdicts below are produced by the same code
* the tests exercise, not written into the markup.
*/
var NOW$1 = /* @__PURE__ */ new Date();
var minutesAgo = (n) => /* @__PURE__ */ new Date(NOW$1.getTime() - n * 6e4);
/** Four outlets, one agency: the syndication trap. */
var SYNDICATED = [
	{
		id: "1",
		title: "Report",
		publisher: "The Daily",
		originator: "Agency",
		kind: "news",
		publishedAt: minutesAgo(30),
		retrievedAt: NOW$1
	},
	{
		id: "2",
		title: "Report",
		publisher: "Evening Post",
		originator: "Agency",
		kind: "news",
		publishedAt: minutesAgo(25),
		retrievedAt: NOW$1
	},
	{
		id: "3",
		title: "Report",
		publisher: "City Herald",
		originator: "Agency",
		kind: "news",
		publishedAt: minutesAgo(20),
		retrievedAt: NOW$1
	},
	{
		id: "4",
		title: "Report",
		publisher: "Morning News",
		originator: "Agency",
		kind: "news",
		publishedAt: minutesAgo(15),
		retrievedAt: NOW$1
	}
];
/** A traffic feed and nothing else: the inference trap. */
var TRAFFIC_ONLY = [{
	id: "t",
	title: "Live traffic",
	publisher: "Live traffic layer",
	kind: "sensor",
	publishedAt: minutesAgo(2),
	retrievedAt: NOW$1
}];
function ResearchPanel() {
	const [demo, setDemo] = (0, import_react.useState)(null);
	const runQuery = useServerFn(runResearchQuery);
	const [running, setRunning] = (0, import_react.useState)(false);
	const [runResult, setRunResult] = (0, import_react.useState)(null);
	const runRealResearch = (0, import_react.useCallback)(async () => {
		setRunning(true);
		setRunResult(null);
		try {
			const res = await runQuery({ data: {
				query: "What is the current UK guidance on flood warnings?",
				topic: "flooding",
				volatility: "daily",
				candidates: [{
					url: "https://www.gov.uk/check-flood-risk",
					title: "Check flood risk",
					publishedAt: null
				}, {
					url: "https://en.wikipedia.org/wiki/Flood_warning",
					title: "Flood warning",
					publishedAt: null
				}]
			} });
			setRunResult(res);
		} catch (e) {
			setRunResult({
				ok: false,
				reason: e instanceof Error ? e.message : "The research run could not be started.",
				allowedHosts: []
			});
		} finally {
			setRunning(false);
		}
	}, [runQuery]);
	const syndication = assessClaim({
		text: "The council has approved the new bridge.",
		topic: "local government",
		supporting: SYNDICATED
	}, NOW$1);
	const incident = assessIncidentClaim({
		kind: "accident",
		text: "a collision",
		location: "the ring road",
		sources: TRAFFIC_ONLY
	}, NOW$1);
	const ranking = rankSources(SYNDICATED, "local government", NOW$1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "mb-1 flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " How OCADE weighs what it reads"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-3 text-xs text-muted-foreground",
				children: "Fetching pages needs a network. Judging them doesn't — and that's where research goes wrong. These run the real code on the two cases that most often produce a confident, wrong answer."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 rounded border border-border p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						onClick: () => void runRealResearch(),
						disabled: running,
						children: running ? "Researching…" : "Run a real research query"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-muted-foreground",
						children: "Runs on the server. Only an allowlisted set of hosts can be reached."
					})]
				}), runResult && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 text-xs",
					children: [runResult.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-muted-foreground",
						children: [
							"Answered from ",
							runResult.result.subAnswers?.length ?? 0,
							" sub-question",
							(runResult.result.subAnswers?.length ?? 0) === 1 ? "" : "s",
							"."
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-muted-foreground",
						children: ["Refused: ", runResult.reason]
					}), runResult.allowedHosts.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-0.5 text-muted-foreground",
						children: ["Reachable hosts: ", runResult.allowedHosts.join(", ")]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: demo === "syndication" ? "default" : "ghost",
					className: "h-8",
					onClick: () => setDemo("syndication"),
					children: "Four outlets, one story"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: demo === "incident" ? "default" : "ghost",
					className: "h-8",
					onClick: () => setDemo("incident"),
					children: "Is that traffic an accident?"
				})]
			}),
			demo === "syndication" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				className: "mt-3 rounded-lg border border-border/60 p-3 text-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-medium text-foreground",
						children: [
							"Four sources look like corroboration. OCADE counts ",
							syndication.independentSupport,
							"."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-muted-foreground",
						children: describeAssessment(syndication)
					}),
					ranking.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1.5 text-[11px] text-muted-foreground",
						children: ranking.evidence
					}) : null
				]
			}) : null,
			demo === "incident" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				className: cn("mt-3 rounded-lg border p-3 text-xs", incident.ok ? "border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10" : "border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-center gap-1.5 font-medium text-foreground",
						children: [incident.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), incident.ok ? "Reported by an official source" : "OCADE won't say that"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-muted-foreground",
						children: incident.ok ? incident.statement : incident.reason
					}),
					!incident.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1.5 border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium text-foreground",
							children: "What it can say: "
						}), incident.mayInsteadSay]
					}) : null
				]
			}) : null
		]
	});
}
var vertexCount = (m) => m.positions.length / 3;
var faceCount = (m) => m.indices.length / 3;
function vertexAt(m, i) {
	return [
		m.positions[i * 3],
		m.positions[i * 3 + 1],
		m.positions[i * 3 + 2]
	];
}
var sub = (a, b) => [
	a[0] - b[0],
	a[1] - b[1],
	a[2] - b[2]
];
var cross = (a, b) => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var length = (a) => Math.sqrt(dot(a, a));
/**
* Check a mesh against the properties a real solid has.
*
* Every failure below names what is wrong AND what it will cause downstream,
* because "non-manifold geometry" tells someone nothing they can act on.
*/
function validateMesh(mesh) {
	const v = vertexCount(mesh);
	const f = faceCount(mesh);
	if (mesh.positions.length % 3 !== 0) return {
		ok: false,
		reason: "The position list isn't a whole number of vertices."
	};
	if (mesh.indices.length % 3 !== 0) return {
		ok: false,
		reason: "The index list isn't a whole number of triangles."
	};
	if (f === 0) return {
		ok: false,
		reason: "This mesh has no faces, so there is nothing to render."
	};
	const outOfRange = mesh.indices.find((i) => !Number.isInteger(i) || i < 0 || i >= v);
	if (outOfRange !== void 0) return {
		ok: false,
		reason: `A face refers to vertex ${outOfRange}, which doesn't exist. Most tools crash on this rather than reporting it.`
	};
	const edgeUses = /* @__PURE__ */ new Map();
	const directed = /* @__PURE__ */ new Set();
	let signedVolume = 0;
	let surfaceArea = 0;
	for (let t = 0; t < f; t++) {
		const ia = mesh.indices[t * 3];
		const ib = mesh.indices[t * 3 + 1];
		const ic = mesh.indices[t * 3 + 2];
		if (ia === ib || ib === ic || ia === ic) return {
			ok: false,
			reason: `Triangle ${t} uses the same vertex twice, so it has no area and no defined normal — lighting on it would be undefined.`
		};
		const a = vertexAt(mesh, ia);
		const b = vertexAt(mesh, ib);
		const c = vertexAt(mesh, ic);
		const area = length(cross(sub(b, a), sub(c, a))) / 2;
		if (area < 1e-12) return {
			ok: false,
			reason: `Triangle ${t} is degenerate — its three points are in a line, so it has no surface to shade.`
		};
		surfaceArea += area;
		signedVolume += dot(a, cross(b, c)) / 6;
		for (const [x, y] of [
			[ia, ib],
			[ib, ic],
			[ic, ia]
		]) {
			const key = x < y ? `${x}-${y}` : `${y}-${x}`;
			edgeUses.set(key, (edgeUses.get(key) ?? 0) + 1);
			const dir = `${x}>${y}`;
			if (directed.has(dir)) return {
				ok: false,
				reason: `Triangles meeting at edge ${x}–${y} are wound inconsistently. Half this surface would render inside-out.`
			};
			directed.add(dir);
		}
	}
	const boundary = [...edgeUses.entries()].filter(([, n]) => n === 1);
	const nonManifold = [...edgeUses.entries()].filter(([, n]) => n > 2);
	if (nonManifold.length > 0) return {
		ok: false,
		reason: `${nonManifold.length} edge${nonManifold.length === 1 ? " is" : "s are"} shared by more than two faces. Slicers and boolean operations mishandle this silently.`
	};
	if (boundary.length > 0) return {
		ok: false,
		reason: `This mesh has ${boundary.length} open edge${boundary.length === 1 ? "" : "s"}, so it isn't a closed solid. It will look fine on screen and fail to print.`
	};
	const e = edgeUses.size;
	const euler = v - e + f;
	if (euler !== 2) return {
		ok: false,
		reason: `This mesh has Euler characteristic ${euler}, not 2 — it is not a simple closed surface. Something is joined wrongly even though every edge has two faces.`
	};
	if (signedVolume <= 0) return {
		ok: false,
		reason: "This mesh is wound inward, so it encloses negative volume. It would render as a dark shell and print as a void."
	};
	return {
		ok: true,
		data: {
			vertices: v,
			faces: f,
			edges: e,
			eulerCharacteristic: euler,
			watertight: true,
			signedVolume,
			surfaceArea
		},
		evidence: `${v} vertices, ${f} triangles, watertight, volume ${signedVolume.toFixed(4)}, area ${surfaceArea.toFixed(4)}.`
	};
}
/**
* An axis-aligned box.
*
* Each corner is duplicated per face in most exporters so normals stay hard;
* here the 8 shared corners are used instead, because that is what makes the
* watertight and Euler checks meaningful. Hard normals belong to the exporter,
* not the topology.
*/
function buildBox(width, height, depth) {
	for (const [name, value] of [
		["width", width],
		["height", height],
		["depth", depth]
	]) if (!Number.isFinite(value) || value <= 0) return {
		ok: false,
		reason: `A box needs a positive ${name}; ${value} isn't one.`
	};
	const x = width / 2;
	const y = height / 2;
	const z = depth / 2;
	const mesh = {
		name: `box ${width}×${height}×${depth}`,
		positions: [
			-x,
			-y,
			-z,
			x,
			-y,
			-z,
			x,
			y,
			-z,
			-x,
			y,
			-z,
			-x,
			-y,
			z,
			x,
			-y,
			z,
			x,
			y,
			z,
			-x,
			y,
			z
		],
		indices: [
			4,
			5,
			6,
			4,
			6,
			7,
			1,
			0,
			3,
			1,
			3,
			2,
			0,
			4,
			7,
			0,
			7,
			3,
			5,
			1,
			2,
			5,
			2,
			6,
			3,
			7,
			6,
			3,
			6,
			2,
			0,
			1,
			5,
			0,
			5,
			4
		]
	};
	const check = validateMesh(mesh);
	if (!check.ok) return {
		ok: false,
		reason: `Box generation produced invalid geometry: ${check.reason}`
	};
	return {
		ok: true,
		data: mesh,
		evidence: check.evidence
	};
}
/**
* A UV sphere.
*
* The poles are single vertices fanned to the first and last rings, rather than
* degenerate quads — which is the usual source of zero-area triangles at the
* top and bottom of a generated sphere.
*/
function buildSphere(radius, segments, rings) {
	if (!Number.isFinite(radius) || radius <= 0) return {
		ok: false,
		reason: `A sphere needs a positive radius; ${radius} isn't one.`
	};
	if (!Number.isInteger(segments) || segments < 3) return {
		ok: false,
		reason: "A sphere needs at least 3 segments around, or it isn't a surface."
	};
	if (!Number.isInteger(rings) || rings < 2) return {
		ok: false,
		reason: "A sphere needs at least 2 rings, or the poles meet."
	};
	const positions = [];
	const indices = [];
	positions.push(0, radius, 0);
	for (let r = 1; r < rings; r++) {
		const phi = Math.PI * r / rings;
		const yy = radius * Math.cos(phi);
		const rr = radius * Math.sin(phi);
		for (let s = 0; s < segments; s++) {
			const theta = 2 * Math.PI * s / segments;
			positions.push(rr * Math.sin(theta), yy, rr * Math.cos(theta));
		}
	}
	positions.push(0, -radius, 0);
	const north = 0;
	const south = positions.length / 3 - 1;
	const ringStart = (r) => 1 + (r - 1) * segments;
	for (let s = 0; s < segments; s++) {
		const a = ringStart(1) + s;
		const b = ringStart(1) + (s + 1) % segments;
		indices.push(north, a, b);
	}
	for (let r = 1; r < rings - 1; r++) for (let s = 0; s < segments; s++) {
		const a = ringStart(r) + s;
		const b = ringStart(r) + (s + 1) % segments;
		const c = ringStart(r + 1) + s;
		const d = ringStart(r + 1) + (s + 1) % segments;
		indices.push(a, d, b);
		indices.push(a, c, d);
	}
	for (let s = 0; s < segments; s++) {
		const a = ringStart(rings - 1) + s;
		const b = ringStart(rings - 1) + (s + 1) % segments;
		indices.push(south, b, a);
	}
	const mesh = {
		name: `sphere r=${radius}`,
		positions,
		indices
	};
	const check = validateMesh(mesh);
	if (!check.ok) return {
		ok: false,
		reason: `Sphere generation produced invalid geometry: ${check.reason}`
	};
	return {
		ok: true,
		data: mesh,
		evidence: check.evidence
	};
}
/**
* OCADE Vision/3D — scene specification and pre-render validation.
*
* A scene can be perfectly well-formed JSON and still render as a black frame,
* a white-out, or a mirror ball full of fireflies. Those failures cost minutes
* or hours of render time to discover, and the error they produce afterwards
* says nothing useful.
*
* This module checks the things that are knowable *before* rendering, and
* refuses on the ones that guarantee a wasted render.
*
* WHAT IT DOES NOT DO.
*
* It does not render. There is no renderer in this environment, and
* `RENDER_REALITY` says so in the words the user sees. "Validated" and
* "rendered" are different claims, and a system that blurs them will eventually
* report a finished image that does not exist. `assessScene` therefore returns
* a readiness verdict and never an artefact.
*/
var inUnit = (v) => Number.isFinite(v) && v >= 0 && v <= 1;
/**
* Validate a PBR material.
*
* The intermediate-metallic check is the interesting one: a metallic of 0.5 is
* not "half metal", it is a value no real substance has, and it is almost
* always a mistake — either a texture that should have been binary, or a value
* someone tuned by eye to hide a lighting problem. It is reported rather than
* refused, because layered materials do legitimately produce it.
*/
function validateMaterial(m) {
	const warnings = [];
	for (const [i, c] of m.baseColor.entries()) {
		if (!inUnit(c)) return {
			ok: false,
			reason: `“${m.name}” has a base colour channel of ${c}. Linear colour channels run 0–1; a value outside that is either an sRGB byte that wasn't converted, or an error.`
		};
		if (c > .95 && i === 0 && m.baseColor.every((x) => x > .95)) {
			warnings.push(`“${m.name}” is almost pure white (${m.baseColor.map((x) => x.toFixed(2)).join(", ")}). No real diffuse surface reflects more than about 0.9; this will look washed out and bounce too much light.`);
			break;
		}
	}
	if (!inUnit(m.metallic)) return {
		ok: false,
		reason: `“${m.name}” has metallic ${m.metallic}, which is outside 0–1.`
	};
	if (!inUnit(m.roughness)) return {
		ok: false,
		reason: `“${m.name}” has roughness ${m.roughness}, which is outside 0–1.`
	};
	if (m.metallic > .05 && m.metallic < .95) warnings.push(`“${m.name}” has metallic ${m.metallic.toFixed(2)}. Real substances are metal or they aren't; values in between usually mean a texture that should be binary.`);
	if (m.roughness < .02 && m.metallic > .95) warnings.push(`“${m.name}” is a perfect mirror (roughness ${m.roughness.toFixed(3)}). Path tracers produce bright speckle on these unless the renderer clamps; roughness 0.05 or above is usually what was wanted.`);
	if (m.ior !== void 0 && (!Number.isFinite(m.ior) || m.ior < 1)) return {
		ok: false,
		reason: `“${m.name}” has an index of refraction of ${m.ior}. Below 1 doesn't occur in nature — vacuum is exactly 1, water is 1.33, glass about 1.5.`
	};
	if (m.opacity !== void 0 && !inUnit(m.opacity)) return {
		ok: false,
		reason: `“${m.name}” has opacity ${m.opacity}, which is outside 0–1.`
	};
	if (m.emissive?.some((c) => !Number.isFinite(c) || c < 0)) return {
		ok: false,
		reason: `“${m.name}” has a negative emissive channel, which is not a thing.`
	};
	return {
		ok: true,
		data: warnings,
		evidence: warnings.length === 0 ? `“${m.name}” is physically plausible.` : `“${m.name}” is usable, with ${warnings.length} thing${warnings.length === 1 ? "" : "s"} worth checking.`
	};
}
/**
* Validate an animation track.
*
* Out-of-order or duplicate keyframe times are the classic source of an
* animation that plays correctly in the editor and jumps in the export, because
* different tools sort ties differently. Both are refused rather than sorted
* silently — sorting would change the animation the user described.
*/
function validateTrack(track) {
	const k = track.keyframes;
	if (k.length === 0) return {
		ok: false,
		reason: `“${track.target}.${track.property}” has no keyframes, so it animates nothing.`
	};
	if (k.length === 1) return {
		ok: false,
		reason: `“${track.target}.${track.property}” has one keyframe, which is a constant value rather than an animation.`
	};
	if (k.some((f) => !Number.isFinite(f.time) || f.time < 0)) return {
		ok: false,
		reason: `“${track.target}.${track.property}” has a keyframe at an invalid time.`
	};
	if (k.some((f) => !Number.isFinite(f.value))) return {
		ok: false,
		reason: `“${track.target}.${track.property}” has a keyframe with a non-numeric value.`
	};
	for (let i = 1; i < k.length; i++) {
		if (k[i].time === k[i - 1].time) return {
			ok: false,
			reason: `“${track.target}.${track.property}” has two keyframes at ${k[i].time}s. Different tools break that tie differently, so the export won't match what you see.`
		};
		if (k[i].time < k[i - 1].time) return {
			ok: false,
			reason: `“${track.target}.${track.property}” has keyframes out of order (${k[i - 1].time}s then ${k[i].time}s). OCADE won't reorder them — that would change the animation you described.`
		};
	}
	return {
		ok: true,
		data: { durationSeconds: k[k.length - 1].time - k[0].time },
		evidence: `${k.length} keyframes over ${(k[k.length - 1].time - k[0].time).toFixed(2)}s.`
	};
}
/**
* Decide whether a scene is worth rendering.
*
* The lighting check is the one that saves the most time: a scene with no light
* and no emissive material renders a black frame, every time, and the renderer
* reports success while doing it.
*/
function assessScene(scene) {
	if (scene.objects.length === 0) return {
		ok: false,
		reason: "This scene has no objects in it, so a render would be empty."
	};
	const warnings = [];
	const materialNames = new Set(scene.materials.map((m) => m.name));
	if (materialNames.size !== scene.materials.length) return {
		ok: false,
		reason: "This scene has a duplicate material name, so an object's material binding is ambiguous."
	};
	const objectNames = new Set(scene.objects.map((o) => o.name));
	if (objectNames.size !== scene.objects.length) return {
		ok: false,
		reason: "This scene has a duplicate object name, so animation targets and exported nodes are ambiguous."
	};
	let triangles = 0;
	for (const obj of scene.objects) {
		const geometry = validateMesh(obj.mesh);
		if (!geometry.ok) return {
			ok: false,
			reason: `“${obj.name}”: ${geometry.reason}`
		};
		triangles += geometry.data.faces;
		if (!materialNames.has(obj.material)) return {
			ok: false,
			reason: `“${obj.name}” uses material “${obj.material}”, which isn't in this scene. Renderers substitute a default grey and report success even when the result looks correct.`
		};
	}
	for (const m of scene.materials) {
		const check = validateMaterial(m);
		if (!check.ok) return check;
		warnings.push(...check.data);
	}
	for (const light of scene.lights) {
		if (!Number.isFinite(light.intensity) || light.intensity < 0) return {
			ok: false,
			reason: `“${light.name}” has invalid light intensity ${light.intensity}. Intensity must be finite and non-negative.`
		};
		if (light.color.some((channel) => !Number.isFinite(channel) || channel < 0)) return {
			ok: false,
			reason: `“${light.name}” has an invalid light colour. Linear light channels must be finite and non-negative.`
		};
	}
	const contributing = scene.lights.filter((l) => l.intensity > 0);
	const emissive = scene.materials.filter((m) => m.emissive?.some((c) => c > 0));
	if (contributing.length === 0 && emissive.length === 0) return {
		ok: false,
		reason: "Nothing in this scene emits light, so it would render completely black. OCADE won't spend the render time to produce that."
	};
	if (contributing.length === 0) warnings.push(`The only light comes from ${emissive.length} emissive material${emissive.length === 1 ? "" : "s"}. That renders, but it will be noisy without a light source.`);
	const dark = scene.lights.filter((l) => l.intensity === 0);
	if (dark.length > 0) warnings.push(`${dark.length} light${dark.length === 1 ? " has" : "s have"} zero intensity and contribute${dark.length === 1 ? "s" : ""} nothing.`);
	let durationSeconds = 0;
	const targets = objectNames;
	for (const track of scene.tracks ?? []) {
		const t = validateTrack(track);
		if (!t.ok) return t;
		if (!targets.has(track.target)) return {
			ok: false,
			reason: `An animation targets “${track.target}”, which isn't an object in this scene. It would silently animate nothing.`
		};
		durationSeconds = Math.max(durationSeconds, t.data.durationSeconds);
	}
	return {
		ok: true,
		data: {
			objects: scene.objects.length,
			triangles,
			materials: scene.materials.length,
			lights: scene.lights.length,
			durationSeconds,
			warnings
		},
		evidence: `${scene.objects.length} objects, ${triangles} triangles, ${scene.materials.length} materials, ${contributing.length} contributing lights${durationSeconds > 0 ? `, ${durationSeconds.toFixed(2)}s of animation` : ", static"}.`
	};
}
/**
* What OCADE is entitled to say after `assessScene` succeeds.
*
* Exported as a constant so no caller can accidentally phrase a validation as a
* finished render. See the module header.
*/
var RENDER_REALITY = "This scene has been checked — geometry is watertight, materials are physically plausible, the lighting will produce an image and the animation is well-formed. No picture has been rendered: there is no renderer in this environment, and OCADE won't show you a frame it didn't produce.";
/**
* Minimum camera travel. Below this, triangulation is numerically unstable and
* the resulting mesh is confidently wrong rather than obviously wrong.
*/
var MIN_BASELINE_M = .15;
var distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/**
* Decide whether reconstruction is worth attempting.
*
* Every refusal carries `shootInstead`: a refusal that doesn't say what would
* work leaves the user to guess, and they will usually re-shoot the same way.
*/
function assessReconstruction(frames) {
	if (frames.length === 0) return {
		ok: false,
		reason: "There are no frames to work from.",
		shootInstead: "Record a short clip walking around the subject."
	};
	if (frames.length < 8) return {
		ok: false,
		reason: `Only ${frames.length} frames. A solve needs at least 8 to be constrained at all.`,
		shootInstead: "Record for longer — 20–30 seconds of steady movement is usually plenty."
	};
	const invalidTelemetry = frames.find((frame) => !Number.isInteger(frame.index) || frame.index < 0 || !Number.isFinite(frame.timestamp) || frame.timestamp < 0 || !Number.isFinite(frame.sharpness) || frame.sharpness < 0 || !Number.isFinite(frame.focalLengthMm) || frame.focalLengthMm <= 0 || frame.position !== null && (frame.position.length !== 3 || frame.position.some((coordinate) => !Number.isFinite(coordinate))));
	if (invalidTelemetry) return {
		ok: false,
		reason: `Frame ${invalidTelemetry.index} has invalid frame telemetry. Timestamps, sharpness, focal length and every supplied camera coordinate must be finite.`,
		shootInstead: "Export the camera track again without missing, infinite or non-numeric telemetry values."
	};
	const ordered = [...frames].sort((a, b) => a.timestamp - b.timestamp);
	const warnings = [];
	const posed = ordered.filter((f) => f.position !== null);
	if (posed.length === 0) return {
		ok: false,
		reason: "This video carries no camera positions, so OCADE cannot tell whether the camera moved. It won't reconstruct geometry on the assumption that it did — a static shot produces a warped mesh that looks convincing and measures wrongly.",
		shootInstead: "Record with a device that logs camera pose (most phone AR capture apps, or a drone with telemetry), or supply the camera track from your existing software."
	};
	if (posed.length < ordered.length) warnings.push(`${ordered.length - posed.length} of ${ordered.length} frames have no camera position and will be dropped from the solve.`);
	let baselineMetres = 0;
	for (let i = 1; i < posed.length; i++) baselineMetres += distance(posed[i - 1].position, posed[i].position);
	const focals = ordered.map((f) => f.focalLengthMm);
	const focalRange = Math.max(...focals) - Math.min(...focals);
	if (focalRange > .01 && baselineMetres < .15 * 4) return {
		ok: false,
		reason: `The focal length changes across this clip (${Math.min(...focals)}–${Math.max(...focals)} mm) while the camera barely moves. Zooming changes the image without adding parallax, and a solver will read it as movement and produce a distorted scale.`,
		shootInstead: "Lock the zoom and move the camera instead."
	};
	if (baselineMetres < .15) return {
		ok: false,
		reason: `The camera moved ${baselineMetres.toFixed(3)} m in total. Depth comes from parallax, and below about ${MIN_BASELINE_M} m there isn't enough to triangulate — the result would be a plausible-looking mesh with no real geometry behind it.`,
		shootInstead: "Walk around the subject rather than panning from one spot. Rotation alone gives no parallax, however smooth it is."
	};
	if (focalRange > .01) warnings.push("The focal length changes during the clip. The solve will need to treat it as a varying intrinsic, which is slower and less accurate than a locked lens.");
	const usable = ordered.filter((f) => f.sharpness >= 100);
	if (usable.length < 8) return {
		ok: false,
		reason: `Only ${usable.length} of ${ordered.length} frames are sharp enough to find features in. Motion blur removes exactly the detail a solve depends on.`,
		shootInstead: "Move more slowly, or record in brighter light so the shutter can be faster."
	};
	if (usable.length < ordered.length * .6) warnings.push(`${ordered.length - usable.length} of ${ordered.length} frames are too blurred to use. The reconstruction will be sparser than the clip length suggests.`);
	const sorted = [...ordered.map((f) => f.sharpness)].sort((a, b) => a - b);
	const medianSharpness = sorted[Math.floor(sorted.length / 2)];
	const duration = ordered[ordered.length - 1].timestamp - ordered[0].timestamp;
	if (duration > 0 && baselineMetres / duration > 3) warnings.push(`The camera averaged ${(baselineMetres / duration).toFixed(1)} m/s. That is fast enough that consecutive frames may not overlap, which breaks feature tracking.`);
	return {
		ok: true,
		data: {
			frames: ordered.length,
			baselineMetres,
			usableFrames: usable.length,
			medianSharpness,
			warnings
		},
		evidence: `${usable.length} usable frames over ${baselineMetres.toFixed(2)} m of camera travel — enough parallax to attempt a solve.`
	};
}
/**
* What OCADE may say when the gate passes.
*
* Passing means the footage COULD support a reconstruction, not that one has
* happened. Kept as a constant so the distinction cannot erode.
*/
var RECONSTRUCTION_REALITY = "This footage has enough camera movement and sharp detail to attempt a reconstruction. OCADE has not built a model: structure-from-motion needs a solver that isn't available in this environment. What has been established is that running one would be worth the time, rather than producing a mesh with no real geometry behind it.";
/**
* OCADE Vision/3D — writing geometry out as glTF 2.0.
*
* Validated geometry that never leaves memory isn't a deliverable. This turns a
* checked scene into a real `.gltf` file that Blender, three.js, Windows 3D
* Viewer and every other conformant tool will open.
*
* The spec has a handful of requirements that are easy to omit and that
* viewers handle by silently doing something wrong rather than erroring:
*
*  - **POSITION accessors MUST carry `min` and `max`.** They are how a viewer
*    frames the model and builds its bounding volume. Omit them and the model
*    loads, appears off-screen, and looks like a failed export.
*  - **BufferView offsets must be aligned** to the component size. Misaligned
*    data reads as garbage vertices on some GPUs and fine on others, so it
*    passes local testing and fails for someone else.
*  - **Accessor counts must match the data**, or a viewer walks off the end of
*    the buffer.
*
* Every one of those is asserted before the file is returned, so an export that
* would open wrongly is refused instead.
*/
/** glTF component types used here. */
var FLOAT = 5126;
var UNSIGNED_INT = 5125;
/** ARRAY_BUFFER / ELEMENT_ARRAY_BUFFER. */
var ARRAY_BUFFER = 34962;
var ELEMENT_ARRAY_BUFFER = 34963;
var align4 = (n) => n + 3 & -4;
/**
* Convert bytes to base64 without Node's Buffer, so this runs in the browser
* too — the export is meant to work on the user's own device.
*/
function toBase64(bytes) {
	let binary = "";
	const CHUNK = 32768;
	for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	return typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");
}
/**
* Write one scene as a self-contained glTF 2.0 document.
*
* Geometry is re-validated here rather than trusted: an export is the last
* point at which a broken mesh can be caught before it becomes someone else's
* problem in another tool.
*/
function exportGltf(scene) {
	const sceneCheck = assessScene(scene);
	if (!sceneCheck.ok) return {
		ok: false,
		reason: `This scene can't be exported because its validation failed: ${sceneCheck.reason}`
	};
	const materialIndex = /* @__PURE__ */ new Map();
	scene.materials.forEach((m, i) => materialIndex.set(m.name, i));
	const chunks = [];
	let offset = 0;
	const bufferViews = [];
	const accessors = [];
	const meshes = [];
	const nodes = [];
	for (const obj of scene.objects) {
		const check = validateMesh(obj.mesh);
		if (!check.ok) return {
			ok: false,
			reason: `“${obj.name}” can't be exported: ${check.reason}`
		};
		if (!materialIndex.has(obj.material)) return {
			ok: false,
			reason: `“${obj.name}” uses material “${obj.material}”, which isn't in this scene. The export would open with a default grey and look correct.`
		};
		const positions = new Float32Array(obj.mesh.positions);
		const indices = new Uint32Array(obj.mesh.indices);
		const posBytes = new Uint8Array(positions.buffer.slice(0));
		const posPad = align4(offset) - offset;
		if (posPad > 0) {
			chunks.push(new Uint8Array(posPad));
			offset += posPad;
		}
		const posView = bufferViews.length;
		bufferViews.push({
			buffer: 0,
			byteOffset: offset,
			byteLength: posBytes.length,
			target: ARRAY_BUFFER
		});
		chunks.push(posBytes);
		offset += posBytes.length;
		const min = [
			Infinity,
			Infinity,
			Infinity
		];
		const max = [
			-Infinity,
			-Infinity,
			-Infinity
		];
		for (let i = 0; i < positions.length; i += 3) for (let a = 0; a < 3; a++) {
			min[a] = Math.min(min[a], positions[i + a]);
			max[a] = Math.max(max[a], positions[i + a]);
		}
		const posAccessor = accessors.length;
		accessors.push({
			bufferView: posView,
			componentType: FLOAT,
			count: vertexCount(obj.mesh),
			type: "VEC3",
			min,
			max
		});
		const idxBytes = new Uint8Array(indices.buffer.slice(0));
		const idxPad = align4(offset) - offset;
		if (idxPad > 0) {
			chunks.push(new Uint8Array(idxPad));
			offset += idxPad;
		}
		const idxView = bufferViews.length;
		bufferViews.push({
			buffer: 0,
			byteOffset: offset,
			byteLength: idxBytes.length,
			target: ELEMENT_ARRAY_BUFFER
		});
		chunks.push(idxBytes);
		offset += idxBytes.length;
		const idxAccessor = accessors.length;
		accessors.push({
			bufferView: idxView,
			componentType: UNSIGNED_INT,
			count: obj.mesh.indices.length,
			type: "SCALAR"
		});
		meshes.push({
			name: obj.name,
			primitives: [{
				attributes: { POSITION: posAccessor },
				indices: idxAccessor,
				material: materialIndex.get(obj.material),
				mode: 4
			}]
		});
		nodes.push({
			name: obj.name,
			mesh: meshes.length - 1
		});
	}
	const total = chunks.reduce((n, c) => n + c.length, 0);
	const buffer = new Uint8Array(total);
	let cursor = 0;
	for (const c of chunks) {
		buffer.set(c, cursor);
		cursor += c.length;
	}
	const json = {
		asset: {
			version: "2.0",
			generator: "OCADE"
		},
		scene: 0,
		scenes: [{
			name: scene.name,
			nodes: nodes.map((_, i) => i)
		}],
		nodes,
		meshes,
		materials: scene.materials.map(toGltfMaterial),
		accessors,
		bufferViews,
		buffers: [{
			byteLength: total,
			uri: `data:application/octet-stream;base64,${toBase64(buffer)}`
		}]
	};
	const verdict = validateGltf(json);
	if (!verdict.ok) return {
		ok: false,
		reason: `The export failed its own conformance check: ${verdict.reason}`
	};
	const triangles = scene.objects.reduce((n, o) => n + faceCount(o.mesh), 0);
	return {
		ok: true,
		data: {
			json,
			bufferBytes: total
		},
		evidence: `glTF 2.0, ${scene.objects.length} object${scene.objects.length === 1 ? "" : "s"}, ${triangles} triangles, ${total} bytes of geometry, conformance-checked.`
	};
}
/** Map OCADE's material onto glTF's metallic-roughness model. */
function toGltfMaterial(m) {
	const out = {
		name: m.name,
		pbrMetallicRoughness: {
			baseColorFactor: [...m.baseColor, m.opacity ?? 1],
			metallicFactor: m.metallic,
			roughnessFactor: m.roughness
		}
	};
	if (m.emissive?.some((c) => c > 0)) out.emissiveFactor = m.emissive;
	if (m.opacity !== void 0 && m.opacity < 1) out.alphaMode = "BLEND";
	return out;
}
/**
* Check a glTF document against the parts of the spec that viewers handle by
* silently doing something wrong.
*
* Exported so a document from anywhere can be checked, not only ones written
* here.
*/
function validateGltf(json) {
	if (json.asset?.version !== "2.0") return {
		ok: false,
		reason: "This document doesn't declare glTF asset version 2.0."
	};
	const accessors = json.accessors ?? [];
	const bufferViews = json.bufferViews ?? [];
	const buffers = json.buffers ?? [];
	const meshes = json.meshes ?? [];
	if (accessors.length === 0) return {
		ok: false,
		reason: "This document has no accessors, so it has no geometry."
	};
	for (const [i, a] of accessors.entries()) {
		const viewIndex = a.bufferView;
		const view = bufferViews[viewIndex];
		if (!view) return {
			ok: false,
			reason: `Accessor ${i} points at buffer view ${viewIndex}, which doesn't exist.`
		};
		const componentSize = a.componentType === FLOAT || a.componentType === UNSIGNED_INT ? 4 : 0;
		if (componentSize === 0) return {
			ok: false,
			reason: `Accessor ${i} uses a component type OCADE doesn't write.`
		};
		const components = a.type === "VEC3" ? 3 : a.type === "SCALAR" ? 1 : 0;
		if (components === 0) return {
			ok: false,
			reason: `Accessor ${i} has an unsupported type “${String(a.type)}”.`
		};
		if (view.byteOffset % componentSize !== 0) return {
			ok: false,
			reason: `Buffer view ${viewIndex} starts at byte ${view.byteOffset}, which isn't aligned to its ${componentSize}-byte components. Some GPUs read this as garbage.`
		};
		const needed = a.count * components * componentSize;
		if (needed !== view.byteLength) return {
			ok: false,
			reason: `Accessor ${i} says ${a.count} elements (${needed} bytes) but its buffer view holds ${view.byteLength}. A viewer would read past the end.`
		};
		if (view.byteOffset + view.byteLength > (buffers[view.buffer]?.byteLength ?? 0)) return {
			ok: false,
			reason: `Buffer view ${viewIndex} runs past the end of its buffer.`
		};
	}
	for (const [mi, mesh] of meshes.entries()) {
		const primitives = mesh.primitives ?? [];
		for (const [pi, p] of primitives.entries()) {
			const pos = p.attributes?.POSITION;
			if (pos === void 0) return {
				ok: false,
				reason: `Mesh ${mi} primitive ${pi} has no POSITION attribute.`
			};
			const a = accessors[pos];
			if (!Array.isArray(a?.min) || !Array.isArray(a?.max)) return {
				ok: false,
				reason: `The POSITION accessor for mesh ${mi} has no min/max. The spec requires them — without them a viewer can't frame the model, and it loads off-screen looking like a failed export.`
			};
			if (a.min.length !== 3 || a.max.length !== 3) return {
				ok: false,
				reason: `The POSITION accessor for mesh ${mi} has min/max of the wrong length.`
			};
			for (let k = 0; k < 3; k++) if (a.min[k] > a.max[k]) return {
				ok: false,
				reason: `The POSITION accessor for mesh ${mi} has min greater than max on axis ${k}.`
			};
		}
	}
	return {
		ok: true,
		data: { accessors: accessors.length },
		evidence: `${meshes.length} meshes, ${accessors.length} accessors, all aligned and sized correctly.`
	};
}
/** Serialise for download. Pretty-printed: these files get read by people. */
function serialiseGltf(file) {
	return JSON.stringify(file.json, null, 2);
}
/** A locked-off shot: no parallax, so no reconstruction is possible. */
var STATIC_FOOTAGE = Array.from({ length: 24 }, (_, i) => ({
	index: i,
	timestamp: i * .1,
	position: [
		0,
		0,
		0
	],
	sharpness: 500,
	focalLengthMm: 24
}));
function demoScene(lit) {
	const box = buildBox(1, 1, 1);
	const sphere = buildSphere(.6, 24, 12);
	if (!box.ok || !sphere.ok) return null;
	return {
		name: "demo",
		objects: [{
			name: "Cube",
			mesh: box.data,
			material: "Plastic"
		}, {
			name: "Ball",
			mesh: sphere.data,
			material: "Metal"
		}],
		materials: [{
			name: "Plastic",
			baseColor: [
				.6,
				.2,
				.2
			],
			metallic: 0,
			roughness: .5
		}, {
			name: "Metal",
			baseColor: [
				.9,
				.9,
				.9
			],
			metallic: 1,
			roughness: .25
		}],
		lights: lit ? [{
			name: "Key",
			kind: "sun",
			intensity: 4,
			color: [
				1,
				1,
				1
			]
		}] : []
	};
}
function ScenePanel() {
	const [demo, setDemo] = (0, import_react.useState)(null);
	const [exported, setExported] = (0, import_react.useState)(null);
	const box = buildBox(1, 1, 1);
	const geometry = box.ok ? validateMesh(box.data) : null;
	const scene = demoScene(demo !== "unlit");
	const assessment = scene ? assessScene(scene) : null;
	const footage = assessReconstruction(STATIC_FOOTAGE);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "mb-1 flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Boxes, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " 3D that checks itself"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-2 text-xs text-muted-foreground",
				children: "Geometry is generated here and validated against properties real solids have — watertight, wound outward, Euler characteristic 2. A mesh that fails is refused, not shipped."
			}),
			geometry?.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mb-3 rounded-lg border border-border/60 bg-secondary/25 p-2 text-[11px] text-muted-foreground",
				children: ["Unit cube, generated and checked just now: ", geometry.evidence]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: demo === "lit" ? "default" : "ghost",
						className: "h-8",
						onClick: () => setDemo("lit"),
						children: "Check a scene"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: demo === "unlit" ? "default" : "ghost",
						className: "h-8",
						onClick: () => setDemo("unlit"),
						children: "Check it with no lights"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: demo === "static_video" ? "default" : "ghost",
						className: "h-8",
						onClick: () => setDemo("static_video"),
						children: "3D from a static video"
					})
				]
			}),
			(demo === "lit" || demo === "unlit") && assessment ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				className: cn("mt-3 rounded-lg border p-3 text-xs", assessment.ok ? "border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10" : "border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-center gap-1.5 font-medium text-foreground",
						children: [assessment.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), assessment.ok ? "Ready to render" : "Won't render usefully"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-muted-foreground",
						children: assessment.ok ? assessment.evidence : assessment.reason
					}),
					assessment.ok && assessment.data.warnings.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-1.5 flex flex-col gap-1",
						children: assessment.data.warnings.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "text-[11px] text-muted-foreground",
							children: w
						}, w))
					}) : null,
					assessment.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground",
						children: RENDER_REALITY
					}) : null
				]
			}) : null,
			demo === "lit" && assessment?.ok && scene ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					variant: "ghost",
					className: "h-8",
					onClick: () => {
						const file = exportGltf(scene);
						if (!file.ok) {
							setExported(file.reason);
							return;
						}
						const text = serialiseGltf(file.data);
						const blob = new Blob([text], { type: "model/gltf+json;charset=utf-8" });
						const url = URL.createObjectURL(blob);
						const anchor = document.createElement("a");
						anchor.href = url;
						anchor.download = "ocade-scene.gltf";
						anchor.click();
						URL.revokeObjectURL(url);
						setExported(`${file.evidence} ${(blob.size / 1024).toFixed(1)} kB glTF download requested.`);
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {
						className: "mr-1.5 h-3.5 w-3.5",
						"aria-hidden": true
					}), " Export as glTF"]
				}), exported ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					role: "status",
					className: "mt-1.5 text-[11px] text-muted-foreground",
					children: exported
				}) : null]
			}) : null,
			demo === "static_video" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				className: cn("mt-3 rounded-lg border p-3 text-xs", footage.ok ? "border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10" : "border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-center gap-1.5 font-medium text-foreground",
						children: [footage.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), footage.ok ? "Worth attempting" : "OCADE won't build a model from this"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-muted-foreground",
						children: footage.ok ? footage.evidence : footage.reason
					}),
					!footage.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1.5 border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium text-foreground",
							children: "Shoot instead: "
						}), footage.shootInstead]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground",
						children: RECONSTRUCTION_REALITY
					})
				]
			}) : null
		]
	});
}
/**
* Code edits, applied and undone for real.
*
* The whole point of this surface is the refusal: change the file so the
* patch's context no longer matches, press Apply, and OCADE declines rather
* than fuzzing the change into roughly the right place. That failure is
* invisible in review, so it has to be visible here.
*
* Undo is a real inverse patch applied to the current text, not a stashed copy.
*/
var START_FILE = [
	"function greet(name) {",
	"  return \"hi \" + name;",
	"}",
	""
].join("\n");
var START_DIFF = [
	"--- a/greet.js",
	"+++ b/greet.js",
	"@@ -1,3 +1,3 @@",
	" function greet(name) {",
	"-  return \"hi \" + name;",
	"+  return `Hello, ${name}`;",
	" }",
	""
].join("\n");
function PatchPanel() {
	const [file, setFile] = (0, import_react.useState)(START_FILE);
	const [diff, setDiff] = (0, import_react.useState)(START_DIFF);
	const [error, setError] = (0, import_react.useState)(null);
	const [receipt, setReceipt] = (0, import_react.useState)(null);
	const [inverse, setInverse] = (0, import_react.useState)(null);
	function apply() {
		setError(null);
		setReceipt(null);
		const parsed = parseUnifiedDiff(diff);
		if (!parsed.ok) {
			setError(parsed.reason);
			return;
		}
		const result = applyReversibly(file, parsed.data);
		if (!result.ok) {
			setError(result.reason);
			return;
		}
		setFile(result.data.content);
		setInverse(result.data.inverse);
		setReceipt(buildPatchReceipt(parsed.data, result.data, true));
	}
	function revert() {
		if (!inverse) return;
		const undone = applyPatch(file, inverse);
		if (!undone.ok) {
			setError(undone.reason);
			return;
		}
		setFile(undone.data.content);
		setInverse(null);
		setReceipt(null);
		setError(null);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "mb-1 flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileCodeCorner, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " Apply a code change, reversibly"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-3 text-xs text-muted-foreground",
				children: "The patch applies only where its context matches exactly. Edit the file below so it no longer does, and OCADE will refuse rather than put the change somewhere close — which is how an edit lands in the wrong function and still passes review."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					htmlFor: "patch-file",
					className: "text-xs font-medium text-foreground",
					children: "File"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					id: "patch-file",
					value: file,
					onChange: (e) => setFile(e.target.value),
					rows: 6,
					spellCheck: false,
					className: "mt-1 w-full resize-y rounded-md border border-border/60 bg-background/40 p-2 font-mono text-[11px] text-foreground"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					htmlFor: "patch-diff",
					className: "text-xs font-medium text-foreground",
					children: "Patch"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					id: "patch-diff",
					value: diff,
					onChange: (e) => setDiff(e.target.value),
					rows: 6,
					spellCheck: false,
					className: "mt-1 w-full resize-y rounded-md border border-border/60 bg-background/40 p-2 font-mono text-[11px] text-foreground"
				})] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					className: "h-8",
					onClick: apply,
					children: "Apply"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					variant: "ghost",
					className: "h-8",
					disabled: !inverse,
					onClick: revert,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Undo2, {
						className: "mr-1.5 h-3.5 w-3.5",
						"aria-hidden": true
					}), " Undo"]
				})]
			}),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				className: "mt-3 rounded-lg border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 p-3 text-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex items-center gap-1.5 font-medium text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
						className: "h-3.5 w-3.5",
						"aria-hidden": true
					}), " Not applied"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
					className: "mt-1 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground",
					children: error
				})]
			}) : null,
			receipt ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				className: cn("mt-3 rounded-lg border border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10 p-3 text-xs"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-center gap-1.5 font-medium text-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), " Applied, and reversible"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-muted-foreground",
						children: receipt.evidence
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-[10px] text-muted-foreground",
						children: "The undo wasn’t just produced — it was applied to the result and checked against the original before this was reported as done."
					})
				]
			}) : null
		]
	});
}
/**
* OCADE Confidence Governor (master plan §23.4).
*
* "Low-confidence actions require re-observation, a safer execution method, or
* user approval. Never let low confidence silently proceed."
*
* `assessAction` already produces a confidence score and a proceed/refuse
* boundary for the general case. This module is the part the plan asks for
* specifically: a gate that, when confidence is short of what an action needs,
* chooses the CHEAPEST honest remedy rather than either blocking outright or
* waving it through.
*
* The ordering of remedies is the whole design, and it runs cheapest-first:
*
*  1. **Re-route to a safer method.** If a more reliable method than the one
*     planned is available, use it — no human needed, and the result is more
*     trustworthy. (Reliability = lower `methodRank`.)
*  2. **Re-observe.** If the plan leaned on a stale or low-signal reading,
*     look again before deciding. Free, and often enough on its own.
*  3. **Ask the user.** Only when the machine can't raise its own confidence.
*
* THE RULE THAT CANNOT BE TUNED AWAY: a **mutating** action below its threshold
* NEVER resolves to "proceed". The remedy may be re-route or re-observe, but if
* neither is available it escalates to approval — it does not fall through to
* proceeding. A read may proceed at lower confidence because a wrong read is
* recoverable; a wrong write may not be.
*/
/**
* Confidence a decision needs before it may proceed unaided.
*
* A mutation needs more than a read. An UNVERIFIABLE mutation — one with no way
* to confirm the result afterwards — needs more still, because if the guess is
* wrong there is no signal that will ever say so.
*/
var READ_THRESHOLD = .6;
var MUTATE_THRESHOLD = .75;
var UNVERIFIABLE_MUTATE_THRESHOLD = .9;
function thresholdFor(mutating, verifyBy) {
	if (!mutating) return READ_THRESHOLD;
	return verifyBy === "none" ? UNVERIFIABLE_MUTATE_THRESHOLD : MUTATE_THRESHOLD;
}
/** A method strictly more reliable than the planned one, if available. */
function saferMethodThan(planned, available) {
	const plannedRank = methodRank(planned);
	return available.filter((m) => methodRank(m) < plannedRank).sort((a, b) => methodRank(a) - methodRank(b))[0] ?? null;
}
/**
* Decide what to do about a step's confidence.
*
* See the module header for the remedy ordering and the non-negotiable rule for
* mutations.
*/
function governConfidence(input) {
	if (input.availableMethods.length === 0) return {
		action: "refuse",
		reason: "No way to perform this action is available right now."
	};
	if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) return {
		action: "refuse",
		reason: "The confidence score is out of range, so it can't be trusted."
	};
	const threshold = thresholdFor(input.mutating, input.verifyBy);
	const pct = (n) => `${Math.round(n * 100)}%`;
	if (input.confidence >= threshold) return {
		action: "proceed",
		reason: `Confidence ${pct(input.confidence)} meets the ${pct(threshold)} bar for ${describeKind(input)}.`
	};
	const safer = saferMethodThan(input.plannedMethod, input.availableMethods);
	if (safer) return {
		action: "reroute",
		to: safer,
		reason: `Confidence ${pct(input.confidence)} is below the ${pct(threshold)} bar. A more reliable route (${safer}) is available, so OCADE will use that rather than guess.`
	};
	if (input.canReobserve) return {
		action: "reobserve",
		reason: `Confidence ${pct(input.confidence)} is below the ${pct(threshold)} bar. OCADE will look again before deciding, rather than act on a weak reading.`
	};
	if (!input.mutating) return {
		action: "proceed",
		reason: `Confidence ${pct(input.confidence)} is below the ${pct(threshold)} bar, but this only reads — OCADE will proceed and flag the result as low-confidence rather than block a recoverable action.`
	};
	return {
		action: "require_approval",
		reason: input.verifyBy === "none" ? `Confidence ${pct(input.confidence)} is below the ${pct(threshold)} bar, this changes state, and there's no way to verify the result afterwards. OCADE won't attempt it without your approval.` : `Confidence ${pct(input.confidence)} is below the ${pct(threshold)} bar for a change OCADE can't make more reliably on its own. It needs your approval before proceeding.`
	};
}
function describeKind(input) {
	if (!input.mutating) return "a read";
	return input.verifyBy === "none" ? "an unverifiable change" : "a change";
}
/** Strength ordering. Higher is stronger. */
var STRENGTH = {
	none: 0,
	cancel: 1,
	isolate: 2,
	restore: 3,
	undo: 4
};
/**
* Minimum recovery strength a risk tier demands.
*
* An irreversible change needs a way to put the world back (`restore`) or to
* never have touched it (`isolate` is not enough on its own for irreversible —
* see below). A read needs nothing.
*/
function requiredFor(risk, verifiable) {
	switch (risk) {
		case "read": return "none";
		case "low": return verifiable ? "cancel" : "isolate";
		case "high": return "restore";
		case "irreversible": return "restore";
	}
}
/**
* Decide whether a step's recovery is sufficient for its risk.
*
* Only READY options count: a checkpoint that was never taken is not recovery,
* and counting it would be exactly the after-the-fact surprise this exists to
* prevent.
*/
function assessRecovery(step) {
	if (!step.intent.trim()) return {
		ok: false,
		reason: "A recovery assessment needs a step intent."
	};
	const ready = step.options.filter((o) => o.ready);
	const best = ready.reduce((acc, o) => STRENGTH[o.kind] > STRENGTH[acc] ? o.kind : acc, "none");
	const required = requiredFor(step.risk, step.verifiable);
	const safe = STRENGTH[best] >= STRENGTH[required];
	if (step.risk === "irreversible") {
		const isolated = ready.some((o) => o.kind === "isolate");
		const restorable = STRENGTH[best] >= STRENGTH["restore"];
		if (!isolated || !restorable) return {
			ok: true,
			data: {
				intent: step.intent,
				best,
				required,
				safe: false,
				reason: "This step is irreversible. OCADE will only run it against a copy first (isolate) with a restore point in place. Without both, it refuses — there is no walking back an irreversible act that went straight to the real state."
			},
			evidence: `Irreversible step “${step.intent}” is NOT cleared: isolate=${isolated}, best=${best}.`
		};
	}
	return {
		ok: true,
		data: {
			intent: step.intent,
			best,
			required,
			safe,
			reason: safe ? `Recoverable by ${best}, which meets the ${required} this ${step.risk} step needs.` : `This ${step.risk} step needs at least ${required} recovery, but the strongest ready option is ${best}. OCADE won't run a change it can't walk back.`
		},
		evidence: safe ? `“${step.intent}” cleared: ${best} ≥ ${required}.` : `“${step.intent}” blocked: ${best} < ${required}.`
	};
}
/**
* Build a task ledger from its steps.
*
* Refuses malformed input rather than papering over it: a "done" step with no
* receipt is a contradiction (a receipt is what proves it happened), and
* emitting a ledger from it would launder an unproven claim into an official
* record.
*/
function buildTaskLedger(input) {
	if (!input.taskId.trim()) return {
		ok: false,
		reason: "A task ledger needs a task id."
	};
	if (!input.finalState.trim()) return {
		ok: false,
		reason: "A ledger must record the final state. OCADE won't certify a task whose end state it can't describe."
	};
	const started = Date.parse(input.startedAt);
	const finished = Date.parse(input.finishedAt);
	if (Number.isNaN(started) || Number.isNaN(finished)) return {
		ok: false,
		reason: "The ledger has an unreadable start or finish time."
	};
	if (finished < started) return {
		ok: false,
		reason: "This ledger finishes before it starts, so its timing can't be trusted."
	};
	for (const [i, step] of input.steps.entries()) {
		if (!Number.isInteger(step.attempts) || step.attempts < 0) return {
			ok: false,
			reason: `Step ${i + 1} has an impossible attempt count.`
		};
		if (step.status === "done" && step.attempts < 1) return {
			ok: false,
			reason: `Step ${i + 1} is marked done but was never attempted.`
		};
		if (step.status === "done" && step.receipt === null) return {
			ok: false,
			reason: `Step ${i + 1} (“${step.intent}”) is marked done but carries no receipt. A step with no evidence isn't done — OCADE won't record it as such.`
		};
		if (step.status === "skipped" && step.receipt !== null) return {
			ok: false,
			reason: `Step ${i + 1} is marked skipped but carries a receipt.`
		};
	}
	const ran = input.steps.filter((s) => s.status !== "skipped");
	const done = input.steps.filter((s) => s.status === "done");
	const failed = input.steps.filter((s) => s.status === "failed");
	const skipped = input.steps.filter((s) => s.status === "skipped");
	const unverified = done.filter((s) => s.receipt && !s.receipt.verified);
	const retried = input.steps.filter((s) => s.attempts > 1);
	const recovered = failed.filter((s) => s.recovery && s.recovery.action !== "none");
	const outcome = deriveOutcome({
		total: input.steps.length,
		ran: ran.length,
		failedUnrecovered: failed.length - recovered.length,
		failedRecovered: recovered.length,
		unverified: unverified.length
	});
	const summary = {
		total: input.steps.length,
		done: done.length,
		failed: failed.length,
		skipped: skipped.length,
		unverified: unverified.length,
		retried: retried.length,
		recovered: recovered.length
	};
	return {
		ok: true,
		data: {
			taskId: input.taskId,
			intent: input.intent,
			outcome,
			initialState: input.initialState,
			finalState: input.finalState,
			startedAt: input.startedAt,
			finishedAt: input.finishedAt,
			durationMs: finished - started,
			steps: input.steps,
			summary,
			headline: headlineFor$1(outcome, summary)
		},
		evidence: `Ledger for ${input.taskId}: ${outcome}, ${summary.done}/${summary.total} steps verified-done.`
	};
}
function deriveOutcome(x) {
	if (x.total === 0 || x.ran === 0) return "empty";
	if (x.failedUnrecovered > 0) return "failed";
	if (x.unverified > 0 || x.failedRecovered > 0) return "partial";
	return "succeeded";
}
function headlineFor$1(outcome, s) {
	switch (outcome) {
		case "succeeded": return `All ${s.done} step${s.done === 1 ? "" : "s"} completed and verified${s.retried > 0 ? `, ${s.retried} after a retry` : ""}.`;
		case "partial": {
			const reasons = [];
			if (s.unverified > 0) reasons.push(`${s.unverified} couldn't be verified`);
			if (s.recovered > 0) reasons.push(`${s.recovered} failed and recovered`);
			return `${s.done} of ${s.total} steps done — ${reasons.join(", ")}. Treat the result as unconfirmed.`;
		}
		case "failed": return `${s.failed} step${s.failed === 1 ? "" : "s"} failed${s.recovered > 0 ? `, ${s.recovered} recovered` : ""}. The task did not complete.`;
		case "empty": return "Nothing ran, so there is nothing to certify.";
	}
}
/** Canonical JSON for the receipt artifact. Stable key order, pretty-printed. */
function serialiseLedger(ledger) {
	return JSON.stringify(ledger, null, 2);
}
/**
* Persist a task ledger as a first-class artifact.
*
* The artifact's provenance carries the derived outcome: a `partial` or
* `failed` ledger is stored `verified: false`, so it is labelled NOT CONFIRMED
* everywhere the artifact appears — the ledger's own honesty flows through into
* the store's.
*/
async function saveLedgerArtifact(ledger) {
	return saveArtifact({
		name: `Receipt — ${ledger.intent || ledger.taskId}`,
		kind: "receipt",
		content: serialiseLedger(ledger),
		provenance: {
			producedBy: `ocade.task:${ledger.taskId}`,
			verified: ledger.outcome === "succeeded",
			evidence: ledger.headline
		}
	});
}
var SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,199}$/i;
var ROUTES = /* @__PURE__ */ new Set([
	"api",
	"plugin",
	"mcp",
	"cli",
	"file",
	"dom",
	"accessibility",
	"native",
	"vision",
	"input"
]);
var RISKS = /* @__PURE__ */ new Set([
	"read",
	"low",
	"medium",
	"high",
	"protected"
]);
var MAX_TIMEOUT_MS = 600 * 1e3;
var MAX_RETRIES = 3;
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isSafeId(value) {
	return typeof value === "string" && SAFE_ID.test(value);
}
function isBoundedText(value, max = 2e3) {
	return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}
function isJsonValue(value, depth = 0) {
	if (depth > 12) return false;
	if (value === null || typeof value === "string" || typeof value === "boolean") return true;
	if (typeof value === "number") return Number.isFinite(value);
	if (Array.isArray(value)) return value.length <= 1e3 && value.every((item) => isJsonValue(item, depth + 1));
	if (!isRecord(value) || Object.keys(value).length > 1e3) return false;
	return Object.values(value).every((item) => isJsonValue(item, depth + 1));
}
/**
* Key-order-independent serialisation.
*
* The idempotency key must not change because two callers built the same
* arguments object in a different order — that would turn one logical action
* into two, which is the exact failure an idempotency key exists to prevent.
*/
function stableJson(value) {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
	return JSON.stringify(value);
}
/** Stable correlation key, not a cryptographic authorization primitive. */
function deriveIdempotencyKey(input) {
	const text = stableJson(input);
	let hash = 2166136261;
	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return `ocade:${input.taskId}:${input.stepId}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
function validAppIdentity(app) {
	return isRecord(app) && isSafeId(app.appId) && [
		app.executable,
		app.product,
		app.version,
		app.windowId,
		app.browserOrigin
	].every((value) => value === void 0 || typeof value === "string" && value.length <= 2e3);
}
/** Public structural validation used by every production execution path. */
function validateOcadeActionRequest(request) {
	if (!isSafeId(request.actionId) || !isSafeId(request.taskId) || !isSafeId(request.stepId)) return "Action, task and step ids must be bounded safe identifiers.";
	if (!validAppIdentity(request.appIdentity)) return "The application identity is invalid.";
	if (!isSafeId(request.capability) || !isSafeId(request.requiredPermission)) return "Capability and permission ids must be bounded safe identifiers.";
	if (!ROUTES.has(request.route) || !RISKS.has(request.risk)) return "The route or risk is unknown.";
	if (!isRecord(request.arguments) || !isJsonValue(request.arguments)) return "Action arguments must be bounded JSON.";
	if (!Number.isInteger(request.timeoutMs) || request.timeoutMs < 1 || request.timeoutMs > MAX_TIMEOUT_MS) return "The action timeout is outside the bounded range.";
	if (!Number.isInteger(request.retryBudget) || request.retryBudget < 0 || request.retryBudget > MAX_RETRIES) return "The retry budget is outside the bounded range.";
	if (!isBoundedText(request.idempotencyKey, 500)) return "The idempotency key is invalid.";
	if (!Array.isArray(request.expectedPostconditions) || request.expectedPostconditions.length === 0) return "At least one expected postcondition is required.";
	const postconditionIds = /* @__PURE__ */ new Set();
	for (const postcondition of request.expectedPostconditions) {
		if (!isSafeId(postcondition.id) || !isBoundedText(postcondition.kind) || !isBoundedText(postcondition.selector) || ![
			"equals",
			"exists",
			"contains",
			"sha256"
		].includes(postcondition.operator) || !isJsonValue(postcondition.expected) || postconditionIds.has(postcondition.id)) return "A postcondition is malformed or duplicated.";
		postconditionIds.add(postcondition.id);
	}
	if (!Array.isArray(request.verificationPlan) || request.verificationPlan.length === 0) return "At least one independent verification step is required.";
	const covered = /* @__PURE__ */ new Set();
	for (const step of request.verificationPlan) {
		if (!isSafeId(step.id) || !isSafeId(step.observerId) || !ROUTES.has(step.route) || !Array.isArray(step.postconditionIds) || step.postconditionIds.length === 0 || step.postconditionIds.some((id) => !postconditionIds.has(id))) return "A verification step is malformed or references an unknown postcondition.";
		step.postconditionIds.forEach((id) => covered.add(id));
	}
	if ([...postconditionIds].some((id) => !covered.has(id))) return "Every expected postcondition must have an observation route.";
	if (request.risk === "protected") return "Protected actions are never executable.";
	if (request.risk === "medium" || request.risk === "high") {
		const adequateKinds = request.risk === "high" ? /* @__PURE__ */ new Set(["restore", "undo"]) : /* @__PURE__ */ new Set([
			"isolate",
			"restore",
			"undo"
		]);
		if (!request.rollbackPlan?.some((step) => step.ready && adequateKinds.has(step.kind))) return "Risky mutations require a ready rollback or recovery step.";
	}
	return null;
}
/**
* OCADE governed task run — the pieces, composed.
*
* The §23 systems (Rehearsal, Confidence Governor, Recovery Graph) and the
* Evidence Ledger each exist and are tested in isolation. This is the pipeline
* that runs them together, in the order the mutation contract (§9.1) demands,
* for one task:
*
*   plan (preconditions & scope) → govern confidence → require recovery →
*   execute → verify (receipt) → next step … → emit one Evidence Ledger artifact
*
* It is ADDITIVE: it imports the verified modules and modifies none of them.
*
* HALT-ON-BLOCK. If a step can't safely run — unplannable, low confidence with
* no machine remedy, or no adequate recovery — the run STOPS there and every
* later step is recorded as skipped. It does not press on: reaching a later
* step means the earlier ones already changed the world, so continuing past a
* block is how a task ends up half-done with no way back. The stop is honest,
* recorded, and the ledger says exactly where and why.
*/
/**
* Run a task through the full governed pipeline and produce a ledger.
*
* Does not save the ledger artifact itself — `runAndRecord` does that — so this
* function stays pure enough to test without touching storage.
*/
async function runGovernedTask(input) {
	if (input.steps.length === 0) return {
		ok: false,
		reason: "A task needs at least one step."
	};
	const startedAt = (input.now ?? /* @__PURE__ */ new Date()).toISOString();
	const ledgerSteps = [];
	let scope = input.scope;
	let haltedAt = -1;
	let haltReason = null;
	for (let i = 0; i < input.steps.length; i++) {
		const step = input.steps[i];
		if (haltedAt !== -1) {
			ledgerSteps.push({
				intent: labelOf(step),
				receipt: null,
				status: "skipped",
				attempts: 0
			});
			continue;
		}
		const plan = planStep({
			action: step.action,
			capability: step.capability,
			app: step.app,
			packs: input.packs,
			scope,
			health: input.health,
			availableMethods: input.availableMethods,
			recording: input.recording,
			remainingSteps: input.steps.length - i,
			now: input.now
		});
		if (plan.status !== "ready") {
			haltedAt = i;
			haltReason = plan.reason;
			ledgerSteps.push({
				intent: labelOf(step),
				receipt: null,
				status: "failed",
				attempts: 0
			});
			continue;
		}
		const contractIssue = validateOcadeActionRequest(governedActionContract(input.taskId, i, step, plan.plan.method));
		if (contractIssue) {
			haltedAt = i;
			haltReason = `The canonical action contract refused this step: ${contractIssue}`;
			ledgerSteps.push({
				intent: plan.plan.intent,
				receipt: null,
				status: "failed",
				attempts: 0
			});
			continue;
		}
		const decision = governConfidence({
			confidence: plan.plan.confidence,
			mutating: step.capability.mutating,
			verifyBy: step.capability.verifyBy,
			plannedMethod: plan.plan.method,
			availableMethods: step.capability.methods.filter((method) => input.availableMethods.includes(method) && !plan.plan.routedAround.includes(method)),
			canReobserve: step.canReobserve
		});
		if (decision.action !== "proceed") {
			haltedAt = i;
			haltReason = decision.reason;
			ledgerSteps.push({
				intent: plan.plan.intent,
				receipt: null,
				status: "failed",
				attempts: 0
			});
			continue;
		}
		const recovery = assessRecovery({
			intent: plan.plan.intent,
			risk: step.risk,
			verifiable: step.capability.verifyBy !== "none",
			options: step.recovery
		});
		if (!recovery.ok || !recovery.data.safe) {
			haltedAt = i;
			haltReason = recovery.ok ? recovery.data.reason : recovery.reason;
			ledgerSteps.push({
				intent: plan.plan.intent,
				receipt: null,
				status: "failed",
				attempts: 0
			});
			continue;
		}
		const run = await runPlannedStep(input.registry, plan.plan, input.now);
		if (run.status === "unavailable") {
			haltedAt = i;
			haltReason = run.reason;
			ledgerSteps.push({
				intent: plan.plan.intent,
				receipt: null,
				status: "failed",
				attempts: 1
			});
			continue;
		}
		if (run.status === "failed") {
			haltedAt = i;
			haltReason = run.reason;
			ledgerSteps.push({
				intent: plan.plan.intent,
				receipt: run.receipt,
				status: "failed",
				attempts: 1
			});
			continue;
		}
		scope = plan.plan.scope;
		ledgerSteps.push({
			intent: plan.plan.intent,
			receipt: run.receipt,
			status: "done",
			attempts: 1
		});
	}
	const finishedAt = new Date((input.now ?? /* @__PURE__ */ new Date()).getTime()).toISOString();
	const ledger = buildTaskLedger({
		taskId: input.taskId,
		intent: input.intent,
		initialState: input.initialState,
		finalState: haltedAt === -1 ? input.finalState : `Stopped at step ${haltedAt + 1}. ${describeReached(ledgerSteps)}`,
		steps: ledgerSteps,
		startedAt,
		finishedAt
	});
	if (!ledger.ok) return {
		ok: false,
		reason: ledger.reason
	};
	return {
		ok: true,
		data: {
			ledger: ledger.data,
			haltedAt,
			haltReason,
			receiptRecording: { status: "not_requested" }
		},
		evidence: haltedAt === -1 ? `Ran ${input.steps.length} steps; ${ledger.data.headline}` : `Halted at step ${haltedAt + 1}: ${haltReason}`
	};
}
/**
* Run the task and persist its ledger as an Evidence Ledger artifact.
*
* The artifact's verified flag follows the ledger's derived outcome, so a
* halted or partial run is stored NOT CONFIRMED — the honesty flows end to end.
*/
async function runAndRecord(input) {
	const run = await runGovernedTask(input);
	if (!run.ok) return run;
	const saved = await saveLedgerArtifact(run.data.ledger);
	return {
		ok: true,
		data: {
			...run.data,
			receiptRecording: saved.ok ? {
				status: "saved",
				evidence: saved.evidence
			} : {
				status: "failed",
				reason: saved.reason
			}
		},
		evidence: saved.ok ? `${run.evidence} Receipt saved: ${saved.evidence}` : `${run.evidence} Receipt not saved: ${saved.reason}`
	};
}
function labelOf(step) {
	return step.capability.label;
}
function describeReached(steps) {
	const done = steps.filter((s) => s.status === "done").length;
	return done === 0 ? "Nothing was changed." : `${done} step${done === 1 ? "" : "s"} completed before the stop.`;
}
function governedActionContract(taskId, index, step, method) {
	const stepId = `step-${index + 1}`;
	const route = {
		official_api: "api",
		adapter: "plugin",
		accessibility: "accessibility",
		dom: "dom",
		file: "file",
		cli: "cli",
		vision_input: "vision"
	};
	const risk = {
		read: "read",
		low: "low",
		high: "high",
		irreversible: "high"
	};
	const arguments_ = step.action;
	const postconditionId = `${stepId}:verified`;
	return {
		actionId: `${taskId}:${stepId}`,
		taskId,
		stepId,
		appIdentity: {
			appId: step.app.appId,
			product: step.app.displayName,
			...step.app.version ? { version: step.app.version } : {}
		},
		capability: step.capability.id,
		route: route[method],
		arguments: arguments_,
		risk: risk[step.risk],
		requiredPermission: step.action.kind,
		expectedPostconditions: [{
			id: postconditionId,
			kind: step.capability.verifyBy,
			selector: step.capability.id,
			operator: "equals",
			expected: true
		}],
		verificationPlan: [{
			id: `${stepId}:observe`,
			observerId: "executor-registry-verifier",
			route: route[method],
			postconditionIds: [postconditionId]
		}],
		...step.recovery.length > 0 ? { rollbackPlan: step.recovery.map((option, recoveryIndex) => ({
			id: `${stepId}:recovery-${recoveryIndex + 1}`,
			kind: option.kind === "none" ? "cancel" : option.kind,
			description: option.plan,
			ready: option.ready
		})) } : {},
		timeoutMs: 3e4,
		retryBudget: 0,
		idempotencyKey: deriveIdempotencyKey({
			taskId,
			stepId,
			capability: step.capability.id,
			arguments: arguments_
		})
	};
}
/**
* The whole governed pipeline, on one button.
*
* plan → govern confidence → require recovery → execute → receipt → save as an
* Evidence Ledger artifact. Every number shown comes from running the real
* orchestrator against the real data executors — nothing is illustrative.
*
* The second button demonstrates halt-on-block: the same task under an approval
* that doesn't cover it stops at step one and records why, rather than pressing
* on. Showing the stop is the point.
*/
var CSV$1 = "region,amount\nNorth,120\nSouth,80\nEast,40";
var parseCap = (registry) => registry.get("ocade.data")?.capabilities.find((c) => c.id === "data.parse_csv") ?? null;
async function runDemo(granted) {
	const registry = new PackRegistry();
	const pack = registry.get("ocade.data");
	const capability = parseCap(registry);
	if (!pack || !capability) return { error: "The data pack isn't available." };
	const step = {
		action: {
			kind: "file.open",
			path: "memory/table"
		},
		capability,
		app: {
			appId: pack.appId,
			displayName: pack.displayName,
			version: "1.0"
		},
		risk: "read",
		recovery: [],
		canReobserve: false
	};
	const result = await runAndRecord({
		taskId: `demo-${Date.now()}`,
		intent: "Read the pasted data",
		initialState: "CSV pasted, nothing parsed",
		finalState: "CSV parsed and its shape reported",
		steps: [step],
		packs: registry.list(),
		scope: createTaskScope({
			id: "demo",
			summary: granted ? "Read the pasted data" : "Something else entirely",
			capabilities: granted ? ["file.open"] : ["clipboard.read"],
			paths: ["memory"]
		}),
		health: /* @__PURE__ */ new Map(),
		availableMethods: ["file"],
		recording: "video_off",
		registry: createDefaultExecutors(() => ({ text: CSV$1 }))
	});
	if (!result.ok) return { error: result.reason };
	return result.data;
}
function GovernedRunPanel() {
	const [result, setResult] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	const [running, setRunning] = (0, import_react.useState)(false);
	async function run(granted) {
		setRunning(true);
		setError(null);
		setResult(null);
		const outcome = await runDemo(granted);
		if ("error" in outcome) setError(outcome.error);
		else setResult(outcome);
		setRunning(false);
	}
	const halted = result && result.haltedAt !== -1;
	const receiptFailed = result?.receiptRecording.status === "failed";
	const fullyRecorded = result?.ledger.outcome === "succeeded" && result.receiptRecording.status === "saved";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "mb-1 flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GitBranch, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " Run a governed task"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-3 text-xs text-muted-foreground",
				children: "One button runs the whole contract: plan and check the approval, govern the confidence, require a recovery path, execute, verify, and save a receipt to Artifacts. The second runs the same task under an approval that doesn’t cover it — and stops at the first step rather than pressing on."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					className: "h-8",
					disabled: running,
					onClick: () => void run(true),
					children: [running ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
						className: "mr-1.5 h-3.5 w-3.5 animate-spin",
						"aria-hidden": true
					}) : null, "Run it"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "ghost",
					className: "h-8",
					disabled: running,
					onClick: () => void run(false),
					children: "Run one that isn’t allowed"
				})]
			}),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				role: "status",
				className: "mt-3 text-xs text-[color:var(--state-warning)]",
				children: error
			}) : null,
			result ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				className: cn("mt-3 rounded-lg border p-3 text-xs", fullyRecorded ? "border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10" : "border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-center gap-1.5 font-medium text-foreground",
						children: [fullyRecorded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), result.ledger.headline]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 flex flex-col gap-1",
						children: result.ledger.steps.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center gap-2 text-[11px] text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: cn("inline-block h-1.5 w-1.5 rounded-full", s.status === "done" ? "bg-[color:var(--state-success)]" : s.status === "failed" ? "bg-[color:var(--state-warning)]" : "bg-muted-foreground/40"),
									"aria-hidden": true
								}),
								s.intent,
								" — ",
								s.status
							]
						}, i))
					}),
					receiptFailed ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1.5 border-t border-border/60 pt-1.5 text-[11px] text-[color:var(--state-warning)]",
						children: [
							"The task result is shown above, but its receipt could not be saved:",
							" ",
							result.receiptRecording.status === "failed" ? result.receiptRecording.reason : ""
						]
					}) : halted ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1.5 border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground",
						children: [
							"Stopped at step ",
							result.haltedAt + 1,
							": ",
							result.haltReason
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1.5 border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground",
						children: result.receiptRecording.status === "saved" ? "A receipt for this run was saved to Artifacts, with its provenance and a fingerprint." : "No receipt save was requested for this run."
					})
				]
			}) : null
		]
	});
}
var ConversationGraph = class {
	nodes = /* @__PURE__ */ new Map();
	children = /* @__PURE__ */ new Map();
	activeLeaf = null;
	counter = 0;
	nextId() {
		return `n${++this.counter}`;
	}
	/** Append a message as a child of the current active leaf and make it active. */
	append(role, text, now = /* @__PURE__ */ new Date()) {
		if (!text.trim()) return {
			ok: false,
			reason: "A message can't be empty."
		};
		const parentId = this.activeLeaf;
		const node = {
			id: this.nextId(),
			parentId,
			role,
			text,
			createdAt: now.toISOString()
		};
		this.nodes.set(node.id, node);
		if (parentId) this.children.set(parentId, [...this.children.get(parentId) ?? [], node.id]);
		this.activeLeaf = node.id;
		return {
			ok: true,
			data: node,
			evidence: `Appended ${role} message ${node.id}.`
		};
	}
	/**
	* Edit a user message and resend: forks a NEW child of the edited message's
	* PARENT, rather than changing the original. The original and its replies
	* stay intact on their own branch; the new edit starts a fresh branch that
	* becomes active.
	*/
	editAndResend(messageId, newText, now = /* @__PURE__ */ new Date()) {
		const original = this.nodes.get(messageId);
		if (!original) return {
			ok: false,
			reason: "No such message to edit."
		};
		if (original.role !== "user") return {
			ok: false,
			reason: "Only your own messages can be edited and resent."
		};
		if (!newText.trim()) return {
			ok: false,
			reason: "The edited message can't be empty."
		};
		const node = {
			id: this.nextId(),
			parentId: original.parentId,
			role: "user",
			text: newText,
			createdAt: now.toISOString()
		};
		this.nodes.set(node.id, node);
		if (original.parentId) this.children.set(original.parentId, [...this.children.get(original.parentId) ?? [], node.id]);
		this.activeLeaf = node.id;
		return {
			ok: true,
			data: node,
			evidence: `Edited ${messageId} into a new branch ${node.id}; the original is preserved.`
		};
	}
	/**
	* Regenerate an assistant reply: a new assistant child of the SAME parent,
	* so the two answers to the same question sit side by side as alternatives.
	*/
	regenerate(assistantMessageId, newText, now = /* @__PURE__ */ new Date()) {
		const original = this.nodes.get(assistantMessageId);
		if (!original) return {
			ok: false,
			reason: "No such message to regenerate."
		};
		if (original.role !== "assistant") return {
			ok: false,
			reason: "Only an assistant reply can be regenerated."
		};
		if (original.parentId === null) return {
			ok: false,
			reason: "This reply has no prompt to regenerate from."
		};
		const node = {
			id: this.nextId(),
			parentId: original.parentId,
			role: "assistant",
			text: newText,
			createdAt: now.toISOString()
		};
		this.nodes.set(node.id, node);
		this.children.set(original.parentId, [...this.children.get(original.parentId) ?? [], node.id]);
		this.activeLeaf = node.id;
		return {
			ok: true,
			data: node,
			evidence: `Regenerated ${assistantMessageId} as alternative ${node.id}.`
		};
	}
	/** Move the active thread to a specific node (navigating between branches). */
	switchTo(messageId) {
		const node = this.nodes.get(messageId);
		if (!node) return {
			ok: false,
			reason: "No such message."
		};
		this.activeLeaf = messageId;
		return {
			ok: true,
			data: node,
			evidence: `Active thread now ends at ${messageId}.`
		};
	}
	/**
	* The active thread: the path from root to the active leaf, and NOTHING else.
	* This is the property the whole model exists to guarantee — no sibling
	* branch ever leaks in.
	*/
	activeThread() {
		const path = [];
		let cursor = this.activeLeaf;
		const guard = /* @__PURE__ */ new Set();
		while (cursor) {
			if (guard.has(cursor)) break;
			guard.add(cursor);
			const node = this.nodes.get(cursor);
			if (!node) break;
			path.push(node);
			cursor = node.parentId;
		}
		return path.reverse();
	}
	/**
	* Alternatives that share a parent with the given node (its siblings + it).
	*
	* Root-level branches (created by editing the very first message) have no
	* parent to group them, so parent-less nodes are treated as siblings of each
	* other — otherwise editing the opening message would hide the alternative.
	*/
	branchesAt(messageId) {
		const node = this.nodes.get(messageId);
		if (!node) return [];
		if (node.parentId === null) return [...this.nodes.values()].filter((n) => n.parentId === null);
		return (this.children.get(node.parentId) ?? []).map((id) => this.nodes.get(id)).filter(Boolean);
	}
	size() {
		return this.nodes.size;
	}
	activeLeafId() {
		return this.activeLeaf;
	}
};
var DEFAULT_MAX_CHARACTERS = 1e6;
var DEFAULT_MAX_CHUNKS = 4096;
var MAX_ERROR_CHARACTERS = 500;
/**
* The disclosure line for a snapshot, in one place so the class method and any
* UI render the identical wording (no duplicated rule to drift).
*/
function streamDisclosure(snap) {
	switch (snap.status) {
		case "complete": return "";
		case "stopped": return "You stopped this reply — it's a fragment, not a finished answer.";
		case "errored": return `The connection dropped before this reply finished (${snap.error ?? "unknown error"}). What's shown is incomplete.`;
		case "streaming": return "Still generating…";
		case "idle": return "";
	}
}
var ResponseStream = class {
	status = "idle";
	buffer = "";
	chunkCount = 0;
	errorReason;
	maxCharacters;
	maxChunks;
	constructor(options = {}) {
		this.maxCharacters = options.maxCharacters ?? DEFAULT_MAX_CHARACTERS;
		this.maxChunks = options.maxChunks ?? DEFAULT_MAX_CHUNKS;
		if (!Number.isInteger(this.maxCharacters) || this.maxCharacters < 1) throw new Error("Stream character capacity must be a positive integer.");
		if (!Number.isInteger(this.maxChunks) || this.maxChunks < 1) throw new Error("Stream chunk capacity must be a positive integer.");
	}
	/** Begin streaming. Only valid from idle. */
	start() {
		if (this.status !== "idle") return {
			ok: false,
			reason: `Can't start a stream that is already ${this.status}.`
		};
		this.status = "streaming";
		return {
			ok: true,
			data: this.snapshot()
		};
	}
	/**
	* Append a chunk. Rejected once the stream has ended — a late chunk after
	* stop/complete/error must not silently extend a finished answer.
	*/
	push(chunk) {
		if (this.status !== "streaming") return {
			ok: false,
			reason: `Can't add to a stream that is ${this.status}.`
		};
		if (typeof chunk !== "string" || chunk.length === 0) return {
			ok: false,
			reason: "An empty stream chunk was refused."
		};
		if (this.chunkCount >= this.maxChunks) return this.exceedBudget(`The response exceeded its ${this.maxChunks}-chunk budget.`);
		if (this.buffer.length + chunk.length > this.maxCharacters) return this.exceedBudget(`The response exceeded its ${this.maxCharacters}-character memory budget.`);
		this.buffer += chunk;
		this.chunkCount++;
		return {
			ok: true,
			data: this.snapshot()
		};
	}
	/**
	* The model finished normally. Only then is the content NOT truncated.
	*/
	complete() {
		if (this.status !== "streaming") return {
			ok: false,
			reason: `Can't complete a stream that is ${this.status}.`
		};
		this.status = "complete";
		return {
			ok: true,
			data: this.snapshot()
		};
	}
	/**
	* The user stopped generation. Whatever arrived is kept but is a fragment —
	* `truncated` stays true.
	*/
	stop() {
		if (this.status !== "streaming") return {
			ok: false,
			reason: `Can't stop a stream that is ${this.status}.`
		};
		this.status = "stopped";
		return {
			ok: true,
			data: this.snapshot()
		};
	}
	/** The connection failed. Partial content is kept, marked incomplete. */
	fail(reason) {
		if (this.status !== "streaming") return {
			ok: false,
			reason: `Can't fail a stream that is ${this.status}.`
		};
		this.status = "errored";
		this.errorReason = typeof reason === "string" && reason.trim() ? reason.trim().slice(0, MAX_ERROR_CHARACTERS) : "unknown error";
		return {
			ok: true,
			data: this.snapshot()
		};
	}
	snapshot() {
		return {
			status: this.status,
			content: this.buffer,
			truncated: this.status !== "complete",
			...this.errorReason ? { error: this.errorReason } : {},
			chunks: this.chunkCount
		};
	}
	/**
	* The line shown beneath the message, telling the reader what they're looking
	* at. A stopped or errored answer says so; a complete one needs no caveat.
	*/
	disclosure() {
		return streamDisclosure(this.snapshot());
	}
	/** Whether a retry is offered — only for the non-clean endings. */
	canRetry() {
		return this.status === "stopped" || this.status === "errored";
	}
	exceedBudget(reason) {
		this.status = "errored";
		this.errorReason = reason;
		return {
			ok: false,
			reason
		};
	}
};
/**
* The UI surface for OCADE's conversation branching and streaming controls —
* so those state machines are wired into a real screen, not just library code.
*
* Everything here runs on-device against the real `ConversationGraph` and
* `ResponseStream`. It is deliberately NOT calling a cloud model: the streamed
* text is a fixed local sample, and the panel says so, because demonstrating
* the stop-control must not itself pretend to be a live generation.
*
* What it shows honestly:
*  - editing a question forks a branch; both versions remain, and you can see
*    how many alternatives exist at a point;
*  - stopping a stream yields a FRAGMENT, labelled as one — never a finished
*    answer.
*/
var SAMPLE = "Here is a worked answer that arrives in several pieces so you can stop it midway.";
var CHUNKS = SAMPLE.match(/\S+\s*/g) ?? [SAMPLE];
function seed() {
	const g = new ConversationGraph();
	g.append("user", "Summarise the quarterly numbers.");
	g.append("assistant", "Revenue rose 12%, costs held flat.");
	return g;
}
function ConversationControls() {
	const graph = (0, import_react.useMemo)(() => seed(), []);
	const [, bump] = (0, import_react.useState)(0);
	const rerender = () => bump((n) => n + 1);
	const thread = graph.activeThread();
	const lastAssistant = [...thread].reverse().find((m) => m.role === "assistant");
	const firstUser = thread.find((m) => m.role === "user");
	function regenerate() {
		if (!lastAssistant) return;
		graph.regenerate(lastAssistant.id, "Revenue up 12%; margins steady; headcount unchanged.");
		rerender();
	}
	function editQuestion() {
		if (!firstUser) return;
		graph.editAndResend(firstUser.id, "Summarise the quarterly numbers and the outlook.");
		graph.append("assistant", "Q3 up 12%; guidance raised for Q4.");
		rerender();
	}
	const branchesAtAssistant = lastAssistant ? graph.branchesAt(lastAssistant.id) : [];
	const [stream, setStream] = (0, import_react.useState)(null);
	const [snap, setSnap] = (0, import_react.useState)(null);
	const [chunkIndex, setChunkIndex] = (0, import_react.useState)(0);
	function startStream() {
		const s = new ResponseStream();
		s.start();
		setStream(s);
		setChunkIndex(0);
		setSnap(s.snapshot());
	}
	function pushNext() {
		if (!stream) return;
		const next = CHUNKS[chunkIndex];
		if (next === void 0) {
			const done = stream.complete();
			if (done.ok) setSnap(done.data);
			return;
		}
		const r = stream.push(next);
		if (r.ok) setSnap(r.data);
		setChunkIndex((i) => i + 1);
	}
	function stopStream() {
		if (!stream) return;
		const r = stream.stop();
		if (r.ok) setSnap(r.data);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "mb-1 flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GitBranch, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " Conversation controls"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-3 text-xs text-muted-foreground",
				children: "Branching and streaming, running on this device against OCADE’s real conversation model. The streamed text below is a fixed local sample — this panel demonstrates the controls, it isn’t calling a model."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg border border-border/60 p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
					children: "Active thread"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "flex flex-col gap-1",
					children: thread.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-start gap-2 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] uppercase", m.role === "user" ? "bg-secondary text-muted-foreground" : "bg-[color:var(--state-success)]/15 text-[color:var(--state-success)]"),
							children: m.role
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-foreground",
							children: m.text
						})]
					}, m.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					variant: "ghost",
					className: "h-8",
					onClick: regenerate,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, {
						className: "mr-1.5 h-3.5 w-3.5",
						"aria-hidden": true
					}), " Regenerate answer"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					variant: "ghost",
					className: "h-8",
					onClick: editQuestion,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, {
						className: "mr-1.5 h-3.5 w-3.5",
						"aria-hidden": true
					}), " Edit & resend question"]
				})]
			}),
			branchesAtAssistant.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				role: "status",
				className: "mt-2 flex items-center gap-1 text-[11px] text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, {
						className: "h-3 w-3",
						"aria-hidden": true
					}),
					branchesAtAssistant.length,
					" versions of this answer — both kept; the original isn’t overwritten."
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 rounded-lg border border-border/60 p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
						children: "Streaming & stop"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								className: "h-7 text-[11px]",
								onClick: startStream,
								children: "Start"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "ghost",
								className: "h-7 text-[11px]",
								disabled: snap?.status !== "streaming",
								onClick: pushNext,
								children: "Next chunk"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								variant: "ghost",
								className: "h-7 text-[11px]",
								disabled: snap?.status !== "streaming",
								onClick: stopStream,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, {
									className: "mr-1.5 h-3 w-3",
									"aria-hidden": true
								}), " Stop"]
							})
						]
					}),
					snap && snap.status !== "idle" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						role: "status",
						className: "mt-2 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-foreground",
							children: snap.content || "…"
						}), snap.truncated && snap.status !== "streaming" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[11px] text-[color:var(--state-warning)]",
							children: streamDisclosure(snap)
						}) : snap.status === "complete" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[11px] text-[color:var(--state-success)]",
							children: "Complete."
						}) : null]
					}) : null
				]
			})
		]
	});
}
var CAD_ROUTE_ORDER = [
	"official_api",
	"plugin",
	"macro",
	"script",
	"cli",
	"project_file",
	"accessibility",
	"vision_input"
];
var ENGINEERING_RUNTIME_BOUNDARY = "CAD/CAE source and deterministic fixtures are available, but no installed licensed CAD application or solver, real engineering model, solver result file, or independently reopened live export has been validated here. Fixture metrics can test the contract but can never support an engineering conclusion.";
var INVARIANTS = [
	"Original project stays byte-identical; work occurs in a verified duplicate",
	"Units and every dimension, material, contact, load and tolerance are compared",
	"Rebuild, constraints, references, warnings and errors must pass",
	"STEP, STL, DXF or DWG bytes are hashed and independently reopened",
	"Fixture solver metrics can never become an engineering conclusion"
];
/** Honest source-capability view; no execution control exists before pairing. */
function EngineeringControlPanel() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
					className: "flex items-center gap-2 text-sm font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DraftingCompass, {
						className: "h-4 w-4",
						"aria-hidden": true
					}), " CAD and engineering control"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Duplicate-first CAD/CAE work with locked assumptions, rebuild proof, verified exchange files and solver-result boundaries."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 px-2 py-1 text-[10px] font-medium",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, {
						className: "h-3 w-3",
						"aria-hidden": true
					}), " Licensed app required"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid gap-3 md:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-lg border border-border/60 bg-secondary/20 p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "flex items-center gap-1.5 text-xs font-medium",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gauge, {
								className: "h-3.5 w-3.5",
								"aria-hidden": true
							}), " Preferred control routes"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
							className: "mt-2 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground",
							children: CAD_ROUTE_ORDER.map((route, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
								index + 1,
								". ",
								route.replaceAll("_", " ")
							] }, route))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-[10px] text-muted-foreground",
							children: "Vision/input is never accepted as the sole mutating engineering route."
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-lg border border-border/60 bg-secondary/20 p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-center gap-1.5 text-xs font-medium",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileCheckCorner, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), " Non-negotiable evidence"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 space-y-1 text-[11px] text-muted-foreground",
						children: INVARIANTS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["• ", item] }, item))
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 rounded-lg border border-border/60 bg-background/40 p-2 text-[11px] text-muted-foreground",
				children: ENGINEERING_RUNTIME_BOUNDARY
			})
		]
	});
}
var GB$2 = 1024 ** 3;
var MIN_CHECKPOINT_MS = 3e4;
var MAX_CHECKPOINT_MS = 5 * 6e4;
var MEMORY_WARNING_RATIO = .8;
var STORAGE_RESERVE_RATIO = .1;
var RESOURCE_GOVERNOR_RUNTIME_BOUNDARY = "Synthetic profiles verify policy deterministically. Host hardware, driver, model, renderer and solver evidence must come from an authenticated native probe before a real job can start.";
function estimateResourceTask(task) {
	const validation = validateTask(task);
	if (validation) return {
		ok: false,
		reason: validation,
		evidence: []
	};
	const memoryMin = safeCost(task.basis.fixedMemoryBytes, task.workUnits, task.basis.memoryBytesPerUnit.min);
	const memoryMax = safeCost(task.basis.fixedMemoryBytes, task.workUnits, task.basis.memoryBytesPerUnit.max);
	const storageMin = safeCost(0, task.workUnits, task.basis.storageBytesPerUnit.min);
	const storageMax = safeCost(0, task.workUnits, task.basis.storageBytesPerUnit.max);
	const durationMin = safeCost(0, task.workUnits, task.basis.millisecondsPerUnit.min);
	const durationMax = safeCost(0, task.workUnits, task.basis.millisecondsPerUnit.max);
	if ([
		memoryMin,
		memoryMax,
		storageMin,
		storageMax,
		durationMin,
		durationMax
	].some((v) => v === null)) return {
		ok: false,
		reason: "The task estimate exceeds JavaScript's safe numeric range.",
		evidence: []
	};
	const estimate = {
		memoryBytes: {
			min: memoryMin,
			max: memoryMax
		},
		storageBytes: {
			min: storageMin,
			max: storageMax
		},
		durationMs: {
			min: durationMin,
			max: durationMax
		},
		approximate: true,
		basis: `${task.workUnits} work units using an adapter-provided bounded min/max cost basis; this is an estimate, not a measurement.`
	};
	return {
		ok: true,
		data: estimate,
		evidence: [
			`memory:${estimate.memoryBytes.min}-${estimate.memoryBytes.max}`,
			`storage:${estimate.storageBytes.min}-${estimate.storageBytes.max}`,
			`duration:${estimate.durationMs.min}-${estimate.durationMs.max}`
		]
	};
}
function planResourceTask(task, environment) {
	const environmentError = validateEnvironment(environment);
	if (environmentError) return {
		ok: false,
		reason: environmentError,
		evidence: []
	};
	const estimateResult = estimateResourceTask(task);
	if (!estimateResult.ok) return estimateResult;
	const normalized = normalizeEnvironment(environment);
	const tier = classifyHardware(normalized);
	const estimate = estimateResult.data;
	const reasons = [];
	if (normalized.thermal === "critical" || normalized.thermal === "hot") return successfulPlan("defer", tier, estimate, normalized, null, null, null, [`The host thermal state is ${normalized.thermal}; wait for independently observed cooling.`]);
	if (normalized.power.source === "battery" && normalized.power.batteryPercent !== void 0 && normalized.power.batteryPercent < 25) return successfulPlan("defer", tier, estimate, normalized, null, null, null, [`Battery is ${normalized.power.batteryPercent}%; connect external power before starting.`]);
	const candidates = task.candidates.filter((candidate) => candidate.role === task.role).filter((candidate) => isInstalled(candidate, normalized)).filter((candidate) => !task.accuracyCritical || !candidate.changesEngineeringAccuracy).filter((candidate) => candidateFits(candidate, estimate, normalized)).sort((a, b) => b.qualityScore - a.qualityScore || a.id.localeCompare(b.id));
	if (candidates.length === 0) {
		reasons.push(task.accuracyCritical ? "No installed candidate fits without changing an accuracy-critical engineering setting." : "No installed candidate fits the measured memory, storage, GPU, backend and load limits.");
		return successfulPlan("refuse", tier, estimate, normalized, null, null, null, reasons);
	}
	const selected = candidates[0];
	const highestDeclared = [...task.candidates].filter((candidate) => candidate.role === task.role).filter((candidate) => !task.accuracyCritical || !candidate.changesEngineeringAccuracy).sort((a, b) => b.qualityScore - a.qualityScore)[0];
	const fallback = candidates.find((candidate) => candidate.qualityScore < selected.qualityScore) ?? null;
	const status = highestDeclared && selected.id !== highestDeclared.id ? "fallback" : "ready";
	const memoryHeadroom = Math.max(1, normalized.memory.availableBytes - estimate.memoryBytes.max);
	const byRam = Math.max(1, Math.floor(normalized.memory.availableBytes / Math.max(1, estimate.memoryBytes.max)));
	const byCpu = Math.max(1, Math.floor(normalized.cpu.logicalCores / 2));
	const maxParallelism = Math.max(1, Math.min(selected.maxParallelism, byRam, byCpu));
	const checkpointEveryMs = task.checkpointable ? clamp(Math.floor(estimate.durationMs.max / 10), MIN_CHECKPOINT_MS, MAX_CHECKPOINT_MS) : MAX_CHECKPOINT_MS;
	const storageFree = totalFreeStorage(normalized);
	const profile = {
		id: `${task.id}:${selected.id}:${tier}`,
		scope: "session",
		selectedToolId: selected.id,
		maxParallelism,
		previewScale: selected.previewScale,
		checkpointEveryMs,
		warningThresholds: {
			memoryBytes: Math.floor(normalized.memory.availableBytes * MEMORY_WARNING_RATIO),
			freeStorageBytes: Math.max(estimate.storageBytes.max, Math.floor(storageFree * STORAGE_RESERVE_RATIO)),
			thermal: task.kind === "solver" || task.kind === "render" ? "warm" : "hot"
		},
		cancellationStrategy: "cooperative_then_force_stop",
		restoreRequired: true
	};
	reasons.push(`${selected.id} is the highest-quality installed candidate that fits the observed host limits.`, `Maximum parallelism is ${maxParallelism}; ${formatBytes$2(memoryHeadroom)} estimated memory headroom remains.`);
	if (status === "fallback") reasons.push(`The preferred candidate does not fit; ${selected.id} is the safe reversible fallback.`);
	if (!task.cancellable) reasons.push("The adapter cannot prove cooperative cancellation; force-stop and checkpoint recovery are required.");
	return successfulPlan(status, tier, estimate, normalized, selected, fallback, profile, reasons);
}
var SYNTHETIC_RESOURCE_PROFILES = {
	weak: syntheticEnvironment("weak", 2, 4 * GB$2, 2 * GB$2, [], 20 * GB$2),
	medium: syntheticEnvironment("medium", 8, 16 * GB$2, 10 * GB$2, [{
		id: "gpu-medium",
		name: "Synthetic 6 GB GPU",
		vramBytes: 6 * GB$2,
		backends: ["webgpu", "cuda"]
	}], 200 * GB$2),
	strong: syntheticEnvironment("strong", 24, 64 * GB$2, 52 * GB$2, [{
		id: "gpu-strong",
		name: "Synthetic 24 GB GPU",
		vramBytes: 24 * GB$2,
		backends: [
			"webgpu",
			"cuda",
			"vulkan"
		]
	}], 1e3 * GB$2)
};
function syntheticEnvironment(tier, logicalCores, totalRamBytes, availableBytes, gpus, freeBytes) {
	return {
		capturedAt: "2026-07-26T00:00:00.000Z",
		evidenceClass: "synthetic_profile",
		cpu: {
			model: `Synthetic ${tier}`,
			physicalCores: Math.max(1, logicalCores / 2),
			logicalCores
		},
		memory: {
			totalBytes: totalRamBytes,
			availableBytes
		},
		gpus,
		storage: [{
			id: "synthetic",
			totalBytes: freeBytes * 2,
			freeBytes
		}],
		power: { source: "mains" },
		thermal: "nominal",
		currentLoad: {
			cpuPercent: 10,
			memoryBytes: totalRamBytes - availableBytes,
			gpuPercent: 5
		},
		availableBackends: gpus.flatMap((gpu) => gpu.backends),
		installedTools: {
			models: [
				"model-lite",
				"model-balanced",
				"model-full"
			],
			renderers: [
				"renderer-preview",
				"renderer-balanced",
				"renderer-full"
			],
			solvers: [
				"solver-lite",
				"solver-balanced",
				"solver-full"
			],
			processors: ["processor-native"]
		},
		evidence: [`synthetic:${tier}`]
	};
}
function validateEnvironment(environment) {
	if (!environment || !Number.isFinite(Date.parse(environment.capturedAt))) return "Hardware capture time is invalid.";
	if (!["synthetic_profile", "host_probe"].includes(environment.evidenceClass)) return "Hardware evidence class is invalid.";
	if (!environment.cpu?.model.trim() || !positiveInteger(environment.cpu.physicalCores) || !positiveInteger(environment.cpu.logicalCores) || environment.cpu.physicalCores > environment.cpu.logicalCores) return "CPU discovery evidence is invalid.";
	if (!positiveAmount(environment.memory?.totalBytes) || !nonNegativeAmount(environment.memory?.availableBytes) || environment.memory.availableBytes > environment.memory.totalBytes) return "Memory discovery evidence is invalid.";
	if (!Array.isArray(environment.storage) || environment.storage.length === 0) return "Storage discovery evidence is missing.";
	if (environment.storage.some((drive) => !drive.id.trim() || !positiveAmount(drive.totalBytes) || !nonNegativeAmount(drive.freeBytes) || drive.freeBytes > drive.totalBytes)) return "Storage discovery evidence is invalid.";
	if (environment.gpus.some((gpu) => !gpu.id.trim() || !gpu.name.trim() || !nonNegativeAmount(gpu.vramBytes) || !Array.isArray(gpu.backends))) return "GPU discovery evidence is invalid.";
	if (![
		"mains",
		"battery",
		"unknown"
	].includes(environment.power?.source)) return "Power-source evidence is invalid.";
	if (environment.power.batteryPercent !== void 0 && (!Number.isFinite(environment.power.batteryPercent) || environment.power.batteryPercent < 0 || environment.power.batteryPercent > 100)) return "Battery evidence is invalid.";
	if (![
		"nominal",
		"warm",
		"hot",
		"critical",
		"unknown"
	].includes(environment.thermal)) return "Thermal evidence is invalid.";
	if (!percentage(environment.currentLoad?.cpuPercent) || !nonNegativeAmount(environment.currentLoad?.memoryBytes) || environment.currentLoad.gpuPercent !== void 0 && !percentage(environment.currentLoad.gpuPercent)) return "Current-load evidence is invalid.";
	if (!Array.isArray(environment.availableBackends) || !environment.installedTools || !Array.isArray(environment.installedTools.models) || !Array.isArray(environment.installedTools.renderers) || !Array.isArray(environment.installedTools.solvers) || !Array.isArray(environment.installedTools.processors) || !Array.isArray(environment.evidence) || environment.evidence.length === 0) return "Installed-tool or provenance evidence is missing.";
	return null;
}
function normalizeEnvironment(environment) {
	return {
		...environment,
		gpus: environment.gpus.map((gpu) => ({
			...gpu,
			backends: uniqueSorted(gpu.backends)
		})),
		availableBackends: uniqueSorted(environment.availableBackends),
		installedTools: {
			models: uniqueSorted(environment.installedTools.models),
			renderers: uniqueSorted(environment.installedTools.renderers),
			solvers: uniqueSorted(environment.installedTools.solvers),
			processors: uniqueSorted(environment.installedTools.processors)
		},
		evidence: [...environment.evidence]
	};
}
function validateTask(task) {
	if (!task.id.trim()) return "Task ID is required.";
	if (!positiveAmount(task.workUnits)) return "Task work units must be positive.";
	const ranges = [
		task.basis.memoryBytesPerUnit,
		task.basis.storageBytesPerUnit,
		task.basis.millisecondsPerUnit
	];
	if (!nonNegativeAmount(task.basis.fixedMemoryBytes)) return "Fixed memory cost is invalid.";
	if (ranges.some((range) => !validRange(range))) return "A task estimate range is invalid.";
	if (!Array.isArray(task.candidates) || task.candidates.length === 0) return "At least one execution candidate is required.";
	if (task.candidates.some((candidate) => validateCandidate(candidate) !== null)) return "An execution candidate is invalid.";
	return null;
}
function validateCandidate(candidate) {
	if (!candidate.id.trim() || !positiveInteger(candidate.maxParallelism)) return "candidate identity/parallelism";
	if (!nonNegativeAmount(candidate.minAvailableRamBytes) || !nonNegativeAmount(candidate.minFreeStorageBytes) || !nonNegativeAmount(candidate.minVramBytes) || !Number.isFinite(candidate.previewScale) || candidate.previewScale <= 0 || candidate.previewScale > 1 || !Number.isFinite(candidate.qualityScore)) return "candidate limits";
	return null;
}
function candidateFits(candidate, estimate, environment) {
	if (environment.memory.availableBytes < Math.max(candidate.minAvailableRamBytes, estimate.memoryBytes.max)) return false;
	if (totalFreeStorage(environment) < Math.max(candidate.minFreeStorageBytes, estimate.storageBytes.max)) return false;
	if (candidate.requiresGpu && environment.gpus.length === 0) return false;
	if (candidate.minVramBytes > 0 && !environment.gpus.some((gpu) => gpu.vramBytes >= candidate.minVramBytes)) return false;
	if (candidate.requiredBackends.some((backend) => !environment.availableBackends.includes(backend))) return false;
	return true;
}
function isInstalled(candidate, environment) {
	return (candidate.role === "model" ? environment.installedTools.models : candidate.role === "renderer" ? environment.installedTools.renderers : candidate.role === "solver" ? environment.installedTools.solvers : environment.installedTools.processors).includes(candidate.id);
}
function classifyHardware(environment) {
	const maxVram = Math.max(0, ...environment.gpus.map((gpu) => gpu.vramBytes));
	if (environment.cpu.logicalCores >= 16 && environment.memory.totalBytes >= 32 * GB$2 && environment.memory.availableBytes >= 16 * GB$2 && maxVram >= 12 * GB$2) return "strong";
	if (environment.cpu.logicalCores >= 6 && environment.memory.totalBytes >= 8 * GB$2 && environment.memory.availableBytes >= 4 * GB$2) return "medium";
	return "weak";
}
function successfulPlan(status, hardwareTier, estimate, environment, selected, fallback, profile, reasons) {
	return {
		ok: true,
		data: {
			status,
			hardwareTier,
			estimate,
			selected,
			fallback,
			profile,
			reasons,
			evidenceClass: environment.evidenceClass
		},
		evidence: [...environment.evidence, ...reasons]
	};
}
function safeCost(fixed, units, perUnit) {
	const value = fixed + units * perUnit;
	return nonNegativeAmount(value) ? value : null;
}
function validRange(range) {
	return nonNegativeAmount(range.min) && nonNegativeAmount(range.max) && range.min <= range.max;
}
function positiveAmount(value) {
	return nonNegativeAmount(value) && value > 0;
}
function nonNegativeAmount(value) {
	return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}
function positiveInteger(value) {
	return Number.isInteger(value) && value > 0;
}
function percentage(value) {
	return Number.isFinite(value) && value >= 0 && value <= 100;
}
function totalFreeStorage(environment) {
	return environment.storage.reduce((total, drive) => total + drive.freeBytes, 0);
}
function uniqueSorted(values) {
	return [...new Set(values.filter((value) => value.trim()))].sort();
}
function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}
function formatBytes$2(value) {
	if (value < 1024) return `${Math.round(value)} B`;
	const units = [
		"KiB",
		"MiB",
		"GiB",
		"TiB"
	];
	let amount = value / 1024;
	let index = 0;
	while (amount >= 1024 && index < units.length - 1) {
		amount /= 1024;
		index += 1;
	}
	return `${amount.toFixed(amount >= 10 ? 0 : 1)} ${units[index]}`;
}
var GB$1 = 1024 ** 3;
var MB = 1024 ** 2;
var modelCandidates = [
	{
		id: "model-lite",
		role: "model",
		quality: "preview",
		qualityScore: 1,
		minAvailableRamBytes: 1 * GB$1,
		minFreeStorageBytes: 1 * GB$1,
		requiresGpu: false,
		minVramBytes: 0,
		requiredBackends: [],
		maxParallelism: 1,
		previewScale: .4,
		changesEngineeringAccuracy: false
	},
	{
		id: "model-balanced",
		role: "model",
		quality: "balanced",
		qualityScore: 2,
		minAvailableRamBytes: 6 * GB$1,
		minFreeStorageBytes: 5 * GB$1,
		requiresGpu: true,
		minVramBytes: 4 * GB$1,
		requiredBackends: ["webgpu"],
		maxParallelism: 3,
		previewScale: .7,
		changesEngineeringAccuracy: false
	},
	{
		id: "model-full",
		role: "model",
		quality: "full",
		qualityScore: 3,
		minAvailableRamBytes: 24 * GB$1,
		minFreeStorageBytes: 20 * GB$1,
		requiresGpu: true,
		minVramBytes: 16 * GB$1,
		requiredBackends: ["cuda"],
		maxParallelism: 8,
		previewScale: 1,
		changesEngineeringAccuracy: false
	}
];
var previewTask = {
	id: "studio-model-preview",
	kind: "local_inference",
	role: "model",
	workUnits: 100,
	basis: {
		fixedMemoryBytes: 256 * MB,
		memoryBytesPerUnit: {
			min: 1 * MB,
			max: 2 * MB
		},
		storageBytesPerUnit: {
			min: 1e4,
			max: 2e4
		},
		millisecondsPerUnit: {
			min: 100,
			max: 200
		}
	},
	candidates: modelCandidates,
	accuracyCritical: false,
	checkpointable: true,
	cancellable: true
};
var profileRows = [
	"weak",
	"medium",
	"strong"
].map((tier) => {
	const result = planResourceTask(previewTask, SYNTHETIC_RESOURCE_PROFILES[tier]);
	if (!result.ok) return {
		tier,
		selected: "refused",
		parallelism: 0,
		scale: 0
	};
	return {
		tier,
		selected: result.data.selected?.id ?? result.data.status,
		parallelism: result.data.profile?.maxParallelism ?? 0,
		scale: result.data.profile?.previewScale ?? 0
	};
});
function ResourceGovernorPanel() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "mb-1 flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gauge, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), "Resource Governor"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "Heavy local work is admitted only after an authenticated hardware snapshot, bounded memory/storage/duration estimates, tool selection, checkpoint planning and a reversible session or project profile."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 grid gap-2 sm:grid-cols-3",
				children: profileRows.map((profile) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "rounded-lg border border-border/70 p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "flex items-center gap-1.5 text-xs font-medium capitalize",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, {
									className: "h-3.5 w-3.5",
									"aria-hidden": true
								}),
								profile.tier,
								" profile"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[11px] text-muted-foreground",
							children: profile.selected
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-[11px] text-muted-foreground",
							children: [
								profile.parallelism,
								" parallel · ",
								Math.round(profile.scale * 100),
								"% preview"
							]
						})
					]
				}, profile.tier))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid gap-2 sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex items-start gap-2 rounded-lg border border-border/70 p-3 text-[11px] text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HardDrive, {
						className: "mt-0.5 h-3.5 w-3.5 shrink-0",
						"aria-hidden": true
					}), "Disk reserve, current application load, battery, power and thermal state remain part of every decision."]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex items-start gap-2 rounded-lg border border-border/70 p-3 text-[11px] text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
						className: "mt-0.5 h-3.5 w-3.5 shrink-0",
						"aria-hidden": true
					}), "Firmware, overclocking, drivers, global GPU settings and accuracy-critical engineering assumptions are outside this reversible control surface."]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-[11px] text-muted-foreground",
				children: ["Runtime boundary: ", RESOURCE_GOVERNOR_RUNTIME_BOUNDARY]
			})
		]
	});
}
/** Keep this much RAM free for the OS, matching the resource governor. */
var RAM_HEADROOM$1 = .85;
/**
* Recommend a local profile for the current machine.
*
* Picks the most capable profile that fits within a safe RAM ceiling, has its
* storage, and has a GPU if it needs one. Never auto-downloads: a fitting
* profile that isn't installed is surfaced as `installable`, not `ready`.
*/
function recommendProfile(hw, profiles) {
	if (profiles.length === 0) return {
		ok: false,
		reason: "No local profiles were provided to choose from."
	};
	const usableRam = hw.availableRamBytes * RAM_HEADROOM$1;
	const excluded = [];
	const fitting = [];
	for (const p of profiles) {
		if (p.requiresGpu && !hw.hasGpu) {
			excluded.push({
				profile: p,
				reason: `${p.label} needs a GPU, which this machine doesn't have.`
			});
			continue;
		}
		if (p.minRamBytes > usableRam) {
			excluded.push({
				profile: p,
				reason: `${p.label} needs ${formatBytes$1(p.minRamBytes)} of RAM but only ${formatBytes$1(usableRam)} is safely available.`
			});
			continue;
		}
		const storageNeeded = p.installed ? 0 : p.installBytes;
		if (storageNeeded > hw.freeStorageBytes) {
			excluded.push({
				profile: p,
				reason: `${p.label} needs ${formatBytes$1(storageNeeded)} of free disk to install but only ${formatBytes$1(hw.freeStorageBytes)} is free.`
			});
			continue;
		}
		fitting.push(p);
	}
	fitting.sort((a, b) => b.tier - a.tier);
	const ready = fitting.find((p) => p.installed) ?? null;
	const installable = fitting.find((p) => !p.installed && (!ready || p.tier > ready.tier)) ?? null;
	const localUnavailable = fitting.length === 0;
	return {
		ok: true,
		data: {
			ready,
			installable,
			excluded,
			localUnavailable,
			recommendation: describe$1(ready, installable, localUnavailable)
		},
		evidence: localUnavailable ? `No local profile fits; ${excluded.length} excluded.` : `${fitting.length} local profile(s) fit; best ready: ${ready?.label ?? "none installed"}.`
	};
}
function describe$1(ready, installable, localUnavailable) {
	if (localUnavailable) return "Nothing local will run on this machine as it is. Free memory or disk, or use a device with supported local hardware; OCADE will not move the job to public-cloud inference.";
	if (ready && installable) return `${ready.label} is installed and ready. A more capable option, ${installable.label}, would also fit — it needs a ${formatBytes$1(installable.downloadBytes)} download, which OCADE will not start without your approval.`;
	if (ready) return `${ready.label} is installed and the best local fit. Ready to use now.`;
	if (installable) return `No local profile is installed yet. ${installable.label} would fit and needs a ${formatBytes$1(installable.downloadBytes)} download — OCADE will not download it without your approval.`;
	return "A local profile fits but its state is unclear; OCADE won't assume it's ready.";
}
function formatBytes$1(n) {
	if (n < 1024) return `${Math.round(n)} B`;
	const units = [
		"KB",
		"MB",
		"GB",
		"TB"
	];
	let v = n / 1024;
	let i = 0;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}
/** Keep this much RAM free for the OS rather than consuming all of it. */
var RAM_HEADROOM = .85;
/**
* Estimate a job's cost. Refuses to produce a number from nonsense inputs
* rather than returning a confident-looking zero.
*/
function estimateJob(spec) {
	if (![
		"local_inference",
		"render",
		"build",
		"video_export",
		"simulation"
	].includes(spec.kind)) return {
		ok: false,
		reason: "The job kind is unknown, so OCADE won't estimate it."
	};
	if (!Number.isFinite(spec.workUnits) || spec.workUnits <= 0) return {
		ok: false,
		reason: "The job has no positive work size, so there's nothing to estimate."
	};
	if (!Number.isFinite(spec.bytesPerUnit) || spec.bytesPerUnit < 0) return {
		ok: false,
		reason: "The per-unit memory cost is missing or invalid, so OCADE won't guess the memory need."
	};
	if (!Number.isFinite(spec.msPerUnit) || spec.msPerUnit < 0) return {
		ok: false,
		reason: "The per-unit time cost is missing or invalid, so OCADE won't guess the duration."
	};
	if (spec.fixedMemoryBytes !== void 0 && !validNonNegativeAmount(spec.fixedMemoryBytes)) return {
		ok: false,
		reason: "The fixed memory cost is invalid, so OCADE won't guess the memory need."
	};
	if (spec.outputBytes !== void 0 && !validNonNegativeAmount(spec.outputBytes)) return {
		ok: false,
		reason: "The output storage cost is invalid, so OCADE won't guess the disk need."
	};
	const fixed = spec.fixedMemoryBytes ?? 0;
	const peakMemoryBytes = fixed + spec.workUnits * spec.bytesPerUnit;
	const durationMs = spec.workUnits * spec.msPerUnit;
	const storageBytes = spec.outputBytes ?? 0;
	if (!validNonNegativeAmount(peakMemoryBytes) || !validNonNegativeAmount(durationMs) || !validNonNegativeAmount(storageBytes)) return {
		ok: false,
		reason: "The estimated resource cost exceeds JavaScript's safe numeric range."
	};
	return {
		ok: true,
		data: {
			peakMemoryBytes,
			durationMs,
			storageBytes,
			approximate: true,
			basis: `Based on ${spec.workUnits.toLocaleString("en-GB")} units at ~${formatBytes(spec.bytesPerUnit)}/unit and ~${spec.msPerUnit} ms/unit${fixed > 0 ? `, plus ${formatBytes(fixed)} fixed` : ""}. This is an estimate, not a measurement.`
		},
		evidence: `~${formatBytes(peakMemoryBytes)} peak, ~${formatDuration(durationMs)}, ${storageBytes > 0 ? `~${formatBytes(storageBytes)} output` : "no output written"}.`
	};
}
/**
* Decide what to do about a job given the machine's current state.
*
* Order of checks matters: environmental blocks (thermal, battery) come first
* because they mean "not now" regardless of fit; then hard limits (storage,
* memory) which mean "not like this"; then duration which means "not in one
* shot".
*/
function governResources(spec, hw) {
	const est = estimateJob(spec);
	if (!est.ok) return est;
	const hardwareError = validateHardwareSnapshot(hw);
	if (hardwareError) return {
		ok: false,
		reason: hardwareError
	};
	const estimate = est.data;
	if (hw.thermalState === "critical") return rec({
		action: "defer",
		reason: "The machine is critically hot. Starting a heavy job now risks a thermal shutdown — let it cool first.",
		estimate
	});
	if (hw.thermalState === "hot" && (spec.kind === "render" || spec.kind === "simulation" || spec.kind === "local_inference")) return rec({
		action: "defer",
		reason: "The machine is running hot; a compute-heavy job would push it further. OCADE recommends waiting until it cools.",
		estimate
	});
	if (hw.batteryPercent !== void 0 && hw.batteryPercent < 25) return rec({
		action: "defer",
		reason: `Battery is at ${hw.batteryPercent}%. A job estimated at ${formatDuration(estimate.durationMs)} could drain it before finishing — plug in first.`,
		estimate
	});
	if (estimate.storageBytes > hw.freeStorageBytes) return rec({
		action: "refuse",
		reason: `The output needs about ${formatBytes(estimate.storageBytes)} but only ${formatBytes(hw.freeStorageBytes)} is free. Free up space before running this.`,
		estimate
	});
	const usableRam = hw.availableRamBytes * RAM_HEADROOM;
	if (estimate.peakMemoryBytes > usableRam) {
		const fixed = spec.fixedMemoryBytes ?? 0;
		const perUnit = spec.bytesPerUnit;
		const fits = perUnit > 0 ? Math.floor((usableRam - fixed) / perUnit) : 0;
		if (fits >= 1 && fixed < usableRam) return rec({
			action: "downgrade",
			suggestedWorkUnits: fits,
			reason: `At ${spec.workUnits.toLocaleString("en-GB")} units this needs ~${formatBytes(estimate.peakMemoryBytes)}, over the ~${formatBytes(usableRam)} safely available. It would fit at about ${fits.toLocaleString("en-GB")} units — run it smaller, or in batches.`,
			estimate
		});
		return rec({
			action: "refuse",
			reason: `This needs ~${formatBytes(estimate.peakMemoryBytes)} of memory but only ~${formatBytes(usableRam)} is safely available, and its fixed overhead alone doesn't fit. OCADE won't start it — it would run out of memory partway.`,
			estimate
		});
	}
	if (estimate.durationMs > 3e5) return rec({
		action: "checkpoint_first",
		reason: `Estimated at ${formatDuration(estimate.durationMs)}. OCADE will checkpoint it so it can pause, resume, and survive an interruption rather than losing the work if it stops.`,
		estimate
	});
	return rec({
		action: "proceed",
		reason: `Fits comfortably: ~${formatBytes(estimate.peakMemoryBytes)} of the ~${formatBytes(usableRam)} available, ~${formatDuration(estimate.durationMs)}.`,
		estimate
	});
}
function rec(r) {
	return {
		ok: true,
		data: r,
		evidence: `${r.action}: ${r.reason}`
	};
}
function validNonNegativeAmount(value) {
	return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}
function validateHardwareSnapshot(hw) {
	if (!validNonNegativeAmount(hw.totalRamBytes) || hw.totalRamBytes === 0 || !validNonNegativeAmount(hw.availableRamBytes) || !validNonNegativeAmount(hw.freeStorageBytes)) return "The hardware memory or storage snapshot is invalid.";
	if (hw.availableRamBytes > hw.totalRamBytes) return "Available memory cannot exceed total memory.";
	if (typeof hw.hasGpu !== "boolean") return "The hardware GPU capability is invalid.";
	if (hw.batteryPercent !== void 0 && (!Number.isFinite(hw.batteryPercent) || hw.batteryPercent < 0 || hw.batteryPercent > 100)) return "The battery percentage is invalid.";
	if (hw.thermalState !== void 0 && ![
		"nominal",
		"warm",
		"hot",
		"critical"
	].includes(hw.thermalState)) return "The thermal state is invalid.";
	return null;
}
function formatBytes(n) {
	if (n < 1024) return `${Math.round(n)} B`;
	const units = [
		"KB",
		"MB",
		"GB",
		"TB"
	];
	let v = n / 1024;
	let i = 0;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}
function formatDuration(ms) {
	if (ms < 1e3) return `${Math.round(ms)} ms`;
	const s = ms / 1e3;
	if (s < 60) return `${s.toFixed(s >= 10 ? 0 : 1)} s`;
	const m = s / 60;
	if (m < 60) return `${m.toFixed(m >= 10 ? 0 : 1)} min`;
	return `${(m / 60).toFixed(1)} h`;
}
/**
* OCADE local-job planner — the execution-path consumer that composes the
* hardware-profile recommender (§6.3) and the resource governor (§23.5) into
* one decision: can this job run locally, on what profile, and how?
*
* Neither library is used blind. This orchestrator asks them in the order that
* matters:
*
*  1. Which local profile does this machine support at all? (hardware-profile)
*  2. Given the job's cost, does it fit that profile's headroom, and does the
*     machine's state (thermal, battery, disk) allow starting it? (resource
*     governor)
*
* The honesty carries straight through: if no local profile fits, the answer is
* an explicit refusal, not a forced local run or remote fallback; if a profile
* fits but the job is too big or the machine too hot, the governor's verdict is
* returned verbatim. Nothing here overrides either library's refusal.
*/
/**
* Decide where and how to run a job.
*
* Composes the two governors; returns their combined verdict without softening
* either one's refusal.
*/
function planLocalJob(job, hw, profiles) {
	const profile = recommendProfile(hw, profiles);
	if (!profile.ok) return profile;
	if (profile.data.localUnavailable) return {
		ok: true,
		data: {
			where: "unavailable",
			reason: profile.data.recommendation
		},
		evidence: "No local profile fits; remote inference refused."
	};
	if (!profile.data.ready && profile.data.installable) return {
		ok: true,
		data: {
			where: "needs_install",
			profileLabel: profile.data.installable.label,
			reason: profile.data.recommendation
		},
		evidence: `Best fit ${profile.data.installable.label} needs installation (with approval).`
	};
	const ready = profile.data.ready;
	if (!ready) return {
		ok: true,
		data: {
			where: "unavailable",
			reason: profile.data.recommendation
		},
		evidence: "No runnable local profile; remote inference refused."
	};
	const gov = governResources(job, hw);
	if (!gov.ok) return gov;
	if (gov.data.action === "proceed" || gov.data.action === "checkpoint_first") return {
		ok: true,
		data: {
			where: "local",
			profileId: ready.id,
			profileLabel: ready.label,
			recommendation: gov.data
		},
		evidence: `Run locally on ${ready.label}: ${gov.data.reason}`
	};
	return {
		ok: true,
		data: {
			where: "blocked",
			recommendation: gov.data
		},
		evidence: `Governor ${gov.data.action}: ${gov.data.reason}`
	};
}
/**
* Where a local job would run — the placement decision, surfaced.
*
* `planLocalJob` composes the hardware-profile recommender and the resource
* governor into one verdict: run locally, install first (with approval), or
* refuse. It was fully implemented and tested but reached by no
* route or panel, and it is the only consumer of `hardware-profile`, so both sat
* unreachable from the product.
*
* HONESTY: these are DECLARED machine snapshots, not a reading of the machine
* you are on. The browser cannot see installed RAM, free disk, GPU or battery,
* and inventing those numbers is exactly the fabrication this project forbids.
* What is real here is the DECISION — the same function the runtime calls,
* producing the same verdicts, including its refusals.
*/
var GB = 1024 ** 3;
/** Two profiles: one small and already present, one capable but not installed. */
var PROFILES = [{
	id: "compact",
	label: "Compact local model",
	minRamBytes: 2 * GB,
	installBytes: 2 * GB,
	downloadBytes: 0,
	requiresGpu: false,
	installed: true,
	tier: 1
}, {
	id: "full",
	label: "Full local model",
	minRamBytes: 16 * GB,
	installBytes: 12 * GB,
	downloadBytes: 12 * GB,
	requiresGpu: true,
	installed: false,
	tier: 3
}];
var JOB = {
	kind: "local_inference",
	workUnits: 4e3,
	bytesPerUnit: 96 * 1024,
	msPerUnit: 4,
	fixedMemoryBytes: 1 * GB
};
var MACHINES = [
	{
		label: "Laptop on battery",
		note: "8 GB RAM, no GPU, 35% battery",
		hw: {
			totalRamBytes: 8 * GB,
			availableRamBytes: 2.5 * GB,
			freeStorageBytes: 20 * GB,
			hasGpu: false,
			batteryPercent: 35,
			thermalState: "warm"
		}
	},
	{
		label: "Low-memory netbook",
		note: "4 GB RAM, no GPU, little free",
		hw: {
			totalRamBytes: 4 * GB,
			availableRamBytes: 1.2 * GB,
			freeStorageBytes: 6 * GB,
			hasGpu: false,
			thermalState: "nominal"
		}
	},
	{
		label: "Desktop",
		note: "32 GB RAM, GPU, mains power",
		hw: {
			totalRamBytes: 32 * GB,
			availableRamBytes: 18 * GB,
			freeStorageBytes: 300 * GB,
			hasGpu: true,
			thermalState: "nominal"
		}
	},
	{
		label: "Thermally throttled",
		note: "32 GB RAM, GPU, running hot",
		hw: {
			totalRamBytes: 32 * GB,
			availableRamBytes: 18 * GB,
			freeStorageBytes: 300 * GB,
			hasGpu: true,
			thermalState: "critical"
		}
	}
];
/** Presentation for each verdict. The refusals are shown, not hidden. */
function describe(decision) {
	switch (decision.where) {
		case "local": return {
			icon: Cpu,
			headline: `Runs locally · ${decision.profileLabel}`,
			detail: decision.recommendation.reason
		};
		case "needs_install": return {
			icon: Download,
			headline: `Needs ${decision.profileLabel}`,
			detail: `${decision.reason} Never installed without approval.`
		};
		case "blocked": return {
			icon: ShieldAlert,
			headline: "Refused by the resource governor",
			detail: decision.recommendation.reason
		};
		case "unavailable": return {
			icon: ShieldAlert,
			headline: "No supported local runtime",
			detail: decision.reason
		};
	}
}
var ROWS = MACHINES.map((machine) => {
	const outcome = planLocalJob(JOB, machine.hw, PROFILES);
	return {
		...machine,
		outcome
	};
});
function LocalJobPlanPanel() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "mb-1 flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), "Local job placement"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "Where a job would run, given the machine it is asked to run on. The profile recommender and the resource governor both have to agree; either one can refuse, and neither refusal is softened."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 grid gap-2 sm:grid-cols-3",
				children: ROWS.map((row) => {
					if (!row.outcome.ok) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "rounded-lg border border-border/70 p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs font-medium",
								children: row.label
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-[11px] text-muted-foreground",
								children: row.note
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-[11px] text-destructive",
								children: row.outcome.reason
							})
						]
					}, row.label);
					const shown = describe(row.outcome.data);
					const Icon = shown.icon;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "rounded-lg border border-border/70 p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "flex items-center gap-1.5 text-xs font-medium",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
									className: "h-3.5 w-3.5 shrink-0",
									"aria-hidden": true
								}), row.label]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-[11px] text-muted-foreground",
								children: row.note
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1.5 text-[11px] font-medium",
								children: shown.headline
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-[11px] text-muted-foreground",
								children: shown.detail
							})
						]
					}, row.label);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-[11px] text-muted-foreground",
				children: "Runtime boundary: these are declared machine snapshots, not a reading of your hardware. A browser cannot see installed RAM, free disk, GPU or battery. The decision logic shown is the same code the runtime calls; the machine descriptions are not measurements."
			})
		]
	});
}
var NO_PROBER = "No probe host is available in this environment, so presence could not be determined.";
/** Unknown, never absent. Used whenever the registry has not been told anything. */
function blocked(id, name, reason) {
	return {
		id,
		name,
		version: null,
		detected: false,
		supportedActions: [],
		coverageLevel: "BLOCKED",
		evidence: [reason]
	};
}
var AppCoverageRegistry = class {
	state = {
		lastScanned: null,
		applications: /* @__PURE__ */ new Map()
	};
	registerAppProfile(id, name) {
		if (!id.trim() || !name.trim()) throw new Error("An application profile needs a non-empty id and name.");
		this.state.applications.set(id, blocked(id, name, "Registered but not yet scanned; no probe has run."));
	}
	/**
	* Runs the real detection pass.
	*
	* With no prober, every application becomes BLOCKED. That is the honest
	* answer in a browser: OCADE cannot see the filesystem from there, and
	* reporting "not installed" would be a fabrication in the other direction.
	*/
	async runCoverageScan(prober) {
		this.state.lastScanned = /* @__PURE__ */ new Date();
		for (const [id, app] of this.state.applications.entries()) {
			if (!prober) {
				this.state.applications.set(id, blocked(id, app.name, NO_PROBER));
				continue;
			}
			let probe;
			try {
				probe = await prober(id, app.name);
			} catch (error) {
				this.state.applications.set(id, blocked(id, app.name, `The probe could not complete: ${error instanceof Error ? error.message : "the probe host refused"}`));
				continue;
			}
			this.state.applications.set(id, this.classify(id, app.name, probe));
		}
		return Array.from(this.state.applications.values());
	}
	/**
	* Turns a probe result into a coverage record.
	*
	* Every rule here exists to stop a claim outrunning its evidence.
	*/
	classify(id, name, probe) {
		const evidence = (probe.evidence ?? []).filter((line) => line.trim().length > 0);
		if (!probe.detected) return {
			id,
			name,
			version: null,
			detected: false,
			supportedActions: [],
			coverageLevel: "UNSUPPORTED",
			evidence: evidence.length ? evidence : ["The probe reported the application as absent."]
		};
		if (evidence.length === 0) return blocked(id, name, "The probe claimed detection but supplied no evidence for it.");
		const actions = (probe.supportedActions ?? []).filter((a) => a.trim().length > 0);
		const limited = (probe.limitations ?? []).filter((l) => l.trim().length > 0);
		if (actions.length === 0) return {
			id,
			name,
			version: probe.version ?? null,
			detected: true,
			supportedActions: [],
			coverageLevel: "PARTIAL",
			evidence: [...evidence, "Detected, but the probe reported no supported action."]
		};
		return {
			id,
			name,
			version: probe.version ?? null,
			detected: true,
			supportedActions: actions,
			coverageLevel: limited.length > 0 ? "PARTIAL" : "FULL",
			evidence: limited.length > 0 ? [...evidence, ...limited] : evidence
		};
	}
	getCoverageReport() {
		return Array.from(this.state.applications.values());
	}
	getAppCoverage(id) {
		return this.state.applications.get(id);
	}
	get lastScanned() {
		return this.state.lastScanned;
	}
};
new AppCoverageRegistry();
var FREE_TOOLS = [
	{
		id: "blender",
		displayName: "Blender",
		licence: "GPL-3.0-or-later",
		command: "blender",
		versionArgs: ["--version"],
		versionPattern: /^Blender\s+(\d+\.\d+(?:\.\d+)?)/im,
		capabilities: [
			"headless_render",
			"mesh_export",
			"scene_inspect"
		]
	},
	{
		id: "freecad",
		displayName: "FreeCAD",
		licence: "LGPL-2.1-or-later",
		command: "freecadcmd",
		versionArgs: ["--version"],
		versionPattern: /^FreeCAD\s+(\d+\.\d+(?:\.\d+)?)/im,
		capabilities: [
			"cad_rebuild",
			"parametric_edit",
			"step_export"
		]
	},
	{
		id: "calculix",
		displayName: "CalculiX",
		licence: "GPL-2.0-or-later",
		command: "ccx",
		versionArgs: ["-v"],
		versionPattern: /^\s*Version\s+(\d+\.\d+)/im,
		capabilities: [
			"fea_solve",
			"termination_parse",
			"result_read"
		]
	}
];
/**
* Determine whether one tool is really present.
*
* "Present" means the binary ran AND its own output matched the expected
* version pattern. A command that exists but prints something unrecognisable is
* `probe_failed`, not `installed` — assuming it is the tool we wanted would be
* guessing, and everything downstream depends on this answer being earned.
*/
async function detectTool(tool, run) {
	let result;
	try {
		result = await run(tool.command, tool.versionArgs);
	} catch (error) {
		return {
			status: "not_installed",
			reason: `${tool.displayName} did not run: ${errorText(error)}. Install it and ensure "${tool.command}" is on PATH.`
		};
	}
	const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
	const match = tool.versionPattern.exec(output);
	if (!result.ok && !match) return {
		status: "not_installed",
		reason: `"${tool.command}" is not on PATH or exited without a recognisable version banner.`
	};
	if (!match) return {
		status: "probe_failed",
		reason: `"${tool.command}" ran but did not print a ${tool.displayName} version. It may be a different program with the same name; refusing to assume it is ${tool.displayName}.`
	};
	return {
		status: "installed",
		version: match[1],
		evidence: `${tool.command} ${tool.versionArgs.join(" ")} reported ${tool.displayName} ${match[1]}.`
	};
}
function errorText(error) {
	if (error instanceof Error) return error.message;
	return typeof error === "string" ? error : "unknown error";
}
/**
* Bridges the free-tool detector to the application-coverage registry (P21).
*
* `app-coverage-registry` was written to be honest: with no prober injected,
* every application reports BLOCKED (unknown) rather than UNSUPPORTED
* (absent). Correct — and permanently uninformative, because nothing in
* production ever supplied a prober. `free-tool-adapters` is exactly a prober
* and was imported only by tests. Two halves of one feature, never joined.
*
* This joins them, and keeps both halves' honesty rules intact:
*
*  - A probe that CANNOT LOOK throws, so the registry records BLOCKED. "I could
*    not look" is not "it is not there", and conflating them is how a coverage
*    registry starts lying.
*  - A binary that runs but prints an unrecognised banner is `probe_failed`,
*    never `installed`. Something else with the same name on PATH must not be
*    mistaken for the tool.
*  - Nothing here can run a process in a browser. Without an injected runner
*    the prober throws, which is the honest answer for a web build.
*/
/**
* Registry application id → the free tool that backs it.
*
* The registry namespaces ids as `app.blender`; the tool catalogue uses bare
* `blender`. Normalising here rather than changing either side keeps both
* naming schemes intact, and an id with no mapping falls through to a THROWN
* probe (unknown) rather than a silent "not detected".
*/
var APP_TO_TOOL = {
	blender: "blender",
	freecad: "freecad",
	calculix: "calculix"
};
var toToolId = (appId) => APP_TO_TOOL[appId.replace(/^app\./, "").toLowerCase()];
var ProbeUnavailableError = class extends Error {
	constructor(reason) {
		super(reason);
		this.name = "ProbeUnavailableError";
	}
};
/**
* Build an `AppProber` from a command runner.
*
* The runner is injected because process execution is not available in every
* environment this code loads in. Passing no runner is not an error at
* construction time — it becomes a throwing probe, so the registry records
* BLOCKED for every application instead of quietly reporting absence.
*/
function createToolProber(run) {
	return async (id, name) => {
		if (!run) throw new ProbeUnavailableError(`Cannot probe for ${name}: running a process is not possible here, so presence is unknown rather than absent.`);
		const toolId = toToolId(id);
		const tool = FREE_TOOLS.find((t) => t.id === toolId);
		if (!tool) throw new ProbeUnavailableError(`No probe is defined for ${name}, so its presence is unknown rather than absent.`);
		return toProbeResult(tool, await detectTool(tool, run));
	};
}
function toProbeResult(tool, a) {
	switch (a.status) {
		case "installed": return {
			detected: true,
			version: a.version ?? null,
			supportedActions: [...tool.capabilities ?? []],
			evidence: [`"${tool.command} ${tool.versionArgs.join(" ")}" printed a recognised ${tool.displayName} version banner.`]
		};
		case "not_installed": return {
			detected: false,
			version: null,
			evidence: [a.reason]
		};
		default: throw new ProbeUnavailableError(a.reason);
	}
}
/**
* Which applications OCADE can drive — and, here, why it cannot say.
*
* This panel exists because the honest answer in a browser is "I cannot see
* your machine", and that answer needs somewhere to be said. A registry that
* knows it is blocked but has no surface is just a silent gap the user reads as
* "no supported applications".
*
* This panel previously could not have existed truthfully: `runCoverageScan`
* hardcoded Blender as detected at version 4.0.2 with FULL coverage, so any
* surface built on it would have shown fabricated application support. It now
* requires an injected prober and reports BLOCKED when nothing has looked, so
* what renders below is a real verdict from the real function.
*
* BLOCKED means unknown, not absent. The browser has no process execution and
* no filesystem, so presence genuinely cannot be determined from here.
*/
var CANDIDATES = [
	{
		id: "app.blender",
		name: "Blender"
	},
	{
		id: "app.freecad",
		name: "FreeCAD"
	},
	{
		id: "app.calculix",
		name: "CalculiX"
	}
];
function newRegistry() {
	const registry = new AppCoverageRegistry();
	for (const candidate of CANDIDATES) registry.registerAppProfile(candidate.id, candidate.name);
	return registry;
}
/** Unprobed state, rendered until an actual scan reports back. */
var INITIAL_ROWS = newRegistry().getCoverageReport();
function AppCoveragePanel() {
	const [rows, setRows] = (0, import_react.useState)(INITIAL_ROWS);
	(0, import_react.useEffect)(() => {
		let live = true;
		(async () => {
			const registry = newRegistry();
			await registry.runCoverageScan(createToolProber(null));
			if (live) setRows(registry.getCoverageReport());
		})();
		return () => {
			live = false;
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "mb-1 flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppWindow, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), "Application coverage"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "Which applications OCADE can drive on this machine. Nothing here is assumed: an application is only reported as supported when a probe has actually found it and said how."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 grid gap-2 sm:grid-cols-3",
				children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "rounded-lg border border-border/70 p-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "flex items-center gap-1.5 text-xs font-medium",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, {
								className: "h-3.5 w-3.5 shrink-0",
								"aria-hidden": true
							}), row.name]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
							children: row.coverageLevel
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[11px] text-muted-foreground",
							children: row.evidence.join(" ")
						})
					]
				}, row.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 rounded-lg border border-border/70 p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] font-medium",
					children: "To turn this into a real answer"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-[11px] text-muted-foreground",
					children: [
						"Run OCADE with the desktop companion connected. It can execute a version probe and report what it actually found. Until then these read BLOCKED — meaning",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: "not determined"
						}),
						", not",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: "not installed"
						}),
						". The two are different answers and OCADE will not merge them."
					]
				})]
			})
		]
	});
}
/**
* OCADE Task Rehearsal Mode (master plan §23.1).
*
* Before a multi-step task runs, rehearse the whole action graph WITHOUT
* mutating anything, and report every problem at once: a missing permission, a
* step the scope never granted, a control method that's currently failing, a
* resource budget that won't fit, an app that needs inspecting first.
*
* The value is in "at once". Executing a ten-step task and discovering on step
* seven that a permission is missing wastes the six steps before it and leaves
* the world half-changed. Rehearsal surfaces all seven-and-beyond blockers
* before step one.
*
* TWO RULES KEEP IT HONEST:
*
* 1. **It never executes.** It composes `planStep`, which is pure — it decides
*    and routes but does not act. The scope is threaded forward so later steps
*    see the step count they really would, but the caller's own scope object is
*    never mutated.
*
* 2. **Passing rehearsal is not a promise of success.** A clear rehearsal means
*    "nothing OCADE can check ahead of time blocks this" — not "this will
*    work". The app might still be gone, the file still locked. `allClear`
*    carries that caveat in `REHEARSAL_REALITY`, so a clear result is never
*    read as a guarantee.
*/
function classify(outcome, index) {
	switch (outcome.status) {
		case "ready": return {
			index,
			intent: outcome.plan.intent,
			status: "ready",
			reason: `Would run via ${outcome.plan.method} at ${(outcome.plan.confidence * 100).toFixed(0)}% confidence.`,
			method: outcome.plan.method,
			confidence: outcome.plan.confidence
		};
		case "refused": return {
			index,
			intent: describeAction(index),
			status: "not_permitted",
			reason: outcome.reason
		};
		case "needs_inspection": return {
			index,
			intent: describeAction(index),
			status: "needs_inspection",
			reason: outcome.reason
		};
		case "over_budget": return {
			index,
			intent: describeAction(index),
			status: "over_budget",
			reason: outcome.reason
		};
	}
}
function describeAction(index) {
	return `Step ${index + 1}`;
}
/**
* Rehearse a task's steps in order.
*
* The scope is threaded step to step so that, for example, a per-task step
* budget is rehearsed against the count it really would reach. Because
* `planStep` returns a fresh scope rather than mutating, the caller's scope is
* untouched and the rehearsal can be re-run identically.
*/
function rehearseTask(steps, context) {
	if (steps.length === 0) return {
		ok: false,
		reason: "There are no steps to rehearse."
	};
	const verdicts = [];
	let scope = context.scope;
	let readySoFar = 0;
	steps.forEach((step, index) => {
		const outcome = planStep({
			action: step.action,
			capability: step.capability,
			app: step.app,
			packs: context.packs,
			scope,
			health: context.health,
			availableMethods: context.availableMethods,
			recording: context.recording,
			remainingSteps: steps.length - index,
			now: context.now
		});
		const verdict = classify(outcome, index);
		verdicts.push(verdict);
		if (outcome.status === "ready") {
			scope = outcome.plan.scope;
			readySoFar++;
		}
	});
	const blockers = verdicts.filter((v) => v.status !== "ready");
	const blockerKinds = [...new Set(blockers.map((b) => b.status))];
	const allClear = blockers.length === 0;
	return {
		ok: true,
		data: {
			steps: verdicts,
			allClear,
			blockers,
			blockerKinds,
			headline: headlineFor(allClear, verdicts.length, blockers.length, readySoFar)
		},
		evidence: allClear ? `All ${verdicts.length} steps rehearsed clear. Nothing OCADE can check ahead of time blocks this task.` : `${blockers.length} of ${verdicts.length} steps are blocked — first: ${blockers[0].reason}`
	};
}
function headlineFor(allClear, total, blocked, ready) {
	if (allClear) return `${total} step${total === 1 ? "" : "s"} ready. Rehearsal found nothing blocking — but it can't promise the apps and files will be as expected when it runs.`;
	return `${blocked} of ${total} steps blocked, ${ready} ready. Fix the blockers before running, or OCADE will stop partway.`;
}
/**
* What a clear rehearsal is allowed to claim.
*
* Kept as a constant so a caller cannot upgrade "rehearsed clear" into
* "guaranteed". See rule 2 in the module header.
*/
var REHEARSAL_REALITY = "A clear rehearsal means nothing OCADE could check in advance blocks this task — permissions, routes, budgets and known app state. It is not a guarantee: the app may have closed, the file may be locked, the UI may have changed. OCADE still verifies each step as it runs, and stops if reality disagrees.";
/**
* OCADE Shadow Execution (master plan §23.9).
*
* "For high-risk tasks, compare planned changes against a temporary copy,
* sandbox, preview, or dry-run before touching the real state."
*
* The pattern: apply the change to a COPY, check the copy satisfies what the
* change was supposed to achieve, and only then report it safe to apply for
* real. The real state is never touched here — this function cannot mutate it,
* because it is never given it. It is given the current content and returns a
* verdict; committing is the caller's separate, gated step.
*
* WHY POSTCONDITIONS, NOT JUST "DID IT APPLY". A patch can apply cleanly and
* still be wrong: it lands, the file compiles, and it did the opposite of what
* was intended. So the caller states what the result must be true of — a string
* that must now be present, one that must be gone, a size bound — and shadow
* execution refuses to bless a change whose shadow doesn't satisfy it. "It
* applied" is not "it worked", and conflating them is how a confident wrong
* edit ships.
*
* Built on the patch engine's reversible apply, so a shadow that passes is also
* proven undoable before it is ever recommended for the real file.
*/
/**
* Run a patch against a copy and check the result before recommending it.
*
* Returns `safeToApply: false` with named failures rather than throwing, so the
* caller can show exactly why the real file was left untouched.
*/
function shadowApplyPatch(original, patch, postconditions = {}) {
	const applied = applyReversibly(original, patch);
	if (!applied.ok) return {
		ok: true,
		data: {
			preview: original,
			safeToApply: false,
			failures: [`The change doesn't apply cleanly: ${applied.reason}`],
			linesAdded: 0,
			linesRemoved: 0
		},
		evidence: "Shadow apply failed; the real file was never touched."
	};
	const preview = applied.data.content;
	const failures = [];
	for (const needle of postconditions.mustContain ?? []) if (!preview.includes(needle)) failures.push(`The result should contain “${truncate$1(needle)}”, but it doesn't.`);
	for (const needle of postconditions.mustNotContain ?? []) if (preview.includes(needle)) failures.push(`The result should no longer contain “${truncate$1(needle)}”, but it still does.`);
	if (postconditions.maxBytes !== void 0) {
		const bytes = new TextEncoder().encode(preview).length;
		if (bytes > postconditions.maxBytes) failures.push(`The result is ${bytes} bytes, over the ${postconditions.maxBytes}-byte limit.`);
	}
	if (postconditions.mustChange && preview === original) failures.push("The change made no difference to the file — it was expected to change something.");
	const safeToApply = failures.length === 0;
	return {
		ok: true,
		data: {
			preview,
			safeToApply,
			failures,
			linesAdded: applied.data.linesAdded,
			linesRemoved: applied.data.linesRemoved
		},
		evidence: safeToApply ? `Shadow run clean: +${applied.data.linesAdded} −${applied.data.linesRemoved}, every check held. Safe to apply, and reversible.` : `Shadow run held the real file back: ${failures.length} check${failures.length === 1 ? "" : "s"} failed. First: ${failures[0]}`
	};
}
function truncate$1(s) {
	const oneLine = s.replace(/\n/g, " ");
	return oneLine.length > 40 ? `${oneLine.slice(0, 40)}…` : oneLine;
}
/**
* The rule the caller must honour, stated so it cannot be lost.
*
* A shadow verdict of `safeToApply: false` means the real state must not be
* changed. This constant exists so a UI or orchestrator that shows the preview
* also shows what a failed shadow means.
*/
var SHADOW_RULE = "A change is applied to a copy and checked before the real file is touched. If the shadow fails any check, the real file is left exactly as it was — OCADE does not apply a change it couldn't prove correct on the copy.";
/**
* Build a replay from a completed ledger.
*
* Skipped steps (ones that never ran because an earlier step halted the task)
* are noted rather than narrated as work — pretending they happened would be
* the same dishonesty in a smaller form.
*/
function buildReplay(ledger) {
	const steps = [];
	let number = 0;
	for (const step of ledger.steps) {
		if (step.status === "skipped") {
			number++;
			steps.push({
				number,
				intent: step.intent,
				narration: "Not reached — an earlier step stopped the task before this one.",
				wasMistake: false
			});
			continue;
		}
		number++;
		steps.push({
			number,
			intent: step.intent,
			narration: narrate(step),
			wasMistake: step.status === "failed" || (step.recovery && step.recovery.action !== "none") === true
		});
	}
	return {
		title: `How OCADE handled: ${ledger.intent || ledger.taskId}`,
		intro: `Starting point: ${ledger.initialState}`,
		steps,
		proof: proofFor(ledger),
		mistakes: steps.filter((s) => s.wasMistake).length
	};
}
function narrate(step) {
	const parts = [];
	if (step.attempts > 1) parts.push(`Took ${step.attempts} attempts.`);
	if (step.status === "done") parts.push(step.receipt?.verified ? `Done, and confirmed: ${step.receipt.evidence}` : `Done, but not independently confirmed: ${step.receipt?.evidence ?? "no evidence recorded"}.`);
	else if (step.status === "failed") {
		parts.push(step.receipt ? `Failed: ${step.receipt.evidence}` : "Failed before it could run, so nothing was changed by it.");
		if (step.recovery && step.recovery.action !== "none") parts.push(`Recovered by ${step.recovery.action}: ${step.recovery.evidence}`);
	}
	return parts.join(" ");
}
function proofFor(ledger) {
	switch (ledger.outcome) {
		case "succeeded": return `Final proof: every step completed and was verified. Ending state — ${ledger.finalState}.`;
		case "partial": return `Honest ending: the task did NOT fully succeed. ${ledger.headline} Ending state — ${ledger.finalState}. Don't treat this replay as a recipe for a guaranteed result.`;
		case "failed": return `Honest ending: the task failed. ${ledger.headline} Ending state — ${ledger.finalState}.`;
		case "empty": return "Nothing ran, so there is nothing to replay.";
	}
}
/** Render the replay as Markdown — a tutorial is read by people. */
function serialiseReplay(replay) {
	const lines = [
		`# ${replay.title}`,
		"",
		replay.intro,
		""
	];
	for (const step of replay.steps) {
		lines.push(`## Step ${step.number}: ${step.intent}${step.wasMistake ? " ⚠" : ""}`);
		lines.push(step.narration);
		lines.push("");
	}
	if (replay.mistakes > 0) {
		lines.push(`_${replay.mistakes} step${replay.mistakes === 1 ? "" : "s"} went wrong along the way; they are kept above on purpose._`);
		lines.push("");
	}
	lines.push(`> ${replay.proof}`);
	return lines.join("\n");
}
/**
* Pre-flight checks, on this device. Three safety gates that run BEFORE OCADE
* commits to a task, each exercising its real module (nothing illustrative):
*
*  - REHEARSE (skills/rehearsal): walk the whole step graph without executing and
*    surface every blocker at once, so a step-2 permission gap is seen before
*    step 1 changes anything.
*  - SHADOW (skills/shadow-execution): apply a code change to a COPY and check its
*    postconditions before the real file is touched — "it applied" is not "it worked".
*  - REPLAY (artifacts/learning-replay): turn a finished task's ledger into an
*    honest tutorial that KEEPS the mistakes in, never a sanitised success story.
*
* These modules compose into the governed pipeline; this surface makes them
* directly runnable and inspectable.
*/
var CSV = "region,amount\nNorth,120";
var FILE = [
	"function greet(name) {",
	"  return \"hi \" + name;",
	"}",
	""
].join("\n");
var GOOD_DIFF = [
	"--- a/greet.js",
	"+++ b/greet.js",
	"@@ -1,3 +1,3 @@",
	" function greet(name) {",
	"-  return \"hi \" + name;",
	"+  return `Hello, ${name}`;",
	" }",
	""
].join("\n");
function runRehearsal() {
	const registry = new PackRegistry();
	const pack = registry.get("ocade.data");
	const cap = pack?.capabilities.find((c) => c.id === "data.parse_csv") ?? null;
	if (!pack || !cap) return ["The data pack isn't available."];
	const app = {
		appId: pack.appId,
		displayName: pack.displayName,
		version: "1.0"
	};
	const r = rehearseTask([{
		action: {
			kind: "file.open",
			path: "memory/table"
		},
		capability: cap,
		app
	}, {
		action: {
			kind: "clipboard.write",
			text: CSV
		},
		capability: cap,
		app
	}], {
		packs: registry.list(),
		scope: createTaskScope({
			id: "preflight",
			summary: "Read the pasted data",
			capabilities: ["file.open"],
			paths: ["memory"]
		}),
		health: /* @__PURE__ */ new Map(),
		availableMethods: ["file"],
		recording: "video_off"
	});
	if (!r.ok) return [r.reason];
	return [r.data.headline, ...r.data.steps.map((s) => `Step ${s.index + 1}: ${s.status} — ${s.reason}`)];
}
function runShadow() {
	const parsed = parseUnifiedDiff(GOOD_DIFF);
	if (!parsed.ok) return {
		safe: false,
		lines: parsed.reason
	};
	const r = shadowApplyPatch(FILE, parsed.data, {
		mustContain: ["Hello, ${name}"],
		mustNotContain: ["\"hi \" + name"],
		mustChange: true
	});
	if (!r.ok) return {
		safe: false,
		lines: r.reason
	};
	return {
		safe: r.data.safeToApply,
		lines: r.evidence
	};
}
function runReplay() {
	const receipt = (verified) => ({
		appId: "ocade.data",
		capabilityId: "data.summarise",
		method: "file",
		at: "2026-07-24T10:00:05.000Z",
		verified,
		evidence: verified ? "mean 80.00" : "NOT CONFIRMED: no check was possible"
	});
	const ledger = buildTaskLedger({
		taskId: "preflight-demo",
		intent: "Summarise and save",
		initialState: "CSV pasted, nothing computed",
		finalState: "First step done, second reverted",
		steps: [{
			intent: "Read the pasted data",
			receipt: receipt(true),
			status: "done",
			attempts: 1
		}, {
			intent: "Write the summary file",
			receipt: null,
			status: "failed",
			attempts: 2,
			recovery: {
				action: "undo",
				evidence: "reverted the partial write"
			}
		}],
		startedAt: "2026-07-24T10:00:00.000Z",
		finishedAt: "2026-07-24T10:00:12.000Z"
	});
	if (!ledger.ok) return ledger.reason;
	return serialiseReplay(buildReplay(ledger.data));
}
function PreflightPanel() {
	const [demo, setDemo] = (0, import_react.useState)(null);
	const rehearsal = demo === "rehearse" ? runRehearsal() : null;
	const shadow = demo === "shadow" ? runShadow() : null;
	const replay = demo === "replay" ? runReplay() : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "mb-1 flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldQuestionMark, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " Pre-flight safety checks"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-3 text-xs text-muted-foreground",
				children: "Three checks OCADE runs before it commits to a task — rehearse the whole plan without acting, prove a code change on a copy first, and turn a finished task into an honest replay that keeps the mistakes in. Each runs its real module here."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: demo === "rehearse" ? "default" : "ghost",
						className: "h-8",
						onClick: () => setDemo("rehearse"),
						children: "Rehearse a plan"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: demo === "shadow" ? "default" : "ghost",
						className: "h-8",
						onClick: () => setDemo("shadow"),
						children: "Shadow a code change"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: demo === "replay" ? "default" : "ghost",
						className: "h-8",
						onClick: () => setDemo("replay"),
						children: "Replay a task"
					})
				]
			}),
			rehearsal ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				className: "mt-3 rounded-lg border border-border/60 p-3 text-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-center gap-1.5 font-medium text-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), " Rehearsal — blockers surfaced before step one"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-1 flex flex-col gap-0.5 text-[11px] text-muted-foreground",
						children: rehearsal.map((l, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: l }, i))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1.5 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground",
						children: REHEARSAL_REALITY
					})
				]
			}) : null,
			shadow ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				className: cn("mt-3 rounded-lg border p-3 text-xs", shadow.safe ? "border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10" : "border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-center gap-1.5 font-medium text-foreground",
						children: [shadow.safe ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), shadow.safe ? "Shadow run clean — safe to apply" : "Shadow held the real file back"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-muted-foreground",
						children: shadow.lines
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1.5 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground",
						children: SHADOW_RULE
					})
				]
			}) : null,
			replay ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				className: "mt-3 rounded-lg border border-border/60 p-3 text-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "flex items-center gap-1.5 font-medium text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollText, {
						className: "h-3.5 w-3.5",
						"aria-hidden": true
					}), " Replay — the mistakes are kept in on purpose"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
					className: "mt-1 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-muted-foreground",
					children: replay
				})]
			}) : null
		]
	});
}
var KIND_LABEL = {
	observation: "Observed",
	retrieved_fact: "Fact",
	inference: "Inference",
	hypothesis: "Possibility",
	recommendation: "Suggestion",
	action: "Action"
};
/**
* Validate a single claim against the labelling rules.
*
* Returns the specific reason it's mislabelled, so the caller (or a test) sees
* exactly which honesty rule would have been broken.
*/
function validateClaim(claim) {
	if (!claim.text.trim()) return {
		ok: false,
		reason: "A claim can't be empty."
	};
	if (claim.kind === "retrieved_fact" && !claim.source?.trim()) return {
		ok: false,
		reason: `“${truncate(claim.text)}” is tagged as a retrieved fact but cites no source. A fact with no source is an inference in disguise — tag it as an inference or add the source.`
	};
	if (claim.timeSensitive && !claim.asOf?.trim()) return {
		ok: false,
		reason: `“${truncate(claim.text)}” is time-sensitive but has no timestamp. "As of when" is part of the claim — without it, it quietly goes stale.`
	};
	if (claim.asOf && Number.isNaN(Date.parse(claim.asOf))) return {
		ok: false,
		reason: `“${truncate(claim.text)}” has an unreadable timestamp.`
	};
	return {
		ok: true,
		data: claim,
		evidence: `${KIND_LABEL[claim.kind]} claim is well-formed.`
	};
}
/**
* Compose and validate a full answer.
*
* Rejects the whole answer if any claim is mislabelled — a single fact-shaped
* inference is enough to mislead, so it isn't quietly downgraded and shown
* anyway.
*/
function composeAnswer(claims) {
	if (claims.length === 0) return {
		ok: false,
		reason: "There are no claims to compose."
	};
	for (const claim of claims) {
		const check = validateClaim(claim);
		if (!check.ok) return check;
	}
	const breakdown = {
		observation: 0,
		retrieved_fact: 0,
		inference: 0,
		hypothesis: 0,
		recommendation: 0,
		action: 0
	};
	for (const c of claims) breakdown[c.kind]++;
	const grounded = breakdown.observation > 0 || breakdown.retrieved_fact > 0;
	const timeSensitive = claims.filter((c) => c.timeSensitive);
	const recommendsWithoutGround = (breakdown.recommendation > 0 || breakdown.action > 0) && !grounded;
	return {
		ok: true,
		data: {
			claims,
			breakdown,
			grounded,
			timeSensitive
		},
		evidence: recommendsWithoutGround ? `${claims.length} claims, but nothing observed or cited underneath the recommendation — it rests on reasoning alone.` : `${claims.length} claims: ${describeBreakdown(breakdown)}.`
	};
}
function describeBreakdown(b) {
	return Object.entries(b).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${KIND_LABEL[k].toLowerCase()}`).join(", ");
}
/**
* Render an answer with its claims visibly separated by kind.
*
* The prefixes are the point: a reader scanning the answer sees "Inference:"
* and "Fact:" as distinct, and never mistakes one for the other.
*/
function renderAnswer(answer) {
	return answer.claims.map((c) => {
		const stamp = c.asOf ? ` (as of ${c.asOf})` : "";
		const cite = c.kind === "retrieved_fact" && c.source ? ` [${c.source}]` : "";
		return `${KIND_LABEL[c.kind]}: ${c.text}${stamp}${cite}`;
	}).join("\n");
}
function truncate(s) {
	return s.length > 48 ? `${s.slice(0, 48)}…` : s;
}
/**
* Find the passage in `sourceText` that best supports the given terms.
*
* Terms are matched as whole words, case-insensitively. The window with the
* most DISTINCT terms wins (density of distinct evidence, not raw repetition of
* one word), with ties broken toward the tighter cluster.
*/
function extractSnippet(sourceText, terms, opts = {}) {
	const windowChars = opts.windowChars ?? 240;
	if (!sourceText.trim()) return {
		ok: false,
		reason: "The source has no text to quote from."
	};
	const meaningful = terms.map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2);
	if (meaningful.length === 0) return {
		ok: false,
		reason: "No usable search terms were given, so OCADE can't locate a supporting passage."
	};
	const wanted = [...new Set(meaningful)];
	const hits = [];
	for (const term of wanted) {
		const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
		let m;
		while ((m = re.exec(sourceText)) !== null) {
			hits.push({
				term,
				index: m.index
			});
			if (m.index === re.lastIndex) re.lastIndex++;
		}
	}
	if (hits.length === 0) return {
		ok: false,
		reason: "None of the claim's terms appear in this source, so there is no passage that supports it. OCADE won't quote an unrelated excerpt as evidence."
	};
	hits.sort((a, b) => a.index - b.index);
	let best = {
		start: 0,
		distinct: 0,
		span: Infinity,
		terms: []
	};
	for (let i = 0; i < hits.length; i++) {
		const windowStart = hits[i].index;
		const windowEnd = windowStart + windowChars;
		const inWindow = hits.filter((h) => h.index >= windowStart && h.index < windowEnd);
		const distinct = new Set(inWindow.map((h) => h.term));
		const span = inWindow[inWindow.length - 1].index - windowStart;
		if (distinct.size > best.distinct || distinct.size === best.distinct && span < best.span) best = {
			start: windowStart,
			distinct: distinct.size,
			span,
			terms: [...distinct]
		};
	}
	const rawStart = best.start;
	const start = Math.max(0, backToBoundary(sourceText, rawStart));
	const end = Math.min(sourceText.length, forwardToBoundary(sourceText, rawStart + windowChars));
	const text = sourceText.slice(start, end).trim();
	const contained = wanted.filter((t) => new RegExp(`\\b${escapeRegExp(t)}\\b`, "i").test(text));
	if (contained.length === 0) return {
		ok: false,
		reason: "OCADE couldn't extract a passage that actually contains the terms, so it won't return one."
	};
	const line = sourceText.slice(0, start).split("\n").length;
	return {
		ok: true,
		data: {
			text,
			offset: start,
			line,
			matchedTerms: contained
		},
		evidence: `Found a supporting passage at line ${line} covering ${contained.length} of ${wanted.length} term(s): ${contained.join(", ")}.`
	};
}
function escapeRegExp(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/** Walk back to the start of the current word, but not past a sentence break. */
function backToBoundary(text, index) {
	let i = index;
	while (i > 0 && /\S/.test(text[i - 1]) && !/[.!?\n]/.test(text[i - 1])) i--;
	return i;
}
/** Walk forward to the end of the current word or the next sentence break. */
function forwardToBoundary(text, index) {
	let i = Math.min(index, text.length);
	while (i < text.length && /\S/.test(text[i]) && !/[.!?\n]/.test(text[i])) i++;
	if (i < text.length && /[.!?]/.test(text[i])) i++;
	return i;
}
/**
* OCADE cited-answer orchestrator — composes claim assessment (§5.1
* contradiction/authority/syndication) with evidence-snippet location so an
* answer carries, per supporting source, the exact passage that backs it.
*
* This is the execution-path consumer for `evidence-snippet`: it is not called
* blind, it is called for each supporting source of an assessed claim, using
* the claim's own terms, and a source whose text does NOT contain the claim's
* terms yields no snippet — which is surfaced honestly rather than hidden.
*
* The honesty of both pieces flows through: the claim's confidence and
* uncertainties come from `assessClaim` unchanged, and a citation only appears
* when a real supporting passage was found. A claim OCADE won't state produces
* no citations, because there is nothing to cite.
*/
/** Split a claim's text into search terms (words of 3+ letters, deduped). */
function termsFrom(text) {
	const words = text.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? [];
	const stop = /* @__PURE__ */ new Set([
		"the",
		"and",
		"for",
		"that",
		"this",
		"with",
		"was",
		"were",
		"has",
		"have",
		"will",
		"are",
		"from",
		"into",
		"over",
		"about",
		"their",
		"they",
		"been"
	]);
	return [...new Set(words.filter((w) => !stop.has(w)))];
}
/**
* Assess a claim and attach a located citation for each supporting source whose
* text actually contains the claim's terms.
*
* `sourceTexts` maps a source id to the readable text OCADE has for it. A
* source with no text, or no matching passage, is listed under
* `sourcesWithoutEvidence` rather than cited — no passage, no citation.
*/
function buildCitedAnswer(claim, sourceTexts, now = /* @__PURE__ */ new Date()) {
	const assessment = assessClaim(claim, now);
	const citations = [];
	const without = [];
	const citeable = assessment.confidence !== "unsupported" && assessment.confidence !== "contested";
	const terms = termsFrom(claim.text);
	if (citeable) for (const source of independentSources(claim.supporting)) {
		const text = sourceTexts.get(source.id);
		if (!text || !text.trim()) {
			without.push(source.publisher);
			continue;
		}
		const snip = extractSnippet(text, terms);
		if (!snip.ok) {
			without.push(source.publisher);
			continue;
		}
		citations.push({
			sourceId: source.id,
			publisher: source.publisher,
			snippet: snip.data.text,
			line: snip.data.line,
			matchedTerms: snip.data.matchedTerms
		});
	}
	return {
		assessment,
		summary: describeAssessment(assessment),
		citations,
		sourcesWithoutEvidence: without
	};
}
/**
* Answer-quality checks, on this device. Two rules OCADE applies to what it
* says, each running its real module:
*
*  - SEPARATE (chat/answer-composition): every claim is labelled by kind —
*    Observed / Fact / Inference / Possibility / Suggestion / Action — and a
*    fact with no source is refused rather than shown as if grounded (§4.3).
*  - CITE (research/cited-answer): a supported claim carries a LOCATED passage
*    from each source whose text actually contains its terms; a source with no
*    matching passage is listed as evidence-less, never cited (§5.1).
*/
var NOW = /* @__PURE__ */ new Date();
var minsAgo = (n) => /* @__PURE__ */ new Date(NOW.getTime() - n * 6e4);
function composeDemo() {
	const r = composeAnswer([
		{
			kind: "observation",
			text: "The build finished with exit code 0."
		},
		{
			kind: "retrieved_fact",
			text: "The ledger records 2,567 passing tests.",
			source: "OCADE_EXECUTION_PROGRESS.md"
		},
		{
			kind: "inference",
			text: "So the suite is currently green."
		},
		{
			kind: "recommendation",
			text: "Re-run the full gate before committing."
		}
	]);
	if (!r.ok) return {
		rendered: r.reason,
		evidence: ""
	};
	return {
		rendered: renderAnswer(r.data),
		evidence: r.evidence
	};
}
function mislabelDemo() {
	const r = composeAnswer([{
		kind: "retrieved_fact",
		text: "Sales rose 20% last quarter."
	}]);
	return r.ok ? "unexpectedly accepted" : r.reason;
}
function citeDemo() {
	const src = (id, publisher) => ({
		id,
		title: `${publisher} report`,
		publisher,
		kind: "news",
		publishedAt: minsAgo(30),
		retrievedAt: NOW
	});
	const r = buildCitedAnswer({
		text: "The council approved the new bridge.",
		topic: "local government",
		supporting: [src("S1", "City Herald"), src("S2", "Morning News")]
	}, /* @__PURE__ */ new Map([["S1", "At last night's meeting the council approved the new bridge by a clear majority."], ["S2", "Tomorrow's weather will be mild with light showers."]]), NOW);
	return {
		summary: r.summary,
		cited: r.citations.map((c) => `[${c.sourceId}] ${c.publisher}: “${c.snippet}”`),
		without: r.sourcesWithoutEvidence
	};
}
function AnswerQualityPanel() {
	const [demo, setDemo] = (0, import_react.useState)(null);
	const compose = demo === "separate" ? composeDemo() : null;
	const mislabel = demo === "separate" ? mislabelDemo() : null;
	const cite = demo === "cite" ? citeDemo() : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "mb-1 flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListChecks, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), " Answer quality"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-3 text-xs text-muted-foreground",
				children: "Two rules OCADE applies to what it says: label every claim by kind so an inference is never read as a fact, and cite the located passage under a supported claim. Both run their real module here."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: demo === "separate" ? "default" : "ghost",
					className: "h-8",
					onClick: () => setDemo("separate"),
					children: "Separate the claims"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: demo === "cite" ? "default" : "ghost",
					className: "h-8",
					onClick: () => setDemo("cite"),
					children: "Cite the evidence"
				})]
			}),
			compose ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				className: "mt-3 rounded-lg border border-border/60 p-3 text-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium text-foreground",
						children: "Every claim labelled by kind"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
						className: "mt-1 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground",
						children: compose.rendered
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1.5 text-[10px] text-muted-foreground",
						children: compose.evidence
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1.5 flex items-center gap-1 border-t border-border/60 pt-1.5 text-[11px] text-[color:var(--state-warning)]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
								className: "h-3.5 w-3.5",
								"aria-hidden": true
							}),
							" A fact with no source is refused:",
							" ",
							mislabel
						]
					})
				]
			}) : null,
			cite ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				className: "mt-3 rounded-lg border border-border/60 p-3 text-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "flex items-center gap-1.5 font-medium text-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Quote, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), " Located citations"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-muted-foreground",
						children: cite.summary
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-1.5 flex flex-col gap-1",
						children: cite.cited.map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "text-[11px] text-muted-foreground",
							children: c
						}, i))
					}),
					cite.without.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1.5 border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground",
						children: ["No matching passage, so not cited: ", cite.without.join(", ")]
					}) : null
				]
			}) : null
		]
	});
}
function LabPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "OCADE",
		title: "Lab",
		description: "Engineering diagnostics, governed execution, research verification and runtime validation. This is intentionally technical; creative work lives in Studio.",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/ocade/studio",
			className: "inline-flex min-h-[24px] items-center px-1 py-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground",
			children: "Open Studio"
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
				className: "p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Lab surfaces inspect what OCADE can prove before a run, patch, browser/research claim or visual output is accepted. A diagnostic result is evidence, not a substitute for production runtime verification."
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConversationControls, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GovernedRunPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreflightPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResearchPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnswerQualityPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PatchPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiagnosticsPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EngineeringControlPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResourceGovernorPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocalJobPlanPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppCoveragePanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScenePanel, {})
		]
	})] });
}
//#endregion
export { LabPage as component };
