import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { At as Mic, N as ShieldAlert, Y as RefreshCw, c as Volume2, st as Play, w as Square } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as useVoicePrefs, t as listAudioDevices } from "./use-voice-prefs-CPa6Xy55.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { a as languageStatus, c as redactForSpeech, f as supportedLanguages, i as detectVoiceCapabilities, n as buildGreeting, p as toVoiceOptions, s as pickVoice, t as DEFAULT_WAKE_PHRASES } from "./transcript-redaction-CqR1_exv.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings.voice-CDHHIKYq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function VoiceSettingsPage() {
	const { prefs, update, emergencyMute, storageError } = useVoicePrefs();
	const [voices, setVoices] = (0, import_react.useState)([]);
	const [devices, setDevices] = (0, import_react.useState)({
		inputs: [],
		outputs: []
	});
	const [speaking, setSpeaking] = (0, import_react.useState)(false);
	const caps = typeof window !== "undefined" ? detectVoiceCapabilities(window) : {
		synthesis: false,
		recognition: false,
		wakePhrase: false,
		wakeReason: "Wake phrase availability can only be checked in a browser."
	};
	/**
	* @param announce - true when a person pressed "Refresh voices", false for
	*   the automatic loads on mount and on `voiceschanged`.
	*
	* A refresh that reports nothing is indistinguishable from a dead button.
	* The voice list is usually identical between two reads — the browser has
	* already loaded it — so pressing refresh changed no pixel and gave the user
	* no reason to believe the control existed. Worse, a browser with no speech
	* engine returned early and silently, which is precisely the case where an
	* explanation is owed.
	*
	* The automatic loads stay silent: nobody asked, so nobody needs telling.
	*/
	const loadVoices = (0, import_react.useCallback)((announce = false) => {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) {
			if (announce) toast.error("This browser has no speech engine, so there are no voices to list.");
			return;
		}
		const next = toVoiceOptions(window.speechSynthesis.getVoices());
		setVoices(next);
		if (!announce) return;
		if (next.length === 0) {
			toast.error("No voices found. The operating system may still be installing them.", { description: "Voices are provided by the system, not by OCADE." });
			return;
		}
		toast.success(`${next.length} voice${next.length === 1 ? "" : "s"} available.`);
	}, []);
	(0, import_react.useEffect)(() => {
		loadVoices();
		if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = () => loadVoices(false);
		listAudioDevices().then(setDevices);
		return () => {
			if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = null;
		};
	}, [loadVoices]);
	async function requestMicrophone() {
		try {
			(await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop());
			setDevices(await listAudioDevices());
			toast.success("Microphone allowed. Device names are now visible.");
		} catch {
			toast.error("Microphone access was denied. Push-to-talk needs it to hear you.");
		}
	}
	function speakSample() {
		if (!caps.synthesis) {
			toast.error("This browser has no speech engine, so OCADE can't speak here.");
			return;
		}
		if (prefs.muted) {
			toast.error("OCADE Voice is muted. Unmute to hear the sample.");
			return;
		}
		window.speechSynthesis.cancel();
		const greeting = buildGreeting({
			style: prefs.addressStyle,
			preferredName: prefs.preferredName,
			customTitle: prefs.preferredTitle,
			enabled: prefs.greetingEnabled
		}, (/* @__PURE__ */ new Date()).getHours());
		const u = new SpeechSynthesisUtterance(redactForSpeech(`${greeting} This is your OCADE voice.`).text);
		const chosen = pickVoice(voices, {
			gender: prefs.gender,
			lang: prefs.language
		});
		if (chosen) {
			const match = window.speechSynthesis.getVoices().find((v) => v.name === chosen.name);
			if (match) u.voice = match;
		}
		u.rate = prefs.rate;
		u.pitch = prefs.pitch;
		u.lang = prefs.language;
		u.onstart = () => setSpeaking(true);
		u.onend = () => setSpeaking(false);
		u.onerror = () => setSpeaking(false);
		window.speechSynthesis.speak(u);
	}
	function stopSpeaking() {
		if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
		setSpeaking(false);
	}
	const langs = supportedLanguages();
	const deviceLanguage = typeof navigator !== "undefined" ? navigator.language : "";
	const deviceLanguageStatus = languageStatus(deviceLanguage);
	const deviceLanguageLabel = (() => {
		if (!deviceLanguage) return "";
		try {
			return new Intl.DisplayNames([deviceLanguage], { type: "language" }).of(deviceLanguage) ?? deviceLanguage;
		} catch {
			return deviceLanguage;
		}
	})();
	const genderVoices = (g) => voices.filter((v) => v.gender === g && v.lang.toLowerCase().startsWith(prefs.language.slice(0, 2)));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "Settings",
		title: "OCADE Voice",
		description: "Speak to OCADE and hear replies. Voice uses the same conversations, memory and permissions as typed chat.",
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
			variant: "ghost",
			size: "sm",
			onClick: emergencyMute,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "mr-1.5 h-4 w-4" }), " Emergency mute"]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-5",
		children: [
			!caps.synthesis || !caps.recognition ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-medium text-foreground",
					children: "Limited voice support in this browser"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-muted-foreground",
					children: [
						caps.recognition ? "" : "Speech recognition is unavailable, so push-to-talk won't work here. ",
						caps.synthesis ? "" : "Speech output is unavailable, so OCADE can't speak here. ",
						"Everything else on this page still saves."
					]
				})]
			}) : null,
			storageError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "border-[color:var(--state-warning)]/50 p-4 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-medium text-foreground",
					children: "Voice settings were not saved"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-muted-foreground",
					children: storageError
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mb-1 text-sm font-semibold",
						children: "Voice"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-3 text-xs text-muted-foreground",
						children: "OCADE has no default voice — choose the one you prefer."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [["female", "male"].map((g) => {
							const available = genderVoices(g).length > 0;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => update({
									gender: g,
									voiceName: genderVoices(g)[0]?.name ?? null
								}),
								disabled: !available,
								className: cn("rounded-md border px-3 py-1.5 text-sm capitalize transition-colors", prefs.gender === g ? "border-foreground/40 bg-sidebar-accent text-foreground" : "border-border/70 text-muted-foreground hover:text-foreground", !available && "cursor-not-allowed opacity-40"),
								title: available ? `Use the ${g} voice` : `No ${g} voice is installed for this language`,
								children: ["OCADE ", g]
							}, g);
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "ghost",
							size: "sm",
							onClick: () => loadVoices(true),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "mr-1.5 h-4 w-4" }), " Refresh voices"]
						})]
					}),
					prefs.gender === "unknown" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-muted-foreground",
						children: "No voice chosen yet."
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "mb-1 block text-muted-foreground",
								children: [
									"Speed — ",
									prefs.rate.toFixed(1),
									"×"
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "range",
								min: .5,
								max: 2,
								step: .1,
								value: prefs.rate,
								onChange: (e) => update({ rate: Number(e.target.value) }),
								className: "h-6 w-full accent-[color:var(--foreground)]"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "mb-1 block text-muted-foreground",
								children: ["Pitch — ", prefs.pitch.toFixed(1)]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "range",
								min: .5,
								max: 2,
								step: .1,
								value: prefs.pitch,
								onChange: (e) => update({ pitch: Number(e.target.value) }),
								className: "h-6 w-full accent-[color:var(--foreground)]"
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							onClick: speakSample,
							disabled: !caps.synthesis,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "mr-1.5 h-4 w-4" }), " Test voice"]
						}), speaking ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "ghost",
							onClick: stopSpeaking,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "mr-1.5 h-4 w-4" }), " Stop"]
						}) : null]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mb-1 text-sm font-semibold",
						children: "Language"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-3 text-xs text-muted-foreground",
						children: "A language appears here only when its speech input, output and wake phrase have been verified."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-2",
						children: langs.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							"aria-pressed": prefs.language === l.code,
							onClick: () => update({
								language: l.code,
								voiceName: null
							}),
							className: cn("rounded-md border px-3 py-1.5 text-sm transition-colors", prefs.language === l.code ? "border-foreground/40 bg-sidebar-accent text-foreground" : "border-border/70 text-muted-foreground hover:text-foreground"),
							children: l.label
						}, l.code))
					}),
					deviceLanguage && !deviceLanguageStatus.supported ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 rounded-lg border border-border/60 bg-secondary/25 p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs font-medium text-foreground",
								children: ["Your device is set to ", deviceLanguageLabel]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-0.5 text-xs text-muted-foreground",
								children: deviceLanguageStatus.reason
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: [
									"OCADE Voice will use ",
									langs[0]?.label ?? "English",
									" instead. Typed chat is unaffected and works in your language."
								]
							})
						]
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: "mb-1 flex items-center gap-2 text-sm font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), " Microphone and output"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-3 text-xs text-muted-foreground",
						children: "Push-to-talk uses your browser's speech engine. Depending on the browser and operating system, microphone audio may be processed by an online speech service. OCADE does not store the audio."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mb-1 block text-muted-foreground",
								children: "Microphone"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								value: "",
								disabled: true,
								className: "h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "",
									children: "System default (browser controlled)"
								})
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "mb-1 block text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, {
									className: "mr-1 inline h-3.5 w-3.5",
									"aria-hidden": true
								}), " Output"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								value: "",
								disabled: true,
								className: "h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "",
									children: "System default (browser controlled)"
								})
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-[11px] text-muted-foreground",
						children: [
							"Detected ",
							devices.inputs.length,
							" input and ",
							devices.outputs.length,
							" output device",
							devices.inputs.length + devices.outputs.length === 1 ? "" : "s",
							". Web Speech does not provide a reliable API for routing recognition or synthesis to a selected device, so both use the browser/OS default."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "sm",
						className: "mt-3",
						onClick: () => void requestMicrophone(),
						children: "Allow microphone"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mb-1 text-sm font-semibold",
						children: "Hands-free"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "mt-2 flex min-h-[24px] items-start gap-2 py-1 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: prefs.wakeEnabled,
							disabled: !caps.wakePhrase,
							onChange: (e) => update({ wakeEnabled: e.target.checked }),
							className: "mt-1 h-4 w-4 accent-[color:var(--foreground)]"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Enable the wake phrase", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-xs text-muted-foreground",
							children: caps.wakePhrase ? `Say “${DEFAULT_WAKE_PHRASES[0]}” or “${DEFAULT_WAKE_PHRASES[1]}”. This engine exposes local recognition. Off by default.` : caps.wakeReason ?? "Local wake-phrase recognition is unavailable in this browser."
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "mt-3 flex min-h-[24px] items-start gap-2 py-1 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: prefs.captionsEnabled,
							onChange: (e) => update({ captionsEnabled: e.target.checked }),
							className: "mt-1 h-4 w-4 accent-[color:var(--foreground)]"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Show captions", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-xs text-muted-foreground",
							children: "Display what OCADE hears and says."
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "mt-3 flex min-h-[24px] items-start gap-2 py-1 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: prefs.autoSpeak,
							onChange: (e) => update({
								autoSpeak: e.target.checked,
								muted: false
							}),
							className: "mt-1 h-4 w-4 accent-[color:var(--foreground)]"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Speak replies automatically", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-xs text-muted-foreground",
							children: "You can always interrupt OCADE while it is speaking."
						})] })]
					}),
					prefs.muted ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-3 rounded-md bg-[color:var(--state-warning)]/10 px-3 py-2 text-xs text-[color:var(--state-warning)]",
						children: [
							"Voice output is muted by emergency mute.",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "underline",
								onClick: () => update({ muted: false }),
								children: "Unmute"
							})
						]
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mb-1 text-sm font-semibold",
						children: "How OCADE addresses you"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-3 text-xs text-muted-foreground",
						children: "OCADE never guesses a title from your name or voice — it uses exactly what you set here."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mb-1 block text-muted-foreground",
								children: "Preferred name"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: prefs.preferredName,
								onChange: (e) => update({ preferredName: e.target.value }),
								placeholder: "e.g. Alex",
								className: "h-9 text-sm"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mb-1 block text-muted-foreground",
								children: "Preferred title (optional)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: prefs.preferredTitle,
								onChange: (e) => update({ preferredTitle: e.target.value }),
								placeholder: "Leave blank for no title",
								className: "h-9 text-sm"
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: [
							["first_name", "First name"],
							["full_name", "Full name"],
							["custom_title", "Custom title"],
							["none", "No name"]
						].map(([value, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							"aria-pressed": prefs.addressStyle === value,
							onClick: () => update({ addressStyle: value }),
							className: cn("rounded-md border px-3 py-1.5 text-sm transition-colors", prefs.addressStyle === value ? "border-foreground/40 bg-sidebar-accent text-foreground" : "border-border/70 text-muted-foreground hover:text-foreground"),
							children: label
						}, value))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "mt-3 flex min-h-[24px] items-center gap-2 py-1 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: prefs.greetingEnabled,
							onChange: (e) => update({ greetingEnabled: e.target.checked }),
							className: "h-4 w-4 accent-[color:var(--foreground)]"
						}), "Greet me when a voice session starts"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-3 rounded-md bg-secondary/40 px-3 py-2 text-xs text-muted-foreground",
						children: [
							"Preview:",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-foreground",
								children: buildGreeting({
									style: prefs.addressStyle,
									preferredName: prefs.preferredName,
									customTitle: prefs.preferredTitle,
									enabled: prefs.greetingEnabled
								}, (/* @__PURE__ */ new Date()).getHours()) || "(no greeting)"
							})
						]
					})
				]
			})
		]
	})] });
}
//#endregion
export { VoiceSettingsPage as component };
