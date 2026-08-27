import { a as __toESM } from "../_runtime.mjs";
import { s as performance_default } from "../_libs/h3+rou3+srvx+unenv.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as useAppearance } from "./use-appearance-DRtxpe7r.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as WEBSITE_STRUCTURED_DATA } from "./ssr.mjs";
import { t as SiteFooterLinks } from "./SiteFooter-CIpVmEmM.mjs";
import { Tr as ArrowDown, q as RotateCcw } from "../_libs/lucide-react.mjs";
import { a as introSeen, i as introPhaseAt, n as chooseRenderTier, o as markIntroSeen, r as forgetIntro, t as PLANETS } from "./universe-CvRdDAaW.mjs";
import { t as OcadeCompanion } from "./OcadeCompanion-ChgP1je7.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-U1YungZ6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** Deterministic random numbers keep the formation identical on every replay. */
function randomGenerator(seed = 13295144) {
	let state = seed >>> 0;
	return () => {
		state = Math.imul(state, 1664525) + 1013904223 >>> 0;
		return state / 4294967296;
	};
}
function easeOutQuint(value) {
	return 1 - (1 - Math.min(1, Math.max(0, value))) ** 5;
}
/**
* Builds the OCADE seal from depth-scattered particles.
*
* The source is the same-origin brand asset, so the animation remains usable
* offline and never pulls a logo, font or script from a CDN. The canvas is
* decorative; the real heading directly beneath it remains selectable,
* keyboard-safe and readable by assistive technology.
*/
function ParticleLogoIntro({ phase, reducedMotion, tier }) {
	const canvasRef = (0, import_react.useRef)(null);
	const active = phase !== "ambient" && !reducedMotion && tier !== "static";
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas || !active) return;
		const context = canvas.getContext("2d", { alpha: true });
		if (!context) return;
		let animationFrame = 0;
		let cancelled = false;
		let particles = [];
		let width = 0;
		let height = 0;
		let ratio = 1;
		const startedAt = performance_default.now();
		const random = randomGenerator();
		const resize = () => {
			const bounds = canvas.getBoundingClientRect();
			width = Math.max(1, bounds.width);
			height = Math.max(1, bounds.height);
			ratio = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.round(width * ratio);
			canvas.height = Math.round(height * ratio);
			context.setTransform(ratio, 0, 0, ratio, 0, 0);
		};
		const image = new Image();
		image.decoding = "async";
		image.src = "/brand/ocade-carcc-mark.png";
		const buildParticles = () => {
			const sampleSize = tier === "full" ? 240 : 180;
			const sample = document.createElement("canvas");
			sample.width = sampleSize;
			sample.height = sampleSize;
			const sampleContext = sample.getContext("2d", { willReadFrequently: true });
			if (!sampleContext) return;
			sampleContext.drawImage(image, 0, 0, sampleSize, sampleSize);
			const pixels = sampleContext.getImageData(0, 0, sampleSize, sampleSize).data;
			const step = tier === "full" ? 4 : 5;
			const scale = Math.min(width, height) * .52;
			const left = width / 2 - scale / 2;
			const top = height * .42 - scale / 2;
			const next = [];
			for (let y = 0; y < sampleSize; y += step) for (let x = 0; x < sampleSize; x += step) {
				const offset = (y * sampleSize + x) * 4;
				const alpha = pixels[offset + 3];
				const luminance = pixels[offset] + pixels[offset + 1] + pixels[offset + 2];
				if (alpha < 72 || luminance < 54) continue;
				const angle = random() * Math.PI * 2;
				const radius = Math.max(width, height) * (.42 + random() * .52);
				next.push({
					startX: width / 2 + Math.cos(angle) * radius,
					startY: height * .42 + Math.sin(angle) * radius,
					startZ: -900 + random() * 1800,
					targetX: left + x / sampleSize * scale,
					targetY: top + y / sampleSize * scale,
					red: pixels[offset],
					green: pixels[offset + 1],
					blue: pixels[offset + 2],
					size: .65 + random() * 1.5,
					delay: random() * .34
				});
			}
			particles = next;
		};
		const draw = (now) => {
			if (cancelled) return;
			context.clearRect(0, 0, width, height);
			const elapsed = (now - startedAt) / 1950;
			context.save();
			context.globalCompositeOperation = "lighter";
			for (const particle of particles) {
				const progress = easeOutQuint((elapsed - particle.delay) / (1 - particle.delay));
				if (progress <= 0) continue;
				const z = particle.startZ * (1 - progress);
				const perspective = 760 / Math.max(120, 760 + z);
				const x = (particle.startX + (particle.targetX - particle.startX) * progress - width / 2) * perspective + width / 2;
				const y = (particle.startY + (particle.targetY - particle.startY) * progress - height * .42) * perspective + height * .42;
				const opacity = Math.min(1, progress * 1.7) * (.52 + perspective * .36);
				context.fillStyle = `rgba(${particle.red},${particle.green},${particle.blue},${opacity})`;
				context.beginPath();
				context.arc(x, y, Math.max(.45, particle.size * perspective), 0, Math.PI * 2);
				context.fill();
			}
			context.restore();
			animationFrame = requestAnimationFrame(draw);
		};
		const observer = new ResizeObserver(() => {
			resize();
			if (image.complete && image.naturalWidth > 0) buildParticles();
		});
		observer.observe(canvas);
		resize();
		image.addEventListener("load", buildParticles, { once: true });
		animationFrame = requestAnimationFrame(draw);
		return () => {
			cancelled = true;
			cancelAnimationFrame(animationFrame);
			observer.disconnect();
			image.removeEventListener("load", buildParticles);
			context.clearRect(0, 0, width, height);
		};
	}, [active, tier]);
	if (!active) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
		ref: canvasRef,
		"aria-hidden": "true",
		className: cn("pointer-events-none fixed inset-0 z-20 h-[100svh] w-full transition-opacity duration-700", phase === "ignition" ? "opacity-0" : "opacity-100")
	});
}
var SolarSystem = (0, import_react.lazy)(() => import("./SolarSystem-KWftfQm0.mjs").then((m) => ({ default: m.SolarSystem })));
/**
* The landing experience: an opening, then a system you can play with.
*
* THE FIRST SCREEN IS THE PRODUCT, NOT A DESCRIPTION OF IT. There is no
* paragraph explaining what OCADE is, because a sentence read once is worth
* less than thirty seconds spent turning a solar system — and the sentence was
* competing with the only thing on the page anyone remembers. The identity, a
* scroll cue, and eight planets you can drag. Nothing else.
*
* THE CANVAS IS STICKY, NOT FIXED, and that is load-bearing rather than
* stylistic. `position: fixed` is contained by any ancestor with a `transform`
* or `perspective`, and the application's depth scene sets `perspective` on its
* scroll container — a fixed canvas would be trapped inside it and scroll away.
* Sticky is unaffected, and it produces the effect the page is after anyway:
* the system stays behind the content as the sections move over it, so the
* planets carry through the whole page instead of the page being a stack of
* separate rectangles.
*
* THE OPENING PLAYS ONCE PER DEVICE. Remembered in `localStorage`, with a
* replay control. By the third visit an unskippable five seconds is not
* atmosphere, it is a toll.
*
* REDUCED MOTION IS ABSOLUTE. `prefers-reduced-motion` skips the sequence and
* paints a single still frame — someone who asked their operating system to
* stop animations usually did it because animation makes them ill.
*
* THE CANVAS IS DECORATION; THE CAPABILITY LIST IS THE INTERFACE. Every planet
* is also a real button further down the page, so the eight capabilities are
* reachable by keyboard and readable by a screen reader without touching the
* animation.
*/
function LandingUniverse() {
	const appearance = useAppearance();
	const reducedMotion = appearance.reducedMotion || appearance.osReducedMotion;
	const [phase, setPhase] = (0, import_react.useState)("ambient");
	const [hovered, setHovered] = (0, import_react.useState)(null);
	const [tier, setTier] = (0, import_react.useState)("full");
	const [scrolled, setScrolled] = (0, import_react.useState)(false);
	const startedAt = (0, import_react.useRef)(0);
	const [pinnedId, setPinnedId] = (0, import_react.useState)(null);
	const active = (0, import_react.useMemo)(() => PLANETS.find((p) => p.id === pinnedId) ?? null, [pinnedId]) ?? hovered;
	(0, import_react.useEffect)(() => {
		const navigatorish = navigator;
		setTier(chooseRenderTier({
			reducedMotion,
			cores: navigatorish.hardwareConcurrency,
			memoryGb: navigatorish.deviceMemory,
			viewportWidth: window.innerWidth
		}));
	}, [reducedMotion]);
	const sentinelRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel) return;
		const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), { threshold: 0 });
		observer.observe(sentinel);
		let viewport = window.innerHeight;
		const measure = () => {
			viewport = window.innerHeight;
		};
		const onScroll = () => setScrolled(window.scrollY > viewport * .18);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", measure, { passive: true });
		return () => {
			observer.disconnect();
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", measure);
		};
	}, []);
	const runIntro = (0, import_react.useMemo)(() => {
		if (typeof window === "undefined") return false;
		return !reducedMotion && !introSeen();
	}, [reducedMotion]);
	const play = (0, import_react.useMemo)(() => () => {
		setPhase("wordmark");
		startedAt.current = performance_default.now();
		let frame = 0;
		const tick = () => {
			const next = introPhaseAt(performance_default.now() - startedAt.current);
			setPhase(next);
			if (next === "ambient") {
				markIntroSeen();
				return;
			}
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!runIntro) {
			setPhase("ambient");
			return;
		}
		return play();
	}, [runIntro, play]);
	const introRunning = phase !== "ambient";
	const centred = introRunning || !scrolled;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-none sticky top-0 z-0 h-[100svh] overflow-hidden",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
						fallback: null,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SolarSystem, { className: "pointer-events-auto absolute inset-0 h-full w-full" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						"aria-hidden": true,
						className: "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,oklch(0.06_0.01_90/0.78)_100%)]"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						"aria-hidden": true,
						className: cn("pointer-events-none absolute inset-0 bg-background transition-opacity duration-700", scrolled ? "opacity-70" : "opacity-0")
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ParticleLogoIntro, {
				phase,
				reducedMotion,
				tier
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("pointer-events-none fixed z-30 will-change-transform", "transition-all duration-[1100ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]", "motion-reduce:transition-none", phase === "wordmark" ? "scale-95 opacity-0" : "scale-100 opacity-100", centred ? "left-1/2 top-[42svh] -translate-x-1/2 -translate-y-1/2 text-center" : "left-4 top-3 translate-x-0 translate-y-0 text-left sm:left-6 sm:top-4"),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: cn("relative", "transition-all duration-[1100ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]", "motion-reduce:transition-none", centred ? "w-[82vw] max-w-[900px]" : "w-[210px] sm:w-[250px]"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "sr-only",
						children: "OCADE by CARCC CADANE — Command the Next Era."
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: "/brand/ocade-carcc-wordmark.png",
						alt: "",
						width: 2172,
						height: 724,
						className: "h-auto w-full drop-shadow-[0_16px_45px_rgba(0,0,0,0.75)]",
						fetchPriority: "high"
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				"aria-label": "OCADE",
				className: "pointer-events-none relative z-10 -mt-[100svh] flex h-[100svh] flex-col justify-end px-4 pb-10",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						ref: sentinelRef,
						"aria-hidden": true,
						className: "absolute left-0 top-[18svh] h-px w-px"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: cn("mx-auto flex flex-col items-center gap-5 transition-opacity duration-700", introRunning || scrolled ? "pointer-events-none opacity-0" : "opacity-100"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "pointer-events-none max-w-md text-balance text-center text-[14px] leading-relaxed text-muted-foreground",
								children: "A private AI assistant that runs on your own hardware wherever it can."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "pointer-events-auto flex flex-wrap items-center justify-center gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/auth",
									className: "inline-flex h-11 items-center justify-center rounded-full bg-primary px-7 text-[13.5px] font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0",
									children: "Get started"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/demo/ocade",
									className: "inline-flex h-11 items-center justify-center rounded-full border border-border/70 bg-background/40 px-7 text-[13.5px] font-medium text-foreground backdrop-blur transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									children: "Try the demo"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "pointer-events-none rounded-full border border-border/40 bg-background/30 px-4 py-1.5 text-[12px] text-muted-foreground/90 backdrop-blur-sm",
								children: [
									"Scroll down to sign in or get started",
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, {
										className: "ml-0.5 inline h-3 w-3",
										"aria-hidden": true
									})
								]
							}),
							tier !== "static" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-muted-foreground/50",
								children: "Drag to turn · scroll to zoom · click a planet"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-muted-foreground/50",
								children: "Motion reduced, following your system setting."
							})
						]
					}),
					!introRunning ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OcadeCompanion, {
						label: "I can answer locally, then—with permission—work through the signed desktop companion.",
						className: "pointer-events-none absolute bottom-6 right-4 hidden xl:flex"
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] font-medium uppercase tracking-[0.3em] text-primary/80",
					children: "Try it first"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-[44px]",
					children: [
						"Twenty-eight minutes.",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						"No account."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-9",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/demo/ocade",
						className: "inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-[14px] font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0",
						children: "Open the demo"
					})
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-[40px]",
				children: "Keep your work."
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-9 flex flex-wrap items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/auth",
					className: "inline-flex h-12 items-center justify-center rounded-full border border-border/70 bg-background/40 px-8 text-[14px] font-medium text-foreground backdrop-blur transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					children: "Create account"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/auth",
					className: "inline-flex h-12 items-center justify-center rounded-full px-5 text-[14px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					children: "Sign in"
				})]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "relative z-10 mx-auto w-full max-w-5xl px-4 pb-28 pt-16",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "sr-only",
						children: "What OCADE does"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "grid grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-4",
						children: PLANETS.map((planet) => {
							const isActive = active?.id === planet.id;
							const isPinned = pinnedId === planet.id;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setPinnedId((current) => current === planet.id ? null : planet.id),
								onMouseEnter: () => setHovered(planet),
								onMouseLeave: () => setHovered(null),
								onFocus: () => setHovered(planet),
								onBlur: () => setHovered(null),
								"aria-pressed": isPinned,
								"aria-describedby": `planet-benefit-${planet.id}`,
								className: "group w-full rounded-lg text-left transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										"aria-hidden": true,
										className: cn("h-1.5 w-1.5 shrink-0 rounded-full transition-transform", isActive || isPinned ? "scale-[1.9]" : "scale-100"),
										style: { backgroundColor: `oklch(0.8 0.13 ${planet.hue})` }
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: cn("truncate text-[13.5px] font-medium transition-colors", isPinned || isActive ? "text-foreground" : "text-foreground/80"),
										children: planet.name
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									id: `planet-benefit-${planet.id}`,
									className: "mt-1.5 block text-[12px] leading-relaxed text-muted-foreground",
									children: planet.benefit
								})]
							}) }, planet.id);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-14 flex justify-center",
						children: tier !== "static" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => {
								forgetIntro();
								play();
								window.scrollTo({
									top: 0,
									behavior: reducedMotion ? "auto" : "smooth"
								});
							},
							className: "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {
								className: "h-3 w-3",
								"aria-hidden": true
							}), "Replay the opening"]
						}) : null
					})
				]
			})
		]
	});
}
/**
* A full-height band of content over the system.
*
* Deliberately not a card: no border, no panel, no background. The depth comes
* from the darkened field behind it, which is a real surface rather than a
* rectangle drawn to look like one.
*/
function Panel({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "relative z-10 mx-auto flex min-h-[62svh] w-full max-w-5xl flex-col justify-center px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "max-w-2xl",
			children
		})
	});
}
/**
* The public landing experience deliberately stays outside the marketing shell.
* The Three.js universe is already the highest-value visual element on this
* route, so legal/about/support pages use a lighter CSS depth system instead of
* pulling the full 3D engine into every public document.
*/
function LandingPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("script", {
				type: "application/ld+json",
				dangerouslySetInnerHTML: { __html: JSON.stringify(WEBSITE_STRUCTURED_DATA).replace(/</g, "\\u003c") }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
				href: "#main-content",
				className: "skip-link",
				children: "Skip to content"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				id: "main-content",
				tabIndex: -1,
				className: "focus:outline-none",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LandingUniverse, {})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "relative z-10 border-t border-border/40 bg-background/55 py-8 backdrop-blur-xl",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-[11.5px] text-muted-foreground/70 sm:flex-row",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-center sm:text-left",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-medium text-foreground/90",
								children: "CARCC CADANE"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1",
								children: "OCADE — Command the Next Era."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1",
								children: [
									"© ",
									(/* @__PURE__ */ new Date()).getFullYear(),
									" CARCC CADANE"
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteFooterLinks, { extra: [
						{
							to: "/about",
							label: "About"
						},
						{
							to: "/company",
							label: "Company"
						},
						{
							to: "/support",
							label: "Contact"
						},
						{
							to: "/privacy",
							label: "Privacy"
						},
						{
							to: "/terms",
							label: "Terms"
						},
						{
							to: "/auth",
							label: "Sign in"
						}
					] })]
				})
			})
		]
	});
}
//#endregion
export { LandingPage as component };
