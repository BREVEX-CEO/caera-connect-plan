import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TAP_LINK, t as SiteFooterLinks } from "./SiteFooter-CIpVmEmM.mjs";
import { Sr as ArrowUpRight } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/PublicPage-CTc9xZld.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var MUX_PLAYBACK_ID = "Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g";
var MUX_HLS = `https://stream.mux.com/${MUX_PLAYBACK_ID}.m3u8`;
var MUX_MP4 = `https://stream.mux.com/${MUX_PLAYBACK_ID}/high.mp4`;
function PublicPage({ eyebrow, title, summary, children, structuredData }) {
	const rootRef = (0, import_react.useRef)(null);
	const videoRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const video = videoRef.current;
		if (!video) return;
		const playQuietly = () => {
			video.play().catch(() => void 0);
		};
		video.src = video.canPlayType("application/vnd.apple.mpegurl") ? MUX_HLS : MUX_MP4;
		playQuietly();
		return () => {
			video.pause();
			video.removeAttribute("src");
			video.load();
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const root = rootRef.current;
		if (!root) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const cards = Array.from(root.querySelectorAll("[data-public-tilt]"));
		const disposers = [];
		for (const card of cards) {
			const onMove = (event) => {
				const rect = card.getBoundingClientRect();
				const px = (event.clientX - rect.left) / rect.width;
				const py = (event.clientY - rect.top) / rect.height;
				const rx = (.5 - py) * 2.8;
				const ry = (px - .5) * 3.6;
				card.style.transform = `perspective(1100px) translateY(-5px) rotateX(${rx}deg) rotateY(${ry}deg)`;
				card.style.setProperty("--tilt-x", `${px * 100}%`);
				card.style.setProperty("--tilt-y", `${py * 100}%`);
			};
			const onLeave = () => {
				card.style.transform = "perspective(1100px) translateY(0) rotateX(0deg) rotateY(0deg)";
			};
			card.addEventListener("pointermove", onMove);
			card.addEventListener("pointerleave", onLeave);
			disposers.push(() => {
				card.removeEventListener("pointermove", onMove);
				card.removeEventListener("pointerleave", onLeave);
			});
		}
		const onPointer = (event) => {
			root.style.setProperty("--mouse-x", `${event.clientX}px`);
			root.style.setProperty("--mouse-y", `${event.clientY}px`);
		};
		window.addEventListener("pointermove", onPointer, { passive: true });
		return () => {
			for (const dispose of disposers) dispose();
			window.removeEventListener("pointermove", onPointer);
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: rootRef,
		className: "relative min-h-screen overflow-x-hidden bg-[#050505] text-[#f5f5f7] [--mouse-x:50vw] [--mouse-y:25vh]",
		children: [
			structuredData ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("script", {
				type: "application/ld+json",
				dangerouslySetInnerHTML: { __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: `
        @keyframes public-scroll-line { 0% { transform: translateY(-110%); } 100% { transform: translateY(210%); } }
        @keyframes public-float-a { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(3vw,-2vh,0) scale(1.08); } }
        @keyframes public-float-b { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(-2vw,3vh,0); } }
        @keyframes public-gradient { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        [data-public-tilt] { transform-style: preserve-3d; transition: transform .22s ease, border-color .25s ease, background-color .25s ease, box-shadow .25s ease; }
        [data-public-tilt]::after { content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit; opacity:0; background:radial-gradient(420px circle at var(--tilt-x,50%) var(--tilt-y,50%),rgba(255,255,255,.105),transparent 42%); transition:opacity .25s ease; }
        [data-public-tilt]:hover::after { opacity:1; }
        @media (prefers-reduced-motion: reduce) { [data-public-tilt] { transition:none; } }
      ` }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				"aria-hidden": true,
				className: "pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#050505]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
						ref: videoRef,
						muted: true,
						loop: true,
						playsInline: true,
						autoPlay: true,
						preload: "metadata",
						tabIndex: -1,
						className: "absolute left-1/2 top-1/2 h-full min-h-full w-full min-w-full -translate-x-1/2 -translate-y-1/2 object-cover opacity-[0.24] saturate-[0.55] contrast-[1.12] brightness-[0.58]",
						"aria-hidden": "true"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,.30),rgba(5,5,5,.82)_64%,#050505_96%)]" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_var(--mouse-x)_var(--mouse-y),rgba(121,82,153,.14),transparent_22rem)]" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute -left-32 top-[20vh] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(71,38,91,.22),transparent_66%)] blur-3xl motion-safe:animate-[public-float-a_14s_ease-in-out_infinite]" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute -right-44 top-[52vh] h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(190,147,58,.09),transparent_65%)] blur-3xl motion-safe:animate-[public-float-b_17s_ease-in-out_infinite]" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
				href: "#main-content",
				className: "skip-link",
				children: "Skip to content"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
					"aria-label": "Public information",
					className: "mx-auto flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-[#0b0b0d]/76 p-1.5 shadow-[0_18px_65px_rgba(0,0,0,.42),inset_0_1px_0_rgba(255,255,255,.055)] backdrop-blur-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/",
							"aria-label": "OCADE home",
							className: "group mr-1 flex shrink-0 items-center gap-2 rounded-full px-1.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "relative grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-white/15 bg-black shadow-[0_0_26px_rgba(104,57,132,.26)] transition-transform duration-300 group-hover:scale-110",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inset-[-1px] rounded-full bg-[conic-gradient(from_215deg,#d6d6da,#5b286f,#c8a24c,#d6d6da)] opacity-70" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "relative grid h-[32px] w-[32px] place-items-center overflow-hidden rounded-full bg-black",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: "/brand/ocade-carcc-mark.png",
										alt: "",
										className: "h-full w-full object-contain"
									})
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "hidden pr-1 text-left sm:block",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-[10px] font-semibold tracking-[0.22em] text-white",
									children: "OCADE"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-[8px] tracking-[0.16em] text-white/45",
									children: "CARCC CADANE"
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-1 hidden h-5 w-px shrink-0 bg-white/10 sm:block" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLink, {
							to: "/",
							label: "Home"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLink, {
							to: "/about",
							label: "About"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLink, {
							to: "/products/ocade",
							label: "OCADE"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLink, {
							to: "/company",
							label: "Company"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLink, {
							to: "/founder/haans-antoni",
							label: "Founder"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLink, {
							to: "/support",
							label: "Contact"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLink, {
							to: "/privacy",
							label: "Privacy"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLink, {
							to: "/terms",
							label: "Terms"
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				id: "main-content",
				tabIndex: -1,
				className: "relative z-10 focus:outline-none",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "relative flex min-h-[78svh] items-center justify-center px-5 pb-16 pt-28 text-center sm:min-h-[84svh] sm:pt-32",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-5xl",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mx-auto mb-7 flex w-fit items-center gap-3 rounded-full border border-white/10 bg-black/28 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/55 backdrop-blur-xl",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1.5 w-1.5 rounded-full bg-[#caa84f] shadow-[0_0_15px_rgba(202,168,79,.75)]" }), eyebrow]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "mx-auto max-w-5xl text-balance text-[clamp(3.3rem,10vw,8.5rem)] font-semibold leading-[0.86] tracking-[-0.065em] text-white drop-shadow-[0_28px_70px_rgba(0,0,0,.65)]",
								children: title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mx-auto mt-8 max-w-3xl text-pretty text-[15px] leading-7 text-white/58 sm:text-[17px] sm:leading-8",
								children: summary
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-9 flex flex-wrap items-center justify-center gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/about",
									className: "group relative inline-flex min-h-11 items-center justify-center overflow-hidden rounded-full bg-white px-6 text-[13px] font-medium text-black transition-transform duration-300 hover:scale-[1.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transform-none",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "relative z-10 flex items-center gap-2",
										children: ["About CARCC CADANE ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, {
											className: "h-3.5 w-3.5",
											"aria-hidden": true
										})]
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: "/support",
									className: "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/12 bg-black/30 px-6 text-[13px] font-medium text-white/82 backdrop-blur-xl transition duration-300 hover:border-white/24 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45",
									children: ["Contact & enquiries ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, {
										className: "h-3.5 w-3.5",
										"aria-hidden": true
									})]
								})]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						"aria-hidden": true,
						className: "absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-white/35",
						children: ["Scroll", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "relative h-9 w-px overflow-hidden bg-white/12",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inset-x-0 h-4 bg-gradient-to-b from-transparent via-white/80 to-transparent motion-safe:animate-[public-scroll-line_1.6s_ease-in-out_infinite]" })
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "relative mx-auto max-w-5xl px-5 pb-24 pt-6 sm:pb-32",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-8 flex items-end justify-between gap-6 border-b border-white/[0.08] pb-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] font-semibold uppercase tracking-[0.26em] text-white/36",
							children: "Official information"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-2 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl",
							children: "Read the details"
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "hidden max-w-xs text-right text-xs leading-5 text-white/34 sm:block",
							children: "Clear, current documentation for OCADE and CARCC CADANE."
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-5 text-sm leading-7 sm:text-[15px] sm:leading-8",
						children
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "relative z-10 overflow-hidden border-t border-white/[0.075] bg-black/35 px-5 py-12 backdrop-blur-xl",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					"aria-hidden": true,
					className: "absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(69,35,86,.12))]"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative mx-auto grid max-w-6xl gap-8 sm:grid-cols-[1fr_auto] sm:items-end",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: "/brand/ocade-carcc-mark.png",
								alt: "",
								className: "h-10 w-10 rounded-full object-contain"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-semibold tracking-[0.16em] text-white",
								children: "OCADE"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10px] tracking-[0.17em] text-white/38",
								children: "BY CARCC CADANE"
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-5 max-w-md text-xs leading-6 text-white/42",
							children: "Command the Next Era. Private intelligence, user control and permissioned action."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-4 text-[11px] text-white/30",
							children: [
								"© ",
								(/* @__PURE__ */ new Date()).getFullYear(),
								" CARCC CADANE."
							]
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex max-w-md flex-wrap gap-x-4 gap-y-3 text-xs text-white/48 sm:justify-end",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteFooterLinks, {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/about",
								className: TAP_LINK,
								children: "About"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/support",
								className: TAP_LINK,
								children: "Contact"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/privacy",
								className: TAP_LINK,
								children: "Privacy"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/terms",
								className: TAP_LINK,
								children: "Terms"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/data-rights",
								className: TAP_LINK,
								children: "Data rights"
							})
						]
					})]
				})]
			})
		]
	});
}
function NavLink({ to, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to,
		className: "shrink-0 rounded-full px-3 py-2 text-[11px] font-medium text-white/52 transition-colors duration-200 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 sm:px-3.5 sm:text-[12px]",
		children: label
	});
}
function PublicSection({ title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"data-public-tilt": true,
		className: "group relative overflow-hidden rounded-[28px] border border-white/[0.085] bg-[linear-gradient(145deg,rgba(19,18,22,.80),rgba(8,8,10,.72))] p-5 shadow-[0_28px_90px_rgba(0,0,0,.22),inset_0_1px_0_rgba(255,255,255,.045)] backdrop-blur-2xl hover:border-white/[0.15] hover:shadow-[0_32px_110px_rgba(0,0,0,.32),0_0_50px_rgba(83,45,105,.10)] sm:p-7",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[#caa84f]/50 to-transparent opacity-35 transition-opacity group-hover:opacity-90"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				"aria-hidden": true,
				className: "absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(102,57,128,.16),transparent_70%)] blur-2xl"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "relative z-10 text-xl font-semibold tracking-[-0.025em] text-white sm:text-[23px]",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "relative z-10 mt-4 space-y-3.5 text-white/55 marker:text-white/34 [&_a]:text-white/82 [&_a]:underline-offset-4 [&_a:hover]:text-white [&_strong]:text-white/85",
				children
			})
		]
	});
}
/**
* A note on a public page about what is and is not available yet.
*
* WHAT THIS USED TO BE. `DraftNotice`, headed "Draft notice — legal review
* required", telling visitors that the text they were reading "must be
* approved before public launch". The pages below it went on to explain that
* prices were "founder-approved" and that an installer might trigger a
* SmartScreen warning. That is a team's internal checklist printed on the
* storefront: it tells a customer nothing they can act on and quite a lot they
* should never have to think about.
*
* It also painted itself in Tailwind's amber, the one colour family the palette
* does not contain, so every public page carried an off-brand block. It is gold
* now, which is the palette's own attention colour.
*
* What survives is the honest part: when something is not available yet, say
* so, in a sentence about the reader rather than about the team.
*/
function Notice({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 text-foreground/80 backdrop-blur-xl",
		children
	});
}
//#endregion
export { PublicPage as n, PublicSection as r, Notice as t };
