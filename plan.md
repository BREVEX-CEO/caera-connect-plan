# OCADE — Complete Commercial Launch Readiness | 266-Point Owner Implementation Contract

> **Added 1 November 2026.** This owner-directed implementation checklist is placed first for execution priority. It complements the canonical 84-concept architecture and the existing rules below; it does **not** authorize merging into main, production deployment, payments, certificate acquisition, spending, irreversible changes, or exposing secrets. Existing safety and release gates continue to apply. Preconfigured staging credentials may be used for authorized staging tests with least privilege and strict non-disclosure.
>
> **Scope:** Complete all 266 numbered requirements and all other unfinished authorized product work; verify rather than assume completion. Do not introduce task-specific hardcoding to pass tests. Readiness percentages represent verified release gates, not claimed bug-free guarantees.

**OCADE — Complete Commercial Launch Readiness | Continuation Prompt**

**Rules and execution requirements**

1. Continue directly from the current OCADE development session. Do not restart the project, repeat completed research unnecessarily, or create another architecture proposal without implementing the required changes.

2. Work exclusively on `ocade/p00-p22-implementation` in `BREVEX-CEO/caera-connect-plan`. Never merge into `main`, deploy to production, enable payments, spend money, or access my physical computer without my explicit approval.

3. Your objective is to make **OCADE BY CARCC** a genuinely functional, independently verified, public-ready commercial software product across every officially supported component and platform.

4. **Do the actual coding.** Inspect, reproduce, fix, implement, integrate, simplify, test, and independently verify. Documentation alone is not progress.

5. Preserve the existing local-first architecture: Gemini intelligence, task supervisor, local Device Agent, trusted Gateway, MCP/STDIO capability workers, execution controller, independent verifier, and customer-facing website.

6. Do not rewrite functioning architecture merely to make it appear more advanced. Change architecture only where evidence proves a correctness, security, reliability, performance, scalability, or maintainability benefit.

7. Read the current `plan.md`, `CLAUDE.md`, `AGENTS.md`, architecture ledger, prior evidence, tests, repository structure, and relevant implementation files before modifying an existing component.

8. Inspect actual Git history, branch HEAD, local changes, staging configuration, package versions, workflows, tests, and unresolved blockers. Treat historical reports as evidence, not as proof of current functionality.

9. Preserve all existing authorized changes. Never overwrite another developer's edits, delete important tests, or revert unrelated work.

10. Maintain a verified inventory of every application surface, architectural concept, feature, dependency, security boundary, test, and release requirement.

11. Classify every finding as **PASS, PARTIAL, FAIL, BLOCKED, or UNTESTED**. Never label a feature complete solely because code exists.

12. Separate confirmed defects from inferred risks, missing functionality, incomplete integration, and insufficient testing.

13. Fix every reproducible critical and high-priority defect. For any unresolved issue, document the exact blocker and keep the release gate closed.

14. Do not claim 100% bug-free software. The objective is **100% completion of verified launch requirements, zero known critical safety defects, and at least 90% independently verified success on representative real tasks**.

15. Prioritize **P0 safety and correctness → P1 production reliability → P2 performance and polish**. Do not prioritize cosmetic features ahead of broken task execution.

16. Implement improvements in small, reversible, reviewable changes with focused regression tests. Run relevant tests after every change and broader tests after integration.

17. Use cloud infrastructure for testing first. Only request access to my computer after supported cloud tests pass and real consumer-device testing cannot be completed otherwise.

18. Prefer existing free, authorized testing environments and already configured services. Do not create unapproved cloud resources or trigger costs.

19. Keep the repository private or public according to its actual authorized configuration. Never change visibility without approval.

20. Do not modify production secrets, production data, access policies, or release channels without authorization.

**Architecture and execution**

21. Retain **one coherent task-authority system** responsible for task state, permissions, ownership, STOP, takeover, continuation, action dispatch, and truthful completion status.

22. Keep Gemini as the configured online planning brain. Do not secretly switch to another model, invent a local JARVIS fallback, or create competing autonomous planners.

23. Preserve the configured model-routing policies and approved provider credentials. Validate actual model availability, quotas, limits, and failure behavior before making model changes.

24. Keep capability-based execution. No production code may depend on predefined customer applications, filenames, specific user tasks, demonstration journeys, or hardcoded results.

25. **Never hardcode files, answers, browser paths, application names, selectors, commands, expected output documents, or special-case workflows merely to make a test pass.**

26. Test fixtures may contain synthetic files and independent expected results, but production logic must solve unfamiliar inputs using general capabilities and observed state.

27. Do not replace genuine execution with fake receipts, simulated task completions, generated success messages, or pre-created deliverables.

28. Preserve the intended execution preference: native APIs and object models → supported scripts and CLI → native file/project operations → browser DOM/CDP → Playwright → OS accessibility → vision/coordinates when needed.

29. Choose the fastest reliable mechanism for each step based on actual capabilities, permissions, cost, observability, and failure risk.

30. Add automatic **mechanism fallback** where safe. If DOM interaction fails, inspect available alternatives rather than blindly repeating the same action.

31. Improve the supervisor so it maintains objective, target state, milestones, permissions, available capabilities, current observations, completed actions, unresolved uncertainty, and remaining work.

32. Store durable task state independently of Gemini's conversational context so interruptions and context truncation do not destroy progress.

33. Add a bounded receding-horizon planner: plan enough to act effectively, execute, observe the result, then replan only when necessary.

34. Separate **planning, action execution, result observation, and verification** into explicit interfaces and states.

35. Give every action a unique identifier, task identifier, target identity, permission context, deadline, and observable outcome.

36. Prevent duplicate side effects after retries, server restarts, timeout responses, disconnections, or acknowledgement failures.

37. Preserve receipts distinguishing **executed, verified, refused, failed, cancelled, and outcome unknown**. Never infer success from a dispatched command.

38. Improve persistent journaling, recovery checkpoints, durable action reconciliation, and crash-safe resumption.

39. Do not automatically repeat destructive or externally visible operations when the previous effect is uncertain.

40. Implement reliable ownership fences so STOP, Take Over, revocation, sign-out, device removal, and task cancellation prevent new unauthorized actions.

41. Ensure an in-flight operation either stops safely or reports honestly what may already have changed.

42. Keep the Gateway modular. Do not introduce one microservice per tool or turn the 84 architectural concepts into 84 separate services.

43. Establish stable typed contracts between planner, task authority, Gateway, workers, verifier, and user interface.

44. Add version negotiation and compatibility checking between the website/backend, Device Agent, Gateway, and bundled workers.

45. Refuse incompatible components with actionable upgrade instructions rather than continuing unpredictably.

**Gemini accuracy and grounding**

46. Fix the demonstrated Python.org wrong-download failure generically. Gemini must distinguish the correct release row, release version, artifact type, platform, architecture, and actual download target.

47. Do not fix that failure by hardcoding Python.org, the current version, a specific download address, page row, CSS selector, or table position.

48. Build or strengthen an evidence-grounded **Target Resolution Layer** that connects model-selected intent to an observed, unambiguous DOM element, accessibility element, file, process, or application window.

49. Assign temporary observation-scoped identities to discovered elements so the model can refer to concrete targets without inventing coordinates or selectors.

50. Preserve useful target metadata: label, role, accessible name, href, text, containing row, nearby headings, bounds, visibility, selected state, and originating observation.

51. When several elements have identical names such as “Download,” use their surrounding table row, version, platform, and related attributes to disambiguate.

52. Require fresh observations before sensitive actions. Reject stale element references when pages, windows, documents, or processes have changed.

53. Prevent Gemini from navigating to unobserved deep URLs when the user's task requires following an authoritative source.

54. Distinguish verified facts from model memory and assumptions. Never report current external facts without an actual observation or valid trusted source.

55. When the source is a complex table, inspect structured rows and columns rather than relying only on a screenshot or an isolated link label.

56. When observations are incomplete, gather targeted additional evidence instead of guessing.

57. Prefer accessibility and structured browser information when reliable; use screenshots and visual interpretation where structure is unavailable or insufficient.

58. Implement coordinate transforms correctly across scrolling, zoom, DPI, display scaling, window movement, resizing, and multiple monitors.

59. Refuse ambiguous or wrong-window actions. Bind desktop actions to exact window identities and verify that the target is still valid immediately before execution.

60. Improve fallback from structured controls to visual grounding without creating repeated screenshot loops.

61. Implement image-based target matching where necessary, with confidence thresholds, stale-image detection, coordinate validation, and post-action observation.

62. Add adversarial tests for duplicate buttons, changing page layouts, dynamic tables, identical filenames, overlapping windows, dialogs, hidden controls, overlays, and redirected downloads.

63. Improve Gemini's ability to recover after clicking the wrong target, detecting the mistake before accepting or overwriting an incorrect result.

64. Do not solve model errors by adding an expanding library of special-case prompts for individual websites or applications.

65. Measure target selection accuracy independently by comparing the actual selected object against a hidden expected target.

**Independent verification**

66. Strengthen the independent verifier so completion depends on **real postconditions**, not Gemini's confidence or tool-call success.

67. Separate model-generated verification proposals from authoritative task acceptance rules and independently observed outcomes.

68. Fix verifier gaming: Gemini must never modify a customer's file simply to satisfy an incorrectly specified test.

69. Distinguish an invalid verification condition from defective customer work and require clarification or a trustworthy alternative check when necessary.

70. Verify file modifications using hashes, actual contents, parseability, expected semantics, and relevant application-level behavior.

71. Verify spreadsheets through formulas, recalculated values, ranges, output structure, and independent checks of expected financial or numerical results.

72. Verify Word/PDF deliverables through actual document structure, contents, page rendering where necessary, and preservation of requested formatting.

73. Verify images through real file properties, requested visible changes, render inspection, and appropriate perceptual checks rather than existence alone.

74. Verify videos through actual encoded output, duration, frames, audio, codec/container compatibility, requested edits, and playback checks.

75. Verify code repairs by running the relevant command, tests or application and observing the changed behavior.

76. Verify browser work by checking actual resulting page state, downloaded artifact, submitted data, or other independently observable effect.

77. Where full automatic verification is impossible, report what was proven, what remains uncertain, and what requires human review.

78. Record evidence references with each important action while protecting customer data and excluding secrets.

79. Keep the verifier isolated from the planner's unverifiable claims and hidden test answer keys.

80. Build regression tests specifically reproducing the false-positive verification and unauthorized source-editing failures already observed.

**Execution speed and efficiency**

81. Optimize for **fastest correct completed task**, not fastest unverified click.

82. Instrument planning latency, provider latency, tool startup, execution time, observation time, verification time, retries, and total elapsed task time.

83. Remove unnecessary Gemini calls, repeated tool discovery, redundant context generation, repeated file reads, and excessive screenshots.

84. Batch independent read-only observations where safe, preserving enough output for Gemini to reason correctly.

85. Do not batch dependent writes or risky actions when intermediate verification is necessary.

86. Cache stable capability metadata, unchanged file hashes, tool schemas, and other reusable observations using safe invalidation rules.

87. Use targeted incremental observations rather than re-reading entire files, pages, or tool catalogs on every step.

88. Keep frequently needed workers warm where this measurably improves performance without compromising resource usage or STOP behavior.

89. Add progress and stall detection for repeated actions, repeated errors, no state change, exhausted budgets, and ineffective retries.

90. Limit retries by error category, risk, elapsed time, and remaining task budget.

91. Optimize prompt and context composition without hiding critical observations, permissions, error information, or verification requirements.

92. Parallelize independent safe work only when process, file, window, and browser-target isolation can be guaranteed.

93. Prefer native file operations and direct APIs over simulated clicking whenever equivalent verified results are possible.

94. Profile actual slow paths before optimizing. Benchmark every optimization against the previous implementation.

95. Never remove security checks or independent verification merely to make a benchmark faster.

96. Measure median, p95 and p99 latency, model calls per task, retries, token usage, resource consumption, and completed verified outcomes.

**Dependencies and runtime management**

97. Build a **generic Dependency Manager** that identifies capabilities and prerequisites missing from the customer's environment.

98. Keep OCADE's own required runtime, libraries, and browser automation components bundled wherever supported. Customers must not need Python or developer tooling merely to start OCADE.

99. Distinguish bundled application dependencies from additional dependencies needed for a particular customer-requested task.

100. Detect installed tools and versions using reliable platform mechanisms rather than assuming a package exists because one executable appears in PATH.

101. Support discovery of relevant runtimes and engines such as Python, Node.js, Java, .NET, FFmpeg, LibreOffice, browser engines, and native application dependencies when tasks require them.

102. Do not bundle every possible programming language or framework unnecessarily. Download optional task-specific dependencies only when actually needed and authorized.

103. Inspect OS version, CPU architecture, package architecture, installation scope, existing versions, permissions, disk space, and network availability before proposing installation.

104. Support x64 and ARM64 where officially targeted. Treat x86 support as a deliberate compatibility decision with actual build/test evidence.

105. Prefer trusted platform package managers, verified vendor distributions, or controlled installation manifests when suitable.

106. Resolve required package version, operating-system support, architecture, integrity hash, authenticity, compatibility, and applicable licence before installation.

107. Never blindly run commands copied from unknown webpages or untrusted model outputs.

108. Show the exact package, source, version, destination, privileges, expected changes, and security implications before approval.

109. Request administrator elevation only for an authorized operation that truly requires it. Keep normal OCADE operation unelevated.

110. Detect UAC denial, insufficient permissions, missing installation privileges, enterprise policy restrictions, and package-manager failures.

111. Detect missing DLLs, `.dylib` files, `.so` libraries, incompatible native modules, conflicting versions, missing VC++ runtimes, and broken runtime paths where relevant.

112. Diagnose missing executable paths, environment variables, file associations, registry entries, configuration files, and working directories.

113. Diagnose antivirus, SmartScreen, Gatekeeper, quarantine, and application-control restrictions without disabling or bypassing security protections.

114. Provide clear troubleshooting messages when an installation is blocked by legitimate security policies.

115. Make dependency installations resumable, bounded, journaled, and recoverable where the platform supports those guarantees.

116. After installation, verify the executable's actual version, architecture, startup behavior, and the exact capability the task requires.

117. Resume the original task automatically only after the dependency is independently verified and the authorization remains valid.

118. If installation fails, preserve the original task state, record the exact error, and offer safe recovery or manual administrator assistance.

119. Build real clean-machine tests for missing Python, Node.js, FFmpeg, Office engines, blocked installations, architecture mismatches, insufficient storage, restricted privileges, interrupted downloads, and incompatible versions.

120. Ensure installers and dependency workflows work without developer-specific paths, cached packages, local credentials, or preconfigured developer environments.

**Windows customer readiness**

121. Validate the actual Windows installer on clean Windows 10 and Windows 11 consumer environments, not only Windows Server GitHub runners.

122. Test fresh installation, first launch, browser bundle, local Gateway startup, pairing, task execution, restart, upgrade, repair, and uninstall.

123. Verify all required DLLs, Python modules, Playwright binaries, runtime assets, and MCP workers exist in the distributed package.

124. Remove accidental dependencies on Git, Python, Node.js, PowerShell 7, compilers, SDKs, or developer PATH configuration unless explicitly required by a supported optional capability.

125. Preserve native Windows UIA, Win32 and COM compatibility with real installed applications and Windows security boundaries.

126. Test foreground control, user interference, wrong-window prevention, minimized windows, closed processes, elevated windows, and inaccessible UI controls.

127. Test DPI scaling, zoom, high-resolution displays, multiple monitors, different refresh rates, and window repositioning.

128. Test standard user accounts, UAC prompts, controlled-folder access, antivirus restrictions, OneDrive folders, Unicode paths, and long filenames.

129. Validate background operation after sleep, wake, lock/unlock, restart, network disconnection, sign-out, and device removal.

130. Verify that STOP and task cancellation terminate unauthorized subprocess trees and report incomplete effects correctly.

**macOS and Linux readiness**

131. Implement real macOS native accessibility support using appropriate platform APIs instead of claiming Windows control provides macOS coverage.

132. Support the macOS permission model, including Accessibility and other required user-granted permissions, with clear onboarding and revocation behavior.

133. Validate supported Intel and Apple Silicon devices and actual native execution, packaging, and dependency availability.

134. Implement or verify Linux desktop control for explicitly supported X11 and Wayland configurations. Respect compositor and desktop security limitations.

135. Handle Linux desktop portals, user-session permissions, packaging differences, executable paths, shared libraries, and distribution compatibility.

136. Provide platform-specific implementations behind shared capability contracts rather than contaminating the planner with OS-specific hardcoded journeys.

137. If an operation genuinely cannot work on a supported platform, detect the limitation before execution and report it accurately.

138. Do not mark any operating system fully supported until native installation, pairing, execution, STOP, recovery, and independent task verification pass on representative hardware.

**Browser and application control**

139. Dynamically discover the actual installed browsers and profiles. Do not assume Chrome, Edge, or a particular profile is available.

140. Bind automation to the authorized browser session, exact tab, origin, and target; never silently act in an unrelated session.

141. Prefer DOM/CDP/Playwright structured operations where possible and use visual control only when required.

142. Detect navigation, popups, downloads, redirects, file pickers, permission prompts, authentication challenges, and dynamic content safely.

143. Respect anti-bot protections, authentication boundaries, website permissions, and security-sensitive user confirmations.

144. Ensure newly encountered applications can be operated through generic discoverable capabilities whenever their interfaces and permissions support it.

145. Test unfamiliar and randomly named applications, files, websites and UI layouts to prove execution is genuinely capability-based.

**Customer interface and product features**

146. Audit and complete Landing, Authentication, Chat, JARVIS, Library, Devices, Apps & Websites, Settings, Usage, and Owner/Staff administration.

147. Inventory and test every button, menu, link, route, input, modal, file upload, download, permission dialog, and state transition.

148. Make first-use onboarding simple: install, sign in, pair device, grant the specific permissions needed, and complete the first authorized task.

149. Show accurate device states such as Ready, Offline, Permission Required, Busy, Disconnected, and Removed.

150. Provide live task progress with current action, completed steps, verified results, remaining work, and user intervention requests.

151. Display actual operation details in approval dialogs, not vague summaries supplied by Gemini.

152. Ensure STOP, Take Over, Continue, Retry, and Remove Device behave correctly and visibly.

153. Finish file delivery, download, preview, editing, and recovery flows for produced artifacts.

154. Preserve separate behavior for online JARVIS and offline Chat; never silently substitute one for the other.

155. Complete supported voice, interruption, microphone permission, wake-state reporting, and accessibility features without misleading background-listening claims.

156. Validate responsive website and PWA behavior on major desktop and mobile browsers, including accessibility and session recovery.

157. Complete any already-scoped Android companion capabilities and tests only after core architecture and cloud gates pass. Do not create unrelated mobile apps.

158. Validate iOS browser/PWA behavior using supported hosted browser or simulator testing where available; do not invent native iOS functionality.

159. Optimize frontend performance, loading states, code splitting, accessibility, caching, image delivery, international text, reduced motion, and meaningful error feedback.

160. Eliminate dead controls, duplicate pages, obsolete branding, broken navigation, and unnecessary interface complexity.

**Backend and infrastructure**

161. Audit task authority, database RLS, authentication, privileged operations, staff/owner boundaries, device ownership, and audit logging end to end.

162. Test authorization against forged device identities, replayed requests, expired sessions, revoked keys, cross-account access, and duplicate action submission.

163. Verify migrations on disposable databases, including forward migration, rollback strategy, data integrity, and permission preservation.

164. Implement durable job processing, retry limits, idempotency, queue backpressure, and overload protection where missing.

165. Add server-side rate limits and resource budgets that protect availability without allowing a model to bypass task authority.

166. Improve provider error handling for timeouts, quota exhaustion, invalid responses, outages, and partial tool execution.

167. Prevent server credentials or service-role keys from reaching model-controlled commands, local workers, browser pages, test logs, or customer downloads.

168. Enforce TLS, secure headers, safe cookies, CSRF protection, input validation, and appropriate Content Security Policy.

169. Test for XSS, SQL injection, SSRF, path traversal, command injection, unsafe deserialization, insecure direct-object references, and privilege escalation.

170. Threat-model malicious websites, prompt injection in customer files, untrusted MCP tools, malicious downloads, compromised worker processes, and stolen device credentials.

171. Protect local file access through explicit grants, scope enforcement, race-safe writes, version checks, backup behavior, and non-destructive defaults.

172. Verify database backups through actual restoration drills. Test infrastructure recovery, incident handling, and user-visible service failure behavior.

173. Profile real load and scale only as evidence requires. Avoid premature multi-region complexity or unnecessary infrastructure expenses.

**Security, privacy, and operations**

174. Preserve MFA and all established owner/staff safeguards. Never weaken security merely to make an automated test pass.

175. Keep customer content private and separate from other accounts, support systems, model traces, and unrelated customer sessions.

176. Make logs useful but redact passwords, authorization headers, tokens, API keys, sensitive file contents, and private data.

177. Add structured crash reports, health checks, latency metrics, failure classifications, and diagnostics with privacy-respecting controls.

178. Implement a user-accessible diagnostic report that can explain connection, permission, runtime, dependency, Gateway, browser, and execution failures.

179. Ensure customer data export, account deletion, device revocation, and retention processes operate consistently with published privacy commitments and applicable requirements.

180. Prepare necessary non-payment legal and governance documentation, licence notices, privacy disclosures, Terms of Service, and installation guidance.

181. Add release notes, troubleshooting documentation, support procedures, incident response, service status communication, and recovery instructions.

182. Verify the commercial redistribution rights of bundled runtimes, dependencies, libraries, models, assets, and external components.

183. Keep all payment, checkout, billing, merchant-of-record, and subscription integration work outside this assignment.

184. Exclude code-signing certificate acquisition and certificate-signing work from this assignment. Do not compensate by bypassing OS or antivirus security protections.

**Packaging, updates, and reliability**

185. Build fully reproducible installers and release artifacts for supported platforms and architectures using declared, version-pinned dependencies.

186. Verify package integrity and every bundled worker's startup, not just successful compilation.

187. Support clean installation, upgrade, repair, restart, rollback, and uninstall without destroying customer documents or unrelated settings.

188. Implement a safe update mechanism with version compatibility, integrity checks, rollback, and recovery after interrupted updates.

189. Never let an update silently execute during a critical customer action or leave partially replaced executables running.

190. Test installation on clean VMs and physical machines without developer tools, cached browser binaries, or previously installed OCADE components.

191. Run long-duration stability tests to detect CPU spikes, memory leaks, orphaned workers, unreleased handles, output-pipe hangs, and excessive disk usage.

192. Test low-memory machines, slow storage, limited bandwidth, unstable Wi-Fi, limited permissions, and constrained user accounts.

193. Ensure network outages cause clear state transitions and safe task recovery rather than hidden success or uncontrolled retries.

**Independent testing and evidence**

194. Build a permanent, versioned test matrix covering every supported OS, CPU architecture, browser, DPI configuration, permission level, and installation scenario.

195. Include unit, protocol, integration, database, security, accessibility, browser, desktop UI, packaging, installer, performance, and disaster-recovery tests.

196. Run existing CI suites and eliminate silently skipped essential tests. Required tests must fail the release gate when their prerequisites are unavailable.

197. Preserve synthetic test fixtures and hidden independent oracles, but never reveal expected customer-task answers to the production planner.

198. Generate randomized test data, application names, filenames, layouts, input values, user instructions, and environmental conditions to detect hardcoding.

199. Include real Gemini-controlled E2E tests rather than only mocked or scripted model responses.

200. Test actual spreadsheet reconciliation, document creation, coding repairs, browser research, file manipulation, image operations, video operations, and general PC tasks through reusable capability interfaces.

201. Select representative tasks from real customer problems; never special-case the examples in production code.

202. Measure first-attempt success, recovery-assisted success, final verified success, intervention frequency, wrong-target incidents, time per task, and model calls.

203. Treat the historical 15/24 clean passes as an existing evidence checkpoint, not proof of a current success rate after subsequent fixes.

204. Create larger unseen evaluation sets with varying difficulty and fresh inputs. Prevent repeated retries on known fixtures from artificially raising reported success.

205. Require at least **90% independently verified real-task success** on the agreed representative launch suite, plus explicit platform-specific reliability gates.

206. Require zero known critical security or safety defects, zero unauthorized actions, zero fabricated successes, and zero unresolved release-blocking failures.

207. Retest every previously observed bug, including wrong Python download, hallucinated versions, invented URLs, verifier gaming, repeated reads, and Python 3.12 subprocess hanging.

208. Repeat regression and integration tests under the actual runtime versions and binaries shipped to customers.

209. Test Windows consumer desktops separately from Windows Server CI runners; test native macOS and supported Linux configurations separately.

210. Perform controlled crash, process-kill, network-loss, interrupted-update, permission-revocation, STOP, takeover, and retry-injection tests.

211. Verify output quality independently, including edits that appear valid but contain incorrect values, missing content, damaged formatting, or altered unrelated files.

212. Review security, privacy, package provenance, and failure recovery before any feature is declared launch-ready.

213. Do not delete tests to improve pass rates, reduce validation standards to force a green result, or mark blocked scenarios as passed.

**Commercial launch readiness: verified 10% milestones**

214. Implement a measurable **0–100% Commercial Launch Readiness Score**, divided into ten independently verifiable milestones, each worth 10 percentage points.

215. **10% — Repository and architecture baseline:** source integrity, contracts, test inventory, dependency audit, security invariants, and reproducible builds verified.

216. **20% — Core Gateway and device authority:** pairing, permissions, worker execution, journaling, STOP, takeover, and recovery independently verified.

217. **30% — Installer and dependency readiness:** bundled prerequisites, clean installation, dependency diagnosis, safe authorized repair, upgrade and uninstall tested.

218. **40% — Computer and browser control:** generic target discovery, accurate execution, wrong-target protection, browser handling, and supported OS adapters verified.

219. **50% — Gemini intelligence and grounding:** unfamiliar-task planning, correct target selection, observed-source reasoning, adaptive execution, and loop prevention verified.

220. **60% — Independent verification and recovery:** trustworthy completion checks, false-success prevention, file protection, checkpoint recovery, and negative/adversarial tests verified.

221. **70% — Customer-facing product:** required web pages, authentication, onboarding, Chat, JARVIS, Devices, Library, Settings, approvals, and deliverables verified.

222. **80% — Security, infrastructure, and operations:** authorization, privacy, secrets isolation, resilience, observability, backup restoration, support, and operational tests verified.

223. **90% — Platform and performance qualification:** all advertised OS/architecture configurations, installation and runtime compatibility, stress tests, and latency targets verified.

224. **100% — Final commercial release qualification:** unseen real-task acceptance, complete regression matrix, closed-beta validation, all mandatory gates, and zero known critical release blockers verified.

225. A milestone earns its full 10% only when every mandatory acceptance condition in that milestone passes with recorded evidence. Otherwise mark it PARTIAL or BLOCKED without awarding unearned percentage points.

226. Add granular completion tracking within milestones, but distinguish work completed from launch-gate approval. Do not manipulate weights to show artificially high readiness.

227. Calculate the score from actual test artifacts, current commit, verified implementation, and explicit gate criteria. Never generate the percentage using Gemini's subjective opinion.

228. Do not automatically start at 0%. Re-evaluate completed work and existing evidence against these milestone gates and calculate the real baseline.

229. Report **passed, partial, failed, blocked, and untested** requirements separately from the overall readiness percentage.

230. Every score must include the tested commit SHA, date, evidence location, supported platforms, remaining blockers, and why each completed milestone qualifies.

231. Track progress at 10% increments, and whenever useful report the exact verified percentage between those checkpoints without pretending it is a success probability.

232. At each 10% milestone, report the actual changes made, tests passed, defects fixed, performance impact, remaining work, and whether the next stage is safely unlocked.

233. If a regression invalidates previously earned readiness, reduce the score accordingly. Never maintain an inflated historic score.

234. **100% readiness means all agreed launch requirements passed**, not a guarantee that software can never encounter an unexpected bug.

**Implementation workflow and reporting**

235. Begin by inspecting the actual current branch and calculating the evidence-based readiness baseline.

236. Compare current code against every relevant requirement in this prompt and the existing canonical architecture ledger.

237. Create or update a single authoritative implementation backlog, preserving the existing plan and eliminating duplicate issue lists where safe.

238. Record each issue with severity, precise cause, affected module, required change, reproduction steps, acceptance criteria, test location, and current status.

239. Immediately prioritize the most consequential verified failures: Gemini grounding, incorrect verification, unsafe edits, incomplete dependency management, and platform readiness.

240. Work continuously through the backlog, fixing the root cause rather than adding superficial exceptions or test-specific patches.

241. After each meaningful change, run focused tests, resolve failures, and then run the appropriate broader integration suite.

242. Before each substantial refactor, measure its expected benefit and preserve functionality, security controls, public interfaces, and regression coverage.

243. Remove dead code, duplicate abstractions, obsolete pathways, unused packages, redundant model prompts, unnecessary background workers, and outdated customer-facing branding only after verifying safe removal.

244. Do not pursue arbitrary line-count reduction. Optimize for maintainability, correctness, reliability, and measured performance.

245. Preserve the no-hardcoded-apps rule throughout all changes. Generic capabilities must work against new tasks and new applications without further application-specific coding.

246. Maintain strict separation between developer tests and customer-distributed runtime artifacts.

247. Use the free GitHub Actions environment and disposable test systems intelligently; avoid unnecessary reruns and wasted quota.

248. Fix CI failures from their actual logs. Do not blindly rerun identical failing jobs or alter test expectations without evidence that those expectations are incorrect.

249. Run all possible tests in cloud environments before requesting any physical-device testing.

250. Commit coherent implementation changes to the authorized implementation branch with accurate commit messages and supporting tests. Do not merge, deploy, or publish release artifacts.

251. Do not claim missing approvals are implementation blockers unless the work genuinely cannot proceed using authorized, safe alternatives.

252. Distinguish work that requires my approval—credentials, real-device access, privileged services, destructive operations, spending, or deployment—from work you can perform independently.

253. Do not request approvals unnecessarily. Continue independent coding, fixture generation, test development, analysis, and local/cloud validation wherever safe.

254. When genuine owner approval is required, present the exact requested action, why it is necessary, its risks, and the remaining work that can proceed without it.

255. Keep a concise live engineering status with: **Current Readiness %, Fixed, Added, Removed, Tests, Speed, Failures, Blockers, Next Work**.

256. Provide a full evidence report at meaningful milestones, including actual code changes, commit references, platform coverage, measured task outcomes, and unresolved limitations.

257. Never say “fully complete,” “all fixed,” or “ready for public launch” while critical functionality remains blocked, unimplemented, untested, or unsafe.

258. Never sacrifice security or verification to achieve higher task success percentages or faster execution times.

259. Benchmark OCADE against relevant currently available AI assistants and computer-use tools using identical, independently scored tasks. Compare correctness, latency, recovery, customer control, security, privacy, and usability. Do not claim superiority without results.

260. Focus on OCADE's competitive advantage: **reliably completing real customer work on the customer's authorized computer, faster and with independently verified results**.

261. Maintain launch scope discipline. Do not add unrelated features, unnecessary architectures, speculative integrations, or complex infrastructure that does not improve release readiness.

262. Do not stop after preparing a checklist, adding a few regression tests, or obtaining one green CI run. Continue implementing the remaining authorized work and re-evaluating the release gates.

263. If an issue is blocked, record it accurately and continue independent tasks from the next highest-priority workstream.

264. Work toward full launch-readiness qualification, with every required part implemented, integrated, tested, documented, secure, maintainable, and performant.

265. Your final release recommendation must be **GO or NO-GO**, supported by real test results. A NO-GO result is required whenever a mandatory safety or launch gate remains unmet.

266. **Do not ask me to repeat settled decisions. Do not replace coding with planning. Do not hardcode task-specific answers. Do not fake success. Fix root causes, optimize execution, verify everything, and report genuine commercial-launch progress in 10% milestones.**

**Start with the actual current repository state, fix the highest-impact existing failures, and continue implementation toward independently verified public commercial readiness.**


---

# OCADE JARVIS — Canonical Engineering Architecture, Wiring and Gate-First Implementation Plan

> **Binding owner contract | 31 October 2026 | Repository: \`BREVEX-CEO/caera-connect-plan\` | Working branch: \`ocade/p00-p22-implementation\`**
>
> **Single source of truth for JARVIS implementation.** This is a deliberate rewrite of the previous 435 KB \`plan.md\` with duplicated histories, outdated assertions and task examples. \`AGENTS.md\`, \`CLAUDE.md\`, security policies, migrations and authoritative owner approvals still apply. Historical research and \`docs/DECISIONS.md\` are provenance, **not** alternate queues or permission to bypass this plan. Nothing in this document asserts a module is operational merely because it is specified.
>
> **Critical priority:** **Build, wire, repair, debloat and independently qualify all 84 core concepts FIRST. Only AFTER architecture gates pass may the product begin real customer-task acceptance tests.** Unit, protocol, integration, security, contract and infrastructure smoke tests used to establish architecture readiness are allowed before the gate; **do not confuse them with doing user creative/business tasks.**

## 0. OCADE: what we are building and what constitutes success

**OCADE BY CARCC** is a website-first, local-first autonomous computer-work platform. **JARVIS** accepts a customer's outcome (text/voice), uses the customer's authorized device/files/browser, chooses operations dynamically through real online model planning, returns editable artifacts where applicable and independently proves the requested result. This must work for newly encountered applications and tasks whenever an authorized generic capability actually exists. No claim of universal access to arbitrary applications, invisible UIs or 100% accuracy.

**Absolute separation of responsibility:**
- **Gemini (online brain)**: interprets user objective, proposes/updates outcome checks and milestones, chooses the next tool and its arguments, observes real results including permitted visual evidence, decides whether to revise. **Claude as engineer may design and implement infrastructure, not secretly act as Gemini or author customer-task itineraries.**
- **OCADE (hands, legs and eyes)**: authoritative supervisor, scope/consent enforcement, live capability registry and semantic/vector *retrieval*, trusted MCP gateway, signed local agent, OS/file/browser/media/geometry primitives, journal, STOP, independent verifier, user interface and delivery. All actions are typed and policy-gated.
- **Independent verifier**: checks actual effects and delivered output using separate evidence, not model declarations or successful RPC status.
- **Customer**: owns device and grants; security approvals, authentication/MFA, spending, destructive changes and sensitive operations obey explicit policy.

**Nonnegotiables:** no application-specific customer task branches or recipes; no manually scripted demo masquerading as Gemini; no developer-authored scene/timeline decisions during real acceptance; no unapproved network spending, deploys, migrations, GitHub Actions, \`main\` merges, production changes, payment activation or use of the owner's PC. ₹0 new spending ceiling. Never put service-role keys or provider secrets into source control, client bundles, logs or model-visible content.


> **1 November 2026 owner update (narrow permission override):** Free, non-deploying GitHub Actions validation on `ocade/p00-p22-implementation` is now approved. This supersedes earlier blanket "no GitHub Actions" language **only** for isolated CI tests. No production/staging deployment, new migrations, payment activation, provider spending, `main` merge, owner's PC access, scheduled automation, or unapproved privileged changes. Keep public-repo CI read-only, secrets-free and cost-capped.

### 0.1 Explicit implementation policy

1. Inspect current branch SHA, working tree, live code owners, dependency graph, existing tests and relevant \`AGENTS.md\` / \`CLAUDE.md\` / \`docs/DECISIONS.md\` before changing code. Never resurrect retired donor engines or overwrite unrelated work.
2. **No hardcoding** means no customer-app lists, app-name branches, keyword-to-executor mappings, fixed prompts to canned plans, sample-task-shaped worker commands, fixed paths, fixed source clips, fixed GUI click scripts or test-output injection in the production route. Stable protocol enumerations, legitimate app-specific API adapters and file-format codecs can exist if *discovered as capabilities* and do not choose task steps.
3. **Do not confuse capability routing with customer planning.** A vector tool catalog ranks plausible **tools**. Gemini decides **what action** to take; OCADE policy decides **whether** it is allowed; verifier decides **whether it worked**. Relevance score never authorizes effects.
4. Use existing Supabase account/task/consent authorities and online intelligence service; do not add a duplicate backend, duplicate model provider, parallel plan store or unsafe cloud computer.
5. Preserve separate **Offline Chat**. JARVIS is online-only; no silent offline substitution.
6. Prefer minimal shared primitives and delete *proven* dead/duplicate workflows after tests. No arbitrary source-LOC or 84-microservice target.
7. No false "zero bugs" guarantee: the gate requires **no known unresolved critical/high-severity defects**, all mandatory tests green, evidence for every applicable concept and explicit support exclusions.

### 0.2 Engineering simplicity and commercial reliability (owner clarification)

| Rule | Elite interpretation | Failure mode to avoid |
|---|---|---|
| **KISS** | Implement the simplest complete solution that works at today's measured load, without weakening safety or verification. | Extra layers, wrappers and architecture for hypothetical scale. |
| **YAGNI** | Add only justified currently required capabilities and production safeguards. | Speculative integrations, dependencies and features that burden installers. |
| **DRY** | Share logic only when duplication exists across real independent callers and abstraction is clearer. | Premature coupling of unrelated business domains to save a few lines. |
| **SOLID** | Keep clear single owners, focused contracts, replaceable adapters and testable boundaries where necessary. | Factories, interfaces and polymorphism for trivial code. |

Use existing OCADE owners; trace call sites before any deletion. Measure speed, memory, package size and reliability before claiming improvements. Every fix must include a reproduction, minimal root-cause change, targeted regression and independent evidence. **No application-name/keyword routing, predetermined editor journey, hardcoded file paths or output fabrication.** A format codec or legitimate documented app API can be registered only as a discovered capability; it cannot choose the model's customer-task steps.

## 1. Exact dependency topology and who connects to whom

\`\`\`text
Customer OCADE web UI (authenticated, outcome + device/scope)
   |
   v HTTPS authenticated command / consent / STOP
Existing server + Supabase task authority (RLS, user/device/grants, epochs, permits)
   |
   v Versioned TaskContext and durable state transitions
OD-AVGHHC OUTCOME SUPERVISOR (policy, milestones, budgets, locks, journal)
   |                            ^
   | authorize model turn       | verified observations / receipts / remaining outcome
   v                            |
Existing ocade-intelligence-service --> Gemini 3.5 Flash-Lite (ONLINE BRAIN)
   | Gemini-selected tool name + typed arguments + observed-state revision
   v
Toolbox Router / live discovery / semantic-vector capability shortlist
   |
   v POLICY GATE (target identity, grants, permission, risk, STOP epoch, quotas)
   |
   v Trusted signed dispatch envelope through enrolled device channel
Signed local Device Agent (outbound authenticated channel + sandbox)
   |
   v MCP process manager / capability gateway / worker isolation / stdio
   +---- native OS / file-format / scoped command tools
   +---- browser DOM / CDP / Playwright tools
   +---- Windows UIA / pywinauto / Win32 (macOS AX where supported)
   +---- evidence / media / geometry / other general-purpose verified tools
   |
   v Action receipts + before/after observations + preview/media evidence
Durable journal -> Supervisor -> Gemini's NEXT bounded decision
   |
   v Independent verifier -> final settlement -> genuine files + activity + timing
\`\`\`

**Security is lateral to EVERY arrow**: authentication, user/device isolation, explicit scopes, exact target identity, idempotency, STOP/Take Over fencing, resource locks, payload bounds, network/filesystem containment, provenance and audit. The outer routing chain never gives Gemini direct administrator credentials or unguarded shell access.

### 1.1 Precise bootstrap and runtime order (NO customer tasks until gate 10)

**BOOTSTRAP:**
1. \`P00\`: inspect existing code, owner authority and baseline; find real owners, tag component statuses and define SHA-bound evidence.
2. \`P01–P04\`: consolidate versioned contracts, permissions, durable task authority, STOP fencing, trusted device identity and process-level boundary.
3. \`P05–P08\`: establish dynamic discovery, capability manifest schema, health/lifecycle, semantic-vector retrieval, model-visible shortlisted schemas.
4. \`P09–P14\`: connect signed device dispatch, MCP/stdio workers, exact targets, native/browser/UI control, local workspace, resource locks and journal.
5. \`P15–P19\`: connect real online model, multimodal observations, adaptive feedback, independent verification, recovery, timings, and coherent UI.
6. \`P20–P22\`: install/package, adversarial qualification, no-hardcode debloat, evidence audit and **formal ARCHITECTURE_READY decision**.

**AT RUNTIME, once qualified:**
1. User submits an outcome; server authenticates user and obtains appropriate online AI consent.
2. Device authority checks enrollment, key possession, current grant scopes, identity and reachability; task supervisor creates durable task + STOP epoch.
3. Gemini translates goal into outcome checks; supervisor validates checks are within scope and independently verifiable.
4. Device performs current state discovery and preflight; registry ingests only signed trusted manifests and live capability health. No imaginary installed apps.
5. Router applies deterministic trust/grant/target/health filters, then semantic/vector similarity, then schema/token budget limits; it exposes a small, relevant **capability** set, not instructions or a fixed journey.
6. Gemini chooses next bounded typed action **after seeing current observations**; if no safe tool can satisfy goal, Gemini asks user or supervisor settles BLOCKED.
7. Server policy and local agent both recheck task/device/user/target, scope, risk, epoch, idempotency, deadline, resource lock, input schema and permissions immediately before mutation.
8. Supervisor journals intended side effect, issues signed/leased action; MCP gateway launches/addresses reviewed worker; worker performs a **primitive** operation.
9. Worker reports independently observable before/after data, artifact handles, error codes, preview/media evidence and action receipt; journal records whether effect is known/unknown.
10. Supervisor returns bounded untrusted observations (plus visual frames where authorized) to Gemini; it dynamically replans; crash, STOP and user intervention fence the loop.
11. A separate verifier performs actual output checks; any failure returns evidence for **bounded** revision, never silent PASS.
12. On full verified success, settle and deliver original/editable outputs where promised, time breakdown, provenance and truthful activity; otherwise PARTIAL/FAIL/BLOCKED with causes.

### 1.2 Model decision vs router vs verifier — no ambiguity

| Component | Allowed to decide | Forbidden |
|---|---|---|
| Gemini brain | User-task milestones, next operation and data arguments, requested revisions after feedback | Grant itself access, choose secrets, bypass policy, forge receipts, decide final verified PASS |
| OD-AVGHHC supervisor | Which authorized state transition/lease/limits, whether to dispatch or suspend, checkpoint scheduling | Replace Gemini with an app-specific customer workflow |
| Registry + semantic/vector router | Which trusted healthy capabilities are relevant and fit token/context limits | Generate task plans or confer authority based on keyword/vector similarity |
| Policy gate | Exact user/device/target/action/risk permission and STOP/idempotency admissibility | Trust model-written credentials, tool metadata or client claims |
| MCP gateway + workers | Implement primitive approved tool operations and return observed effects | Choose an independent customer itinerary, manufacture deliverables |
| Independent verifier | Evaluate observed postconditions and artifact integrity using independent evidence | Take model/tool success declarations as verified evidence |
| Claude engineer | Design, implement, debug, test infrastructure and build qualifying harness | Secretly direct production model task actions or create output to fake acceptance |

## 2. Technical contracts, protocol ownership and wiring

**Existing owners to examine and adapt, not blindly replace:** \`src/lib/jarvis/contracts.ts\` (typed operations/protocol), \`src/lib/jarvis/authority.server.ts\` (task/grants/STOP/device authority), \`src/lib/jarvis/planner.server.ts\` (online planning + offered tools), \`src/lib/jarvis/supervisor.ts\` (state evaluation), \`src/lib/intelligence/edge-handler.ts\` and \`supabase/functions/ocade-intelligence-service/index.ts\` (actual Gemini service, permits), \`src/integrations/supabase/client.server.ts\` (server-only admin), \`device-agent/windows/\` (local runtime), \`scripts/jarvis-protocol.ts\` (generated schema), \`scripts/jarvis-live.mjs\` (currently a live-test harness), \`tests/jarvis/\` and \`scripts/jarvis-no-hardcoded-journeys.mjs\`. Inspect directory contents before assuming additional paths or functions exist. In particular, a hardcoded \`ENGINES\` list or lexical external-tool ranking requires an audit: stable protocol adapters are not automatically prohibited, but the runtime catalog must not be bounded to an app/task keyword table.

### 2.1 Schema-first contracts (illustrative field requirements; extend existing types instead of introducing parallel definitions)

\`\`\`ts
type TaskContext = {
  protocolVersion: number; taskId: string; userId: string;
  deviceId: string; sessionId: string; outcome: string;
  checkedScopes: string[]; deadlineAt: string; epoch: number;
  stateVersion: number; traceId: string;
};
type CapabilityDescriptor = {
  id: string; namespace: string; version: string; publisher: string;
  inputSchema: unknown; outputSchema: unknown; effects: string[];
  requiredScopes: string[]; supportedTargets: string[];
  availability: "healthy" | "unavailable" | "degraded";
  capabilityHealthAt: string; transport: "local" | "mcp" | "browser";
};
type ActionEnvelope = {
  protocolVersion: number; taskId: string; actionId: string;
  idempotencyKey: string; epoch: number; deviceId: string;
  targetIdentity: Record<string, unknown>; capabilityId: string;
  capabilityVersion: string; arguments: unknown;
  requiredScopes: string[]; deadlineAt: string; traceId: string;
};
type EffectReceipt = {
  taskId: string; actionId: string; epoch: number;
  execution: "not_started" | "started" | "finished" | "failed";
  effect: "none" | "confirmed" | "unknown";
  evidenceRefs: string[]; artifactRefs: string[];
  errorCode?: string; monotonicDurationMs: number; traceId: string;
};
type VerificationDecision = {
  taskId: string; checks: Array<{
    id: string; result: "pass" | "fail" | "unverified";
    independentEvidenceRefs: string[];
  }>; status: "PASS" | "PARTIAL" | "FAIL" | "BLOCKED";
};
\`\`\`

These are **contract requirements**, not permission to redefine shipped types. Use a single canonical schema, generated TS/Python validators and migration/version negotiation where actual runtime schemas differ. Keep existing database status nomenclature; never write new enum variants to Supabase without approved migration. Reject unknown protocol versions, stale epochs, excess payloads, mismatched grants, unapproved effect types and duplicate action IDs.

### 2.2 Per-connection responsibilities

| From → to | Transport / contract | Owner's responsibility | Return evidence |
|---|---|---|---|
| OCADE UI → application server | Authenticated HTTPS; identity and body bounds | Establish user goal and authorized scope | Durable task ID; status URL |
| Server → Supabase | Existing trusted client; RPC/RLS | Verify account/consent/grants and store task/journal | Transactional task status, epoch, permit receipts |
| Supervisor → intelligence service | Existing generation permit + authorized server call | Invoke real Gemini only within model/usage permission | Actual model call ID, tool proposals, usage + latency |
| Device ↔ server authority | Enrolled device key, signed/leased poll and ack | Verify device/account/task binding both ways | Fresh device event receipt + telemetry |
| Device → registry | Signed/versioned capability discovery | Report real executable mechanisms and current health | Capability manifests and health provenance |
| Registry → router → Gemini | Filtered schema/description views (not executable package text) | Offer authorized healthy tools with bounded context | Chosen capability IDs; retrieval diagnostics |
| Supervisor → agent → MCP manager | Leased typed envelope with identity/idempotency | Validate before dispatch and before actual effect | Worker protocol receipt tied to exact attempt |
| MCP manager ↔ worker | Official MCP JSON-RPC over scoped stdio or reviewed equivalent | Initialize/list/call, monitor, cancel and reconcile | Raw operation result and stderr diagnostics |
| Worker → supervisor → Gemini | Sanitized receipt, state diff, preview attachments | Attach *real* observation without prompt-injection authority | Model's next bounded choice |
| Journal/verifier → task settlement | Durable effect record, independent file/target checks | Prove result or label uncertainty | Verified artifact hashes, status, timing |
| Server → UI | Authenticated progress stream / polling | Show accurate state, STOP and final files | Final accessible owner-scoped deliverables |

### 2.3 Semantic/vector router: implement in this order

1. **Manifest ground truth:** each runtime-discovered capability carries canonical description, schemas, permissions, target type, transport, risk, version and health. Manual vendor/task whitelists are not the index. A tool name is not proof a callable implementation exists.
2. **Trust filter first:** discard unapproved publisher, invalid schema, unavailable binary, unhealthy endpoint, missing account/device grant, wrong OS/target, incompatible resource/effect or outdated manifest. This must occur before semantic ranking.
3. **Vector representation:** index embeddings of **capability descriptors and reusable operation semantics**, not app-specific plans or user-generated scripts. Use a lawful, approved available embedding method; if no model/index exists, keep correctness via a dynamic descriptor-based semantic/lexical shortlist and mark *vector integration BLOCKED*, never fake embeddings or declare the 84-point gate passed.
4. **Query:** use the current outcome, remaining postconditions, target characteristics and last observation to retrieve candidates. Combine semantic similarity with schema/permission/health/fidelity/latency scores under versioned, auditable ranking. A lexical overlap score alone is **not** a full hierarchical vector system.
5. **Hierarchical narrowing:** goal → current milestone → domain capability group → exact callable tool/schema; choose bounded top-K without flooding Gemini. Capability group means operational semantics, not hardcoded task types.
6. **Gemini last-mile decision:** offer short trusted tool descriptions, exact input schemas and current observed state. Gemini chooses an action; server validates parameters, risk and target. Retrieval itself cannot execute.
7. **Refresh and fallback:** invalidate indexes on schema/health/permission/target changes; refresh after failures/user edits. If an equivalent tool becomes available, shortlist can change without source edits; never automatically install unknown MCP binaries.
8. **Verification:** unseen wording, unseen app, renamed files, new dynamic healthy tool, removed tool, poor similarity, stale embedding, malicious metadata, long catalog, cross-user scope and offline catalog are all mandatory regression cases.

### 2.4 MCP/STDIO process contract

- Per task/device authority opens a managed local gateway; the manager launches only signed, pinned, trusted executables with scoped working directory, environment, network and permissions. Do not grant generic shell/admin privileges.
- Perform MCP version/capability initialization, \`tools/list\`, validated \`tools/call\`; associate each JSON-RPC request ID with exact task/action/lease. Follow the actual MCP SDK framing semantics used by the worker; **never invent framing or dump arbitrary text to stdout**. Logs go to stderr.
- Multiplex worker streams without mixing response IDs or tenants. Apply quotas, timeouts, stream size limits, heartbeat/health, schema checks, cancellation and dead-child cleanup.
- Reconcile ambiguous effects from the journal/actual target before any retry. An MCP return code is **not** independent verification.
- \`pywinauto\`/UIA owns Windows structural GUI control, Playwright/CDP owns scoped browser state, native scripts/object models own supported deterministic operations, safe vision handles inaccessible canvases **only as last resort**. Workers expose generic inspect/invoke/read/write/preview-style capabilities as justified by existing contracts.

### 2.4.1 Local Gateway placement and product contract (owner clarification, 1 November 2026)

**Local Gateway is the already installed, outbound-only OCADE Device Agent with the existing trusted MCP process manager inside it — not localhost itself, not a separate cloud computer, not a second user-facing app and not an additional customer installation.** Keep it **after** signed device-authority dispatch and **before** native/browser/file/GUI workers. Existing authoritative boundaries remain: website → Supabase account/device/task authority → online Gemini decision + supervisor/policy → signed enrolled-device command → **local Device Agent/Local Gateway** → pinned or explicitly approved MCP/STDIO worker → actual local effect → journal + independent verifier → website result. The local agent initiates TLS to the cloud; customers do not open an inbound port or type localhost URLs. Internal IPC/loopback may be used only when access controlled and justified, never as a public unauthenticated desktop-control API.

**Map to the existing 84 concepts without renumbering or rewriting:** #38 approved filesystem workspace, #39–49 trusted local MCP gateway/runtime/STDIO/schema/filtering/batching, #50–64 locking/receipt/STOP/credentials, #65–73 one-installer device/pairing/customer experience, #74–84 evidence and release. The owner's "38 concepts" reference does not replace the present canonical **84-item** checklist.

**One-time customer journey:** user enters objective at ocade.in; if no paired active device, show one platform-specific reviewed installer download. Installer bundles its reviewed runtime, MCP workers, browser/media dependencies as used, and a user-owned tray/background controller; no Python, Node, shell, pip, Homebrew, third-party MCP installation or API key is required. After OS-standard install, device generates a non-exportable/OS-protected key when supported; website shows a short-lived code or validated return link, account approves the fingerprint and narrow grants. Companion reconnects automatically, preflights actual capabilities, and the pending task starts only when grant/target authorization is complete. Persist device grant state; ask again for expanded risk/scope, not every safe UI microstep. Provide visible activity, local STOP, Take Over, revoke, output provenance, uninstall, repair and verified signed updates with rollback. Do not silently elevate, install unknown plug-ins or bypass OS prompts.

**Trust and failure contract:** device signatures, source-bound enrollment, anti-replay, per-action idempotency, deadline and STOP epoch are mandatory. Distinguish execution from effect from verification; after failed ACK inspect the durable journal/actual effect before retrying, never repeat an irreversible action. Treat deterministic 4xx receipt refusal as permanent and bounded transport/5xx as retryable; preserve the journal on delivery failure and show a concrete blocked reason. Monitor one resource owner per application/document/target and detect live user changes; when focus or content changes, pause/refresh/rebind rather than overwrite. Observations are state/event-driven; use screenshots for opaque canvas/visual confirmation when needed, not compulsory full-screen captures after every click. UIA/AX are incomplete on owner-drawn, minimized, locked, secure-desktop and GPU-canvas controls; refuse or use scoped visually grounded foreground interaction where supported, never claim pixel-perfect universal background control.

**Three-key Gemini reliability:** keep three authorized keys only on the existing online service, not device/browser/CI. Check effective model name and quotas at runtime; classify invalid-key, provider-transport and project-wide 429 separately. Rotate across healthy key slots only for eligible pre-output failures, never to bypass shared-project quota; honor retry-after, provider usage limits and zero-new-spend policy. Gemini alone chooses task steps; shorten context via stable action history and fresh observation deltas, batch only **Gemini-selected** authorized safe steps, and enforce a fixed retry/cycle/token/time budget with verifiable progress between attempts. Do not silently substitute another model for JARVIS.

**Cloud qualification, not cloud theater:** run isolated non-deploying GitHub Actions on the implementation branch: Linux portable/DB/protocol/no-hardcode/browser tests; Windows Python/UIA capability and frozen installer smoke; macOS portable contracts and AX only if actually implemented. No workflow may contact production, reveal secrets or use paid runners. GitHub-hosted Windows/macOS services may lack the interactive accessible desktop needed for real UI-control proof; mark native cases BLOCKED until a disposable authorized interactive computer passes. Source screenshots using synthetic colored bars prove mechanical navigation, not real creative quality. After architecture gates, test a **real permitted car photograph and a 30-second car video** with the **same outcome request** on every actually supported OS; do not embed those files or steps in production routing. Independently verify professional editing, playable video, editable project, output hashes, frames, measurements, timing and model-selected traces; failed tests remain FAIL/BLOCKED and trigger root-cause fix plus rerun. No requirement may be declared PASS on the basis of code existence or CI compilation alone.

### 2.5 Permission and STOP invariants

- Validate user identity, grants, account, device key, task status, control epoch, allowed source/destination, process/window/tab/file target, action ID and deadline at **both** server and device; enforce before each write and at late dispatch.
- Keep an append-only effect journal with states proposed → authorized → attempted → acknowledged/effect-known OR effect-unknown → independently verified. These may map to existing DB statuses; do not mutate shipped schema without permission.
- STOP locally fences new actions independent of connectivity; remote STOP means request, delivery, ACK and quiescence are distinct. Already committed effects cannot be undone by cancellation. Take Over suspends colliding UI actions.
- Safeguard UAC, MFA, OAuth, credentials, secrets, payments, external sends, irreversible deletes and other sensitive effects. No automatic spending or bypasses.
- Admin/service-role Supabase secrets remain in a server-only trusted boundary, **not** model/worker logs, prompts, public UI or GitHub. The live harness must not use production accounts or real customer data.

### 2.6 RTAA / RTVC — one real-time, adaptive, outcome-verified control loop

**One architecture, no new 85th concept or competing agent:** **Real-Time Adaptive Autonomy (RTAA)** is the operating behavior of the existing Gemini pilot + OCADE supervisor, local world state, Local Gateway and independent verifier. **Real-Time Visual Control (RTVC)** is RTAA's optional *eyes-and-hands* capability for visual GUI interaction. They share the **same** persisted task, online model authority, permissions, gateway, journal and STOP epoch; never build a second planner, brain, process manager or task-state store. This section refines existing concepts **#11–24 (perception, knowledge, adaptive planning), #25–37 (execution/RTVC), #39–49 (MCP/runtime), #50–60 (recovery), #65–73 (device) and #74–84 (proof)**.

**Runtime contract:** authorized user outcome → live capability/target discovery + bounded world-state snapshot → **Gemini-selected next meaningful action(s)** with typed arguments, target and observable postconditions → supervisor validates authorization, risk, dependency graph, target identity and STOP epoch → outbound authenticated Local Gateway executes via existing MCP/STDIO workers → local observer reports state changes and evidence → independent effect/outcome checks → Gemini updates/replans **only when new judgment is needed** → final verified delivery, or truthful PARTIAL/FAIL/BLOCKED when a limit is reached. **Gemini owns every creative/task-specific decision; OCADE's deterministic engine may perform the already-authorized mechanical suboperations, not invent task steps.** No fixed horizon or fixed number of steps: choose the smallest dependency-safe amount of model-selected work justified by current evidence.

**Robot-style perception, not perpetual screenshot prompting:** maintain a scoped **local world-state view** of windows/process IDs, documents/files, tabs/origins, UIA/AX/accessibility-tree nodes, browser DOM/CDP events, task artifacts and last verified effects. Use OS/browser change notifications and local change detection to update it; on unsupported surfaces use consented cropped visual frames or short sampled screen video. Send Gemini **relevant changes, uncertainty and occasional grounded visuals** rather than an unbounded stream of duplicate images/history. Only a *provider-confirmed compatible* Live model/API may receive a persistent visual stream; validate actual video-input limits, session length, tools, permissions, latency, privacy, model availability and free quota before enabling. **Continuous capture on the PC is not continuous 60-FPS perception by cloud Gemini**; do not pretend every frame or a locked/hidden window is visible. If Live cannot satisfy OCADE's authorized model/consent/budget, retain the existing ordinary Gemini function-call path and targeted visual observations—no unapproved substitute model.

**Knowledge and decision quality:** Gemini supplies general reasoning and creative choices. The registry supplies **current**, authenticated machine capabilities and exact tool schemas; on-demand trusted technical help can explain tool semantics only, never supply a secret, fabricated state, preset customer-edit plan or authority. Use a small relevant dynamic schema shortlist, compact state deltas, durable recent history and fresh visual evidence where needed. The model may express a **dependency-aware action graph** including preconditions, expected effects, sequence constraints and independently executable branches. Dispatch each action **only after complete typed arguments and per-action policy/target validation** (streaming decisions do not authorize unvalidated speculative actions). Parallelize independent read/processing actions; serialize same-window/document writes and request Gemini's next decision when preconditions, target, observed effects or user intent diverge. Never allow generic batched steps to bypass approval, STOP checks or resource locks.

**Execution speed without correctness shortcuts:** prefer native object/file APIs and bounded reviewed scripts/commands (including approved media tools, optionally GPU acceleration), then browser DOM/CDP/Playwright, OS accessibility (Windows UIA/pywinauto, macOS AX, qualified Linux adapter) and only then visually grounded foreground interaction. Use warm **trusted, resource-bounded** MCP/STDIO workers where safe, cached versioned capability manifests, and an authorized **outbound event-driven wake-up** with authenticated polling fallback, not an inbound unauthenticated desktop port. A command may execute in the background only under narrow sandboxed grants; interactive GUI requires real visible/accessible session and user coordination. Optimize **submitted → independently verified delivery**, explicitly measuring model inference, request/response transport, wake time, queue, worker startup, GUI wait, encode/render, recovery and verification p50/p95. Individual local operations may take milliseconds; **0.5-second high-quality complex editing is not a release promise**.

**Autonomous repair and finishing:** after each meaningful effect, compare expected and observed state, verify target identity and quality, and feed genuinely new evidence to Gemini when correction is required. Detect no-progress loops, repeated tool/argument/state cycles, drifted UI targets, lost ACKs, crashing processes and expired sessions; cap model calls, attempts, time and allowed spending. Recover only after journal/effect reconciliation; an unknown write is **not** safe to repeat. Treat completion as independent original-goal checks (for example editability, actual media frames, render duration, audio and fidelity), never merely a 200 response, filename, generated text or AI-reported PASS. Stop for consent, sensitive actions, exhausted permitted quota, unsupported OS/UI, hard blockers and local STOP. Three existing server-only Gemini key slots provide health-based pre-output failover, **not additional shared-project quota**.

**No hardcoded customer journeys — absolute design/test veto:** no production source may choose an application by prompt keyword, force an Office/photo/video editor, embed specific asset names, scene/timeline/shot decisions, fixed app click coordinates, editor selectors, demo artifacts, preset scripts or output checks that merely match the benchmark. Generic format-specific codecs and protocol adapters are permitted **only as discoverable, independently tested capabilities**; they never decide the customer's workflow. Test unfamiliar paraphrases, different file names/assets, absent apps, reordered controls, alternative authorized tools and wrong-target adversarial inputs. A static scan alone is insufficient; require dynamic metamorphic proof.

**Implementation before customer-task tests — strict temporal gate:** first **code, integrate, repair, safely debloat, package and qualify all 84 concepts and G0–G12** (or formally exclude unsupported platforms with explicit proof and no advertised support). Until that full architecture gate is green, run **only** targeted unit, protocol, policy/security, independent verifier, dependency, disposable component/UI, integration, fault-injection and infrastructure tests—**not** real creative/business/customer-task end-to-end tests, including photo/car-video work. A minimal consented provider function/visual-capability smoke may test the architecture but must not be presented as an end-to-end customer task. On each failure: reproduce → identify root cause → implement the smallest correct shared fix → remove demonstrated dead/duplicate code without weakening safeguards → rerun targeted tests → rerun mandatory regression/OS matrix → update SHA-bound evidence. Continue this bounded engineering cycle until **zero failing mandatory gates and no known unresolved critical/high bugs**; never hide flaky failures, skip a gate to make CI green, claim unrun OS tests PASS, or promise a mathematically bug-free product. **Only after the gate** run the unseen, genuine outcome-based acceptance tests in §6, then repair and retest until the commercial verified-success target is met.

## 3. Exactly 84 required architectural concepts: build order, wiring and evidence

**Source:** Curated from the previously supplied \`OCADE_JARVIS_Essential_Architecture_Concepts.md\`. These **84** are the authoritative architecture checklist; the older 143/30/63 research catalog is not a runtime shopping list. Titles are retained, numbered continuously and ordered by engineering dependency. **A design heading does not equal an implementation.** Each entry needs code owner, dependency proof, automated test, status and environment-specific evidence. No vendor/task-specific demo routes count.

### Foundation, authority and architecture

| # | Required concept | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|
| 1 | **OD-AVGHHC — Outcome-Driven Adaptive Verifier-Gated Hierarchical Hybrid Control** | One outcome state machine owns authorization, milestones, tool effects and completion; connect authenticated task authority to the model pilot, gateway, durable journal and independent verifier. | Trace one task across every boundary; reject unverified completion and unowned mutations. |
| 2 | **Architecture C — Unified Hybrid Control** | Use one local-first hybrid execution spine, not a second planner or agent swarm; supervisor delegates only scoped tool calls to device-side generic executors. | A single trace links web request, server task, device lease, worker receipt and verifier. |
| 3 | **Five Primary Architectural Components** | Assign one owner each for supervisor, registry, process manager/MCP gateway, execution bridge and independent verifier; connect through versioned contracts. | No overlapping owners or duplicate executable paths; contract tests pass. |
| 4 | **Single-Dispatcher Architecture** | Serialize each resource mutation through one per-task dispatcher; distribute independent read-only work only when safe. | Concurrent actions against one document are ordered and auditable. |
| 5 | **Supervisor–Pilot / Actor–Critic Separation** | Gemini pilot proposes next typed action; supervisor enforces grants and retry budget; verifier critiques actual observed effects separately. | Replacing Gemini output with unsafe commands never bypasses policy. |
| 6 | **Hierarchical Control and Context Isolation** | Retain outcome and milestone contexts above bounded tool-action contexts; expose minimal current schemas and observations. | Unrelated tool schemas and untrusted documents cannot leak into authority. |
| 7 | **Separation of State** | Keep desired goal, proposed intent, authorized dispatch, observed effects and verified outcome in separately owned records. | A worker's claimed success cannot update verified outcome directly. |
| 8 | **Outcome and Target-State Definition** | Translate consented user intent to model-proposed, policy-reviewed checks; persist clear measurable postconditions before mutations. | Ambiguous or unverifiable checks return an explicit question or BLOCKED. |
| 9 | **Zero Hardcoded Application or Customer-Task Journeys** | Remove keyword-to-app workflows, fixed output names, canned procedural paths and demo scripts from runtime; allow vetted generic adapters. | Metamorphic tests with unseen apps, filenames and paraphrases reach the same dynamic routing mechanism. |
| 10 | **Capability-First Tool Selection** | Candidate tools derive from current executable capability descriptors and actual target availability, not app names. | Changing installed equivalent executors changes candidates without changing planner code. |

### Adaptive intelligence, vector routing and discovery

| # | Required concept | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|
| 11 | **Environment Discovery and Systemic Introspection** | Device reports OS, processes, windows, profiles, file associations, available APIs, drivers, hardware, permissions and target identity to registry. | Fresh discovery matches actual device conditions; unreported tools cannot execute. |
| 12 | **Dynamic Application and Interface Discovery** | Discover installed and active applications and their supported automation surfaces at runtime; avoid static app lists. | Unknown legitimate installed application appears when its supported control surface is discoverable. |
| 13 | **Dynamic Capability Registry and Typed Schemas** | Normalize reviewed tool manifests with IDs, version, input/output JSON schemas, supported effects, permission scope, target and health. | Malformed, duplicate, stale or permissionless manifests are excluded. |
| 14 | **MCP Toolbox Router** | Match model goal and current step to authorized healthy capabilities; shortlist, then Gemini makes final typed selection. | Candidate selection is dynamic and does not create an action plan. |
| 15 | **Semantic Token Gatekeeper** | Expose only bounded shortlisted tool definitions in a Gemini turn; maintain safety invariant for non-shortlisted operations. | Prompt length stays bounded and rejected tools cannot be invoked through fabricated names. |
| 16 | **Vectorized Domain Blueprints** | Index general capability descriptions, schemas and quality criteria with versioned embeddings; retrieve guidance, never executable task templates. | A changed tool manifest invalidates embeddings; vector results carry no authority. |
| 17 | **Receding-Horizon Vector Selector** | Recompute tool candidates from latest observed state and unfinished outcome instead of emitting a fixed multi-step task. | Revised environment or a failure produces an updated candidate set. |
| 18 | **Macroscopic Planning for Unknown Task Horizons** | Gemini sets adaptable milestone intent; supervisor limits turn duration and persisted costs/permissions. | A long job can checkpoint without assuming a fixed step count. |
| 19 | **Bounded Receding-Horizon Planning** | Allow one or a small safe batch of Gemini-selected operations; reobserve before each irreversible step. | Cycle detection, task budget and STOP all terminate unsafe nonprogress. |
| 20 | **Real-Time Observe–Act–Verify–Adapt Loop** | After each effect, return structured receipt plus permitted screen/media evidence to supervisor and Gemini. | A deliberately failed action causes feedback or stop, never fake success. |
| 21 | **Dynamic State Pivot and Self-Correction** | On user edits or worker error, refresh target identity and outcome delta before bounded repair. | No stale coordinates or old file versions are reused after takeover. |
| 22 | **Tool Namespace Isolation** | Use stable fully qualified names and immutable manifest IDs across gateway/registry/providers. | Two tools with same short name cannot cross-call. |
| 23 | **Large Tool Catalog Filtering** | Keep full trusted catalog server/device side and send only stage-relevant tool schemas to Gemini. | Adding 100 irrelevant tools does not overwhelm the next planning turn. |
| 24 | **Live Capability and Dependency Preflight** | Check executable, API support, auth, codecs, browser profile, worker startup, network, rights and grant before proposing execution. | Missing dependencies cause clear unavailable/blocked evidence before mutation. |

### Universal execution and computer control

| # | Required concept | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|
| 25 | **Native-First Execution Hierarchy** | Dispatch fastest safe supported API/object model first; then bounded scripts, formats, DOM/CDP/Playwright, accessibility and vision last. | Fallback transitions include reason and independently recheck effect. |
| 26 | **Native OS and File-Format Operations** | Offer generic filesystem, document format, OS inspection and project-file operations through typed sandboxed tools. | File integrity and ownership preserved, paths constrained to scope. |
| 27 | **Scoped Script and Command Execution** | Use allowlisted or reviewed bounded commands with quotas and argument schemas, never unrestricted model-generated shell. | Injection, path traversal and forbidden executable requests fail closed. |
| 28 | **Windows UI Automation — pywinauto / UIA / Win32** | Use live accessibility trees and exact PID/HWND/process-start identity for native controls, with optional lower-level Win32 only when justified. | Wrong-window, duplicate-title and focus-swap regression tests pass. |
| 29 | **macOS Accessibility — pyobjc / ApplicationServices** | Provide a native AX bridge behind the same interface when macOS is a supported target; do not call Linux tests macOS proof. | OS-specific entitlement and real device tests gate macOS claims. |
| 30 | **Browser DOM / CDP / Playwright Automation** | Bind to the precise authorized browser, profile, tab and origin; prefer semantic DOM/ARIA and official APIs. | Unexpected navigation, lost tab and login challenges pause safely. |
| 31 | **Authenticated Browser Profile and Session Binding** | Use permitted existing sessions without exporting passwords/cookies; revoke tool authority when profile identity changes. | Cross-profile execution and token extraction are rejected. |
| 32 | **Structured Accessibility-Tree Interaction** | Inspect semantic controls, roles, state and geometry freshly before invoking action; avoid stale element IDs. | Changed UI tree triggers rediscovery rather than blind click. |
| 33 | **Exact PID / HWND / Document / Tab Targeting** | Store lease-bound account/device/process/window/file/tab identity and validate immediately before mutation. | Spoofed window title or stale PID cannot redirect operation. |
| 34 | **Window Resize, DPI and Multi-Monitor Resilience** | Requery accessibility state, transforms and visual anchors after display changes; never presume persistent coordinates. | DPI/display movement trials do not select wrong target. |
| 35 | **Foreground, Background and Minimized-Window State Handling** | Differentiate API-capable background work from GUI operations requiring a visible foreground; restore only with consent. | No claim of universal hidden-window clicking or cursor-free execution. |
| 36 | **Visual Anchors / OpenCV as Last-Resort Fallback** | Use bounded vision matching with confidence, fresh screenshots and explicit target checks only where semantic interfaces fail. | Low-confidence target, resize drift or unexpected overlay blocks effect. |
| 37 | **Dynamic Universal Application Fallback Hierarchy** | Select execution mechanism by current capability quality, privacy, fidelity and target state, independent of application names. | A missing native path falls back safely without fixed app-specific script. |
| 38 | **Approved Filesystem Sandbox** | Create per-task bounded input, intermediate and output roots, preserving originals, ACLs and provenance. | Symlink traversal, overwrites and cross-account file access are blocked. |

### MCP, STDIO and tool-runtime wiring

| # | Required concept | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|
| 39 | **Trusted MCP Gateway and Capability Dictionary** | Local device runtime owns MCP connections; server receives signed sanitized manifests, not arbitrary shell hooks. | Only approved manifests can dispatch; remote tools cannot grant themselves permissions. |
| 40 | **Official MCP Tool/Server Lifecycle** | Initialize, negotiate protocol versions, enumerate capabilities, health-check, call and shutdown reviewed MCP workers. | Worker restart and protocol mismatch generate honest errors. |
| 41 | **Core OS, Filesystem, Browser and Accessibility Tool Roles** | Implement minimum stable general-purpose capabilities as composable workers; additional render/data tools remain optional typed plugins. | No customer must manually install developer MCP infrastructure. |
| 42 | **Async STDIO — sys.stdin / sys.stdout** | Transport JSON-RPC MCP frames over child stdin/stdout; stdout is protocol-only and diagnostics go to stderr. | Large outputs, partial frames and worker termination are handled correctly. |
| 43 | **STDIO Subprocess Multiplexing** | Process manager associates each child stream, request ID, task lease, cancellation and timeout with its correct pending call. | Parallel responses never cross tasks or mutate wrong resource. |
| 44 | **Tool Schema Pinning and Validation** | Use existing shared contracts; reject unknown operation, schema drift, excess payloads and invalid result shape at all boundaries. | Contract compatibility tests cover TS↔Python and service↔device. |
| 45 | **Tool Discovery, Versioning and Health Checks** | Cache trusted manifests by version/health TTL; verify package provenance and readiness before enabling a tool. | Revoked/crashed/updated tools disappear from offered candidates. |
| 46 | **Approved External MCP Provenance and Permissions** | Treat third-party tool descriptions as untrusted; require policy, publisher verification, pinning and explicit scope. | Malicious MCP tool metadata cannot exfiltrate secrets or bypass consent. |
| 47 | **Lazy Worker Activation and Isolation** | Spawn vetted workers on demand with scoped environment, quotas, sandbox and resource locks; reap idle workers. | Dead process does not strand a task or leak child processes. |
| 48 | **IPC Latency and Throughput Measurement** | Measure dispatch, queue, worker and serialization times; optimize bottlenecks empirically. | p50/p95 latencies and overhead captured for real runs. |
| 49 | **Deterministic Safe Multi-Action Batching** | Batch only model-selected, preauthorized idempotent/reversible operations inside one identity/STOP lease. | Cancellation or partial batch returns per-effect receipts. |

### State, security, safety and recovery

| # | Required concept | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|
| 50 | **Resource Locking and Semaphores** | Acquire canonical per-resource locks before writes; release on confirmed settle or lease expiration. | Two concurrent tasks cannot overwrite same file/window state. |
| 51 | **Concurrency Protection and Resource-Aware Scheduling** | Queue conflicting writes; permit parallel independent reads/renders under CPU/GPU limits. | Load cannot starve STOP, verifier or responsive UI. |
| 52 | **Task UUIDs and Idempotency Keys** | Assign task/action attempt and effect IDs stable across retries, reconnects and server callbacks. | Replayed requests do not duplicate irreversible effects. |
| 53 | **Transactional Side-Effect Journal** | Write intent and preconditions before action, then evidence/acknowledgment and final classification after action. | Crash between commit and ACK remains UNKNOWN until reconciled. |
| 54 | **Execution, Effect and Verification State Separation** | Represent requested/authorized/dispatched/observed/verified independently in durable state. | An RPC 200, saved path or LLM text never directly settles PASS. |
| 55 | **Lost-Confirmation / Unknown-Effect Reconciliation** | Check external state and idempotency journal before any repeat after timeout/disconnect. | Unknown POST/send/delete is never blindly retried. |
| 56 | **Durable Checkpoints and Crash Recovery** | Persist outcome, consent, exact target, open actions, completed receipts and current epoch. | Process restart reconstructs task without replaying completed operations. |
| 57 | **Local STOP / Pause / Take Over / Resume** | Local kill fence blocks new effects immediately; remote STOP has separate acknowledgment and reconciliation states. | STOP works when cloud/model unavailable; in-flight effects reported truthfully. |
| 58 | **Live User Interference Detection** | Detect human focus/file/tab edits and suspend conflicting UI operations without blocking independent safe work. | Take-over never overwrites newer user changes. |
| 59 | **Target Revalidation After State Changes** | Recheck live process/window/tab/file identity and lease epoch before every mutation and after recovery. | Old handles, URLs and document versions are refused. |
| 60 | **Bounded Retry and Cycle Detection** | Cap steps, token use, time and attempts; change strategy only with observed evidence. | Infinite/self-repeating tool cycles terminate as BLOCKED. |
| 61 | **Graceful Degradation and Honest Blocked States** | Offer compatible alternatives only if authorized and outcome-equivalent; otherwise report reason/action required. | No silently substituted offline model, paid tool or fake artifact. |
| 62 | **Least-Privilege Runtime Sandboxing / ACLs** | Run worker per scoped user/task boundaries with network, path, process and operating-system permission constraints. | Escapes, untrusted downloads and privilege escalation fail closed. |
| 63 | **Scoped Authentication, Consent, OAuth and MFA** | Authenticate user and device independently; preserve account isolation, grants and official login/UAC/MFA challenges. | Cross-tenant, stale grant and forged scope tests fail closed. |
| 64 | **Secrets Vault and Credential Isolation** | Keep provider/service admin keys server side only; never expose to tool schemas, model turns, logs, client or child process. | Secret scans and prompt/worker injection tests show no credential leakage. |

### Device runtime and customer experience

| # | Required concept | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|
| 65 | **Signed Local Device Agent** | Package outbound-authenticated companion; validate update signature, identity and task lease. | Untrusted binary or disconnected device cannot receive privileged action. |
| 66 | **Secure Device Pairing and Revocation** | Pair by authenticated account and device-held key; allow explicit revoke and immediate policy fencing. | Removed device cannot resume or accept a task. |
| 67 | **Persistent Authorized Capability Scopes** | Persist least-privilege grants with purpose, target, epoch and expiry; reask only for new/sensitive scope. | Expired permission and cross-account reuse rejected. |
| 68 | **One-Installer Self-Contained Runtime** | Ship signed OS-specific executable with bundled reviewed workers, libraries and startup diagnostics. | Clean-machine smoke test without developer Python/Node/Docker passes on each advertised OS. |
| 69 | **Scoped Local Workspace and Output Provenance** | Stage files under task workspace; preserve editable origins and source licenses where needed. | Every delivered artifact has verified path, owner and hash. |
| 70 | **Task Activity, Timing and Progress Telemetry** | Record monotonic timestamps for authorization, planning, queue, execution, render, verification and delivery. | Total elapsed and phase sums are explainable; no invented speed. |
| 71 | **Safe Output Delivery and Editable Artifacts** | Return genuine completed files/links and editable project when requested and supported; expose partial evidence when blocked. | Download/readback verification and native-open test pass. |
| 72 | **Minimal Outcome-First User Experience** | Expose natural-language goal, device/scope confirmation, calm status, STOP, activity and delivery, not infrastructure details. | UI reflects real receipts, errors and waiting states. |
| 73 | **Internal MCP Complexity Hidden from Customers** | Install and discover tool services inside signed companion; never require consumer MCP setup. | A fresh customer path contains no CLI/MCP configuration step. |

### Independent verification, optimization and release

| # | Required concept | Build and wire into OCADE | Mandatory proof |
|---:|---|---|---|
| 74 | **Closed-Loop Telemetry Verification** | Collect structured before/after state plus output and nonmodel measurements for each action. | An unobserved write cannot count as completed. |
| 75 | **Independent Professional Deliverable Verification** | Verifier reads actual output via independent method and checks outcome-specific integrity/quality criteria. | An actor-authored PASS does not override verifier failure. |
| 76 | **Postcondition and Output-Integrity Checks** | Validate file opens, dimensions, metadata, structural formula/geometry consistency, requested values and quality. | Corrupt, mislabeled or low-fidelity output is PARTIAL/FAIL. |
| 77 | **Evidence-Based Adaptive Recovery** | Feed verifier failures and observed artifacts back to Gemini for bounded correction without losing original state. | Each repair has new evidence, no blind repeated clicks. |
| 78 | **Real-World Latency and Resource Benchmarks** | Track Gemini time, tool dispatch, native execution, rendering, queue, verifier and customer intervention. | p50/p95, actual wall time and measurable efficiency compared to baseline. |
| 79 | **Real Unprepared End-to-End Task Qualification** | Use previously unseen genuine tasks only after the architecture gate; no prerecorded execution trace. | Actual model-driven output, process trace and independent result are present. |
| 80 | **Adversarial Security and Wrong-Target Tests** | Exercise permissions, stolen/expired leases, duplicate effects, changed window/tab, user edits, crashes and prompt injection. | No critical unauthorized side effects across suite. |
| 81 | **Proof-Driven Debloating and Regression Protection** | Remove unused/duplicate/hardcoded paths with caller trace and parity tests, not line-count goals. | No lost supported operations or degraded STOP/security coverage. |
| 82 | **PASS / PARTIAL / FAIL / BLOCKED / UNTESTED Evidence States** | Maintain per-concept SHA/environment/test IDs and reason; distinguish mocks from live tests. | No unknown/unproven component marked PASS. |
| 83 | **Measured Task Success and User-Intervention Metrics** | Evaluate independently verified task success and count prompts, approvals, retries, time and user actions. | ≥90% benchmark gate only with published denominator and eligible coverage. |
| 84 | **Zero Known Critical Safety-Defect Release Gate** | Require zero known critical/high-severity release blockers and green mandatory architecture tests. | Any proven credential leak, wrong-target mutation or unsafe retry vetoes task acceptance and release. |


## 4. P00–P22 implementation workstreams — exact dependency sequence

**Implementation work includes architecture-specific tests. Do NOT attempt the actual 4K/video/customer-task qualification until ALL of §5 passes.** Continue fixing independent items when one subsystem is blocked, but no shortcut into task tests.

| Package | Dependencies | Engineering deliverable and wiring | Entry → exit proof |
|---|---|---|---|
| **P00** | None | Baseline current SHA, decisions, ownership map, 84-item ledger, hardcode inventory and existing real test evidence; no parallel plan. | No file changes outside authorized branch; historical claims correctly labeled. |
| **P01** | P00 | Canonical versioned protocol, types, schema generator, request IDs, error taxonomy, cross-language validators. | TS/Python/API contract tests, negative input rejection. |
| **P02** | P01 | Existing user identity, permission, online consent and Supabase RLS enforcement. | Forged user/device/tenant/grant rejected. |
| **P03** | P01–P02 | Durable task authority, supervisor, goal/check contract, milestones, lifecycle persistence. | Replay and state-machine transition proofs. |
| **P04** | P02–P03 | STOP/pause/resume/takeover, epoch fencing, bounded deadlines and effect risk. | Local STOP independent of provider; no post-STOP dispatch. |
| **P05** | P01–P04 | Signed trusted device enrollment, pairing, revoke, outbound authenticated channel. | Cross-user and revoked-device tests; actual agent reachable. |
| **P06** | P05 | Dynamic OS/software/browser/file/environment discovery and target identity. | Unseen legitimate capability found; no fabricated app launch. |
| **P07** | P06 | Capability schema, registry, manifest provenance, namespace/version/health checks. | Invalid/unavailable tool excluded; precise healthy manifests. |
| **P08** | P07 | Hierarchical semantic/vector tool retrieval, descriptor indexing, top-K tool schema budgeting. | Live embedding/index if claimed; paraphrase, unknown app, stale index tests. |
| **P09** | P05–P08 | Agent process manager, trusted MCP initialization, STDIO multiplexer, lifecycle, worker isolation. | Real worker/tool-call contract, worker crash/restart and concurrency proof. |
| **P10** | P09 | Local filesystem/native execution, scoped scripts, safe project formats, target handles and file ownership. | Sandbox/ACL/symlink tests and verified read/write receipts. |
| **P11** | P09 | Browser profile/tab/DOM/CDP/Playwright bridge with session/origin gates. | Wrong tab/origin, challenge, detached tab, navigation change. |
| **P12** | P09 | Windows pywinauto/UIA + Win32 bridge, discovered accessible controls, live PID/HWND and focus bounds; macOS AX only when qualified. | Wrong-window and resize/DPI tests on actual advertised OS. |
| **P13** | P10–P12 | Policy-driven mechanism fallback, safe vision-last path, resource locks, bounded worker dispatch. | App-independent fallback, conflict and low-confidence refusal tests. |
| **P14** | P03–P13 | Side-effect journal, idempotency, ACK reconciliation, durable checkpoint/restart and exact target revalidation. | Disconnect between effect and ACK; repeated command never duplicates effect. |
| **P15** | P02–P14 | Existing server permit/generation gate → deployed intelligence function → real authorized Gemini planner. | Real model function-call path separately from mocked provider tests. |
| **P16** | P15 | Implement §2.6's event-driven local world state, structured UI/DOM observations and bounded Gemini visual-feedback loop; optional compatible Live vision only after model/quota/consent verification. | Fresh state delta and scoped preview influence the model's next authorized action; no fabricated always-on cloud vision or task itinerary. |
| **P17** | P14–P16 | Independent effect/outcome verifier and professional artifact checks; validate claims/lineage. | Deliberately broken output fails; model/tool PASS can't bypass verifier. |
| **P18** | P14–P17 | Robust fault recovery, retries, state pivot, simultaneous human changes, UNKNOWN effects, no unapproved fallback. | Controlled fault-injection suite green. |
| **P19** | P03–P18 | User-facing goal/status/STOP/consent/activity/delivery, real timing and provenance ledger. | Accessibility + truthful streaming/reporting and customer files proof. |
| **P20** | P05–P19 | Signed/self-contained installer, worker bundle, startup checks, environment-specific isolation. | Clean OS installation without development runtime; unproven platforms excluded. |
| **P21** | P00–P20 | Complete safe debloating and **root-cause repair of every mandatory architecture test failure**; full protocol, security, device, cross-platform, failure-recovery, RTAA/RTVC and measured-performance regression matrix. | Reproduction → minimal shared fix → targeted + full regression PASS; no known critical/high bug, hidden skip or unverified architecture claim. |
| **P22** | P21 | Formal architecture readiness review, missing evidence report, veto/approval decision and freeze of generic runtime contracts. | All 84 entries PASS or an explicitly justified, tested unsupported-platform exclusion; no known critical/high-severity defects; release gate recorded. |

**Package status reporting:** \`package | current SHA | owner | actual environment | code state | tests passed/failed/skipped | blocker | first needed next action\`. Do not label \`CODED\` as \`VERIFIED\`. If a package is blocked, pursue independent dependency-ready engineering; never bypass its gate.

## 5. Architecture readiness gates — mandatory before any customer-task acceptance test

**The user explicitly requires architecture-first.** Gate status defaults to **NOT VERIFIED**, regardless of optimistic historical checkpoint notes. Real Gemini task qualification only begins after the architecture is established and reliable.

| Gate | Must be demonstrated with evidence | Fail/blocked response |
|---|---|---|
| **G0 — repository integrity** | Only approved implementation branch, single code owner per subsystem, current contracts and historical decisions reconciled, secret scan clean. | Fix source/authority conflict. |
| **G1 — zero hardcoded journeys** | Static scan **and** dynamic metamorphic tests across unknown apps, alternative filenames, paraphrases and changed controls prove no app/task-keyword route, pinned scene, fixed editor steps, prepared artifact or fixed output. Discovered vetted adapters remain capability-only. | Refactor and retest; **absolute veto** on customer-task testing. |
| **G2 — identity/authority** | Live user+device grants, RLS, authenticated task/migration checks, consent, scopes, idempotency, exact device binding. | No delegated mutations. |
| **G3 — local agent/device** | Trusted bundled runtime, signed/reviewed worker startup, pairing, revocation, live reachability on claimed platform. | No computer-control claims. |
| **G4 — capability catalog** | Actual OS/application/tool discovery, reviewed manifest inventory, live health, missing-dependency handling, no invented app support. | No router READY. |
| **G5 — semantic/vector routing** | The actual vector/embedding layer if specified exists, is versioned and tested; top-K dynamic schema selection and permissions work. Lexical-only is PARTIAL. | Complete vector wiring or remain blocked. |
| **G6 — MCP/STDIO execution** | Real JSON-RPC MCP initialize/list/call, worker lifecycle, keyed multiplexing, schema validation and crash health tests. | No dispatch. |
| **G7 — controlled native/browser/UI** | Native/file/command, Playwright, UIA and vision-last fallback work as advertised; exact PID/HWND/tab/file identity preserved. | No unverified platform/use claim. |
| **G8 — STOP, isolation and recovery** | Server+agent epoch checks, immediate local fence, locks, journal, replay-safe idempotency and lost-ACK reconciliation green. | Hard veto on task tests. |
| **G9 — genuine Gemini brain** | Real authorized \`gemini-3.5-flash-lite\` access confirmed at existing approved no-cost provider project; model selects actual tools, reads feedback/previews, uses generation permit and consent. Three key slots checked individually and same-project 429 not misused. | Mock tests may continue but **real task qualification BLOCKED**; no Claude substitute. |
| **G10 — independent verification** | Independent file/output/target postconditions and failure cases, legitimate original/editable output ownership, real elapsed timing. | No PASS settlement. |
| **G11 — architecture regression, debloat and safety** | All 84 concepts coded/integrated or demonstrably safely excluded on unsupported OS, independently evidenced; safe debloat finished with parity; **every mandatory platform/contract/security/RTAA/RTVC test green**; no known unresolved critical/high defects, wrong-target, secret or data-loss issue. | Identify root cause, fix and rerun targeted + full mandatory matrix; **no creative customer-task tests**. |
| **G12 — documented go/no-go** | SHA-bound review records all P00–P22 implementation and debloat complete, G0–G11 passing mandatory evidence, true Windows/macOS/Linux support boundaries, remaining exclusions and owner approvals. **Only this explicit ARCHITECTURE_READY result unlocks §6.** | Remain in architecture-only coding and test/fix loop. |

**Applicability rule:** a concept tied to a platform not yet supported still needs an explicit capability exclusion, no falsely offered feature, tests for safe exclusion and a separately tracked validation gate before claiming that platform. Never silently turn BLOCKED into N/A. The owner requires the architecture as a whole, not an attractive subset.

**Definition of complete:** architecture exists, connectors are wired, code builds, mandatory tests pass, effects are safe, live permitted subsystems produce authentic receipts, no known unresolved critical/high-severity defects, every advertised platform/function has appropriate real proof. This does not mean a metaphysical guarantee of zero bugs. If credentials, real OS hardware, billing authority or device permission are missing, mark **BLOCKED** and keep engineering other components; do not run creative task tests or claim ready.

### 5.1 Required architecture test ladder (allowed BEFORE task tests)

1. Static source/dependency/security audit, no-hardcode guard, artifact provenance and secret scan.
2. Unit/schema/property/metamorphic tests for contracts, discovery, policy, router and invalid inputs.
3. MCP/STDIO worker boot/list/call/timeout/partial-response tests in disposable cloud environment.
4. Integration tests: task authority, RPC, permissions, signed agent messages, lock/journal/STOP, actual server action receipts.
5. Negative/adversarial tests: wrong process/tab/profile/account, symlink traversal, stale epoch, lost ACK, unsafe retry, malicious MCP metadata, forged model tool arguments, STOP during model outage, quota error handling.
6. Actual authorized Gemini **capability smoke tests** (tool selection and visual-input feedback), not customer creative acceptance tasks, within checked free-tier and consent rules.
7. Real OS-level tests only on an authorized cloud Windows/macOS environment (or after separate owner permission for personal PC); Linux mocks do not qualify Windows GUI.
8. Package, self-install, service/worker health, redacted activity, genuine independent verifier and task-state metrics.
9. Full architecture review with tracked PASS / FAIL / PARTIAL / BLOCKED / UNTESTED. Stop before task qualification if any mandatory item is non-PASS.

### 5.2 Concrete developer checks (run ONLY in approved free environments)

\`\`\`sh
npm run jarvis:protocol-check
npm run jarvis:no-hardcoded
npm run test:jarvis
npm run test:jarvis-db
npm run typecheck
npm run lint
npm run build
npm run verify:full
\`\`\`

Run only when dependencies and testing permissions exist; report skipped/blocked. The 1 November 2026 exception permits **isolated, free, non-deploying GitHub Actions on the implementation branch**; no paid cloud work. Add focused failing regression tests for every repaired bug, then run the applicable full mandatory gate before claiming readiness; avoid unnecessary duplicate CI runs. Fixture-created deliverables never count as customer agent work.

## 6. POST-GATE ONLY — autonomous real customer-task acceptance

**Only after G0–G12 PASS**, run genuine previously unseen end-to-end tasks through the **real OCADE user surface and signed agent**, using authorized staging/synthetic accounts and independent verifier. Test harness supplies **only** the user's objective, permitted inputs/scopes and clock instrumentation, not a prepared task plan, creative steps or finished output.

**Initial owner-required acceptance cases (examples for benchmark, NEVER production app/task routing):**

1. **4K editable 3D image:** customer requests a photorealistic red-and-black supercar designed from a blank editable scene, with final **3840 × 2160** image and real editable 3D project when the prompt requests it. Gemini chooses model primitives, geometry, materials, cameras, lighting, renders and iterations by inspecting actual previews. No Claude-authored car JSON, scene template, generator file or predetermined step sequence.
2. **Exactly 30-second cinematic ad:** customer supplies approved footage or requests legally sourced material; Gemini selects actual footage, cuts, effects, color, graphics, sound and properly licensed/original music, observes timeline/contact sheets and rendered output, revises and exports a genuine **30-second** playable video and editable project if supported. No preset shot list, constant timings, preassembled edit decision list, hardcoded target website, author.py or developer-created output.
3. **Unseen broad capability tasks:** choose representative independent tasks spanning native/structured data, browser, file transformation, desktop-control and recovery, without adding task-specific execution code or teaching the router user phrases. Run only when permissions, app availability and environment evidence exist.

**Model-only planning proof:** retain redacted provider request/response lineage, selected tool+arguments, preflight state, tool receipts, preview received by model, correction and verifier outcome. Claude may repair code and tests after an observed failure, then **rerun Gemini**, but cannot manually fill missing scenes, edits or user-task plan. Gemini text alone, mocked provider, canned output, scripted demo files and fake screenshot/video checks are NOT passing acceptance evidence.

### 6.1 Timing and independent completion metrics

Record monotonic UTC-correlated task timestamps with \`submittedAt\`, \`authorizedAt\`, \`firstModelAt\`, \`firstEffectAt\`, \`lastEffectAt\`, \`verifiedAt\` and \`deliveredAt\`. Measure:
- **Actual elapsed** user prompt → independently verified delivery.
- Model latency per actual call, token usage and real provider code; tool discovery, queue, policy, MCP dispatch, rendering, verification, retries, wait-for-user and recovery times.
- Number of tool calls, corrections, crashes, duplicates prevented, user approvals, relogins, manual interventions and costs (must stay ₹0 unapproved).
- Validity (format/dimensions/metadata/readability), editable source, task-specific visual/audio/technical quality and external verifier decision.
- Success fraction = **independently verified complete eligible tasks ÷ all eligible attempted tasks**; publish denominator and failed/blocked counts separately. Commercial readiness target **≥90% genuine real-task success, no known critical safety bugs**, not a fabricated universal guarantee.

**Outcome states:** PASS only with real effect + independent checks; PARTIAL when deliverable incomplete; FAIL when attempted and checks fail; BLOCKED when environment/consent/provider/tool is unavailable; UNTESTED when not attempted. Missing test equipment is never PASS.

## 7. Live provider, credential and infrastructure constraints

- Target online planner is the existing configured **\`gemini-3.5-flash-lite\`**, subject to verification of real availability/identity and permitted use in the current provider account. Gemini text/function output does not itself generate images/videos: discovered reviewed tools execute those effects. No unapproved alternate planner, no offline JARVIS fallback.
- Existing server-side primary/secondary/tertiary staging key **slots**, not assumed healthy, free or independent. Inspect slots **without reading/exposing actual values**. Confirm no-cost billing status and quota through approved account controls before real calls. Never rotate on a shared-project 429 as if each key had its own quota. Honor actual retry-after and vendor terms; no unauthorized quota circumvention.
- Live staging Supabase URL, service-role secret and synthetic account configuration are *environment settings*, never code, GitHub secrets dump or screenshots. Protect service-role bypass of RLS and use only trusted isolated staging. Owner reportedly approved staging migration \`20261030120000\` and a prior session reported applying it; independently confirm deployed schema/version. **This plan does not authorize further migration or deployment.**
- A previous checkpoint reported successful mock/local tests, a coded preview path, a drafted live test harness, but **no independently demonstrated live Gemini planner call and no completed product-led task**. Treat this as historical information until current SHA/deployed evidence is checked. Previous manually scripted image/video outputs are not acceptance.
- Cloud-first free testing. Native Windows/macOS UI qualification needs real authorized platform. Android emulator only at end and only if relevant/authorized; iOS browser coverage cannot be misrepresented as a native iOS simulator test.
- Repository policy: edit and commit only \`ocade/p00-p22-implementation\`; no \`main\` merge, deployment, new billed service, payment activation, or owner's PC without explicit separate permission. **Current exception:** Safe read-only GitHub Actions verification on the implementation branch is expressly approved as of 1 November 2026; production/offline release workflows and new costs remain prohibited. No scheduling or background automations.
- Preserve no-secret logging, real credentials kept server-side and trusted MCP package provenance. Do not copy historical vendor/task lists from the retired 435 KB document back into live execution routing.

## 8. Execution discipline and future agent continuation

**Read order:** \`AGENTS.md\` → \`CLAUDE.md\` → **this \`plan.md\`** → \`docs/DECISIONS.md\` for unresolved owner policy only → existing code owners and SHA-bound test evidence. Do not load huge historical transcripts, previously removed donor code or a competing master plan.

**At each engineering session:**
1. Identify first dependency-ready P00–P22 item lacking actual PASS evidence. Find existing implementation before creating code.
2. Reproduce bug; trace root cause; implement smallest fully safe shared fix; preserve tests/security. Do not write a customer task script.
3. Run targeted automated contract/security/regression tests. Record results and actual environment.
4. Update 84-item traceability with concept IDs, file/owner, dependency, SHA, executable tests, observed result, status. A checklist is not evidence.
5. Continue implementation, safe debloating and the root-cause fix → targeted retest → full mandatory matrix until **G0–G12 are verifiably PASS**; no real customer/creative task test before formal ARCHITECTURE_READY. Blocked hardware/permission remains BLOCKED, never fabricated PASS.
6. Report only: **Phase / workstream | Implemented | PASS/FAIL/PARTIAL/BLOCKED | Exact tests/evidence | Next dependency**. No filler or repeated huge plan. No claims of 100% reliability without measurement.

**Final engineering requirement:** Deliver one minimal, maintainable, dynamically discoverable, model-planned, policy-enforced, locally executed, independently verified OCADE system. The build and wiring must be real. **Architecture qualification precedes customer-task acceptance, never the reverse.**

## Architecture checkpoint — 31 October 2026 (84-concept ledger)

- Ledger: `evidence/2026-10-31-architecture/architecture-ledger.md` — 46 PASS, 25 PARTIAL, 3 FAIL, 8 BLOCKED, 2 UNTESTED. **G12 no-go; no customer acceptance task was run.**
- Built this session: capability descriptors + TF-IDF vector shortlist (top 12, continuity, offered-only selection), model-chosen action batches, verifier-failure feedback for bounded repair, concurrency/multiplexing test, 84-concept validator.
- Staging: credentials and migration verified; real UI run (sign in, pair, grant, request) recorded. **G9 BLOCKED:** the deployed service refuses this session's legacy service-role key (exact-match key list); see the evidence README for the two fixes.
- FAIL: 36 visual-anchor fallback, 58 user-interference detection, 84 release gate. BLOCKED: Windows UI concepts (12, 28, 32, 34, 35), macOS (29), installer (68), real tasks (79).

## Live Gemini checkpoint — 31 October 2026 (later)

- G9 resolved: the replaced staging key passes the service door; live Gemini plans, acts and is verified. Ledger now 46 PASS, 28 PARTIAL, 3 FAIL, 7 BLOCKED, 0 UNTESTED (`evidence/2026-10-31-browser/architecture-ledger.md`).
- Browser video trim through a free web editor: PASS, verified (81 s, 14 model calls). Browser photo editing: FAIL in 9 runs (model loops on canvas-app menus; Free allowance of 28 requests per window). Evidence and timings: `evidence/2026-10-31-browser/README.md`.
- Nine generic defects found live and fixed with regression tests (history budget, unique control references, evidence cap, router continuity, upload read-back, editable widgets, click preview, stored-receipt limit, planner prompt).
- Linux/Xvfb only. Not platform or commercial readiness; Windows/macOS concepts remain BLOCKED.


**Pending physical-media qualification (1 November 2026):** The supplied editor screenshots show synthetic bars and incomplete edits; they are not proof of cinematic real-car deliverables. A genuinely licensed car photograph and 30-second car video must be supplied or discovered with lawful reuse and used only after G0–G12 evidence permits acceptance. Test exactly the same *outcome* across Linux, Windows and macOS supported capabilities, record per-platform untested/blocked support rather than replacing missing macOS AX with a Windows-only bridge. Current implementation is **NO-GO** until these and all critical gate failures are repaired and independently retested.

## Cross-platform CI and live repair checkpoint — 1 November 2026

- Free GitHub Actions matrix green (runs 13–15): Linux build/DB/end-to-end (no longer skipped), Linux/macOS/Windows companion suites, Windows UIA-001…012 against an unseen compiled app, Windows unsigned installer + frozen workers. A cloud Windows runner is not a customer PC: Windows concepts are PARTIAL, not PASS.
- New generic capabilities: `fs.write_text`, `fs.replace_text` (confirmed, sha-guarded, original kept), `shell.run` (confirmed; PowerShell/sh; process-tree containment on timeout and STOP), window image + control boxes for `ui.click_point`, typed keys to a control, live user-input pause (concept 58).
- Security fixes: interpreter-run MCP server scripts now pinned (`argSha256`); exact effect shown for confirmation; deliverables no longer 0600; worker env gains Windows system folders only.
- Live Gemini on a disposable Linux container: 15 clean PASS of 24 attempts, 12 of 17 unseen problems on the first attempt (below the 90% target) (`evidence/2026-11-01-live/README.md`); five generic planner/worker defects found live and fixed with regression tests. Ledger 46 PASS, 36 PARTIAL, 1 BLOCKED, 1 FAIL — **G12 no-go**.


## Codex safety checkpoint — 1 November 2026 UTC

Current continuation and SHA-bound evidence: [Codex checkpoint](evidence/2026-11-01-audit/codex-continuation.md). Baseline `df705de` passed independent cloud run 46. Successive cloud-qualified safety changes include exact URL/provider-turn validation and no-replace publication (run 49), typed/bound verifier rules, original-backup protection and disposable restore qualification (run 53), plus readiness-score integrity and measured browser-payload reduction (run 56).

The next source `83f3142236e5d413e6f7520a7196632b3e4e0c62` repairs cloud-reproduced unknown-write replay/mutation batching and SPA/truncated-address evidence. Full run 58 passed all six jobs: 68/68 focused tests, required real Chromium address case, 74/74 Linux integration, 61 companion tests discovered per OS (explicit skips 3/3/2), and reproducible frozen bundle/installer plus lifecycle. Shutdown transport tracebacks remain an explicit follow-up despite green exit codes. Run 60 independently reproduced the 200-character server/journal limit, lost browser-handoff whitespace, four workbook scalar false positives and missing browser lifecycle ownership. The complete request/schema/scalar/lifecycle fix passed full run 61 (all six jobs): 75 focused JS, 81 integration JS, four real-worker tests, two required browser cases, four real built UI handoff cases, 63 companion cases per OS with explicit skips, real migration/restore and strict frozen/installed worker shutdown. The next source audit found truncated approval arguments and reversible labels on opaque native/page interactions; run 62 reproduced all eleven approval/risk cases (89 tests, 76 PASS / 13 FAIL including two parents). The complete untruncated-approval and eight-interaction risk/worker-protocol candidate is under mandatory qualification. The worker protocol is actual canonical-generator output captured from cloud, not a hand edit. No pending test is counted as PASS.

Independent requirement review remains **70/266 PASS (26.3%), 159 PARTIAL, 14 FAIL, 5 BLOCKED, 18 UNTESTED**; this is the current audited lower bound, not the historical 112/266 restored by assumption. **Commercial readiness is now 10% (1/10 milestones), 17/42 conditions PASS, 17 PARTIAL, 2 FAIL, 5 BLOCKED, 1 UNTESTED** after journal/crash recovery findings; #151/exact approvals are retracted pending the new approval-boundary audit. The 84-concept ledger remains separate: 41 PASS, 41 PARTIAL, 1 FAIL, 1 BLOCKED. **NO-GO / G12 remains closed.** No live-Gemini accuracy remeasurement, customer acceptance, hosted deployment or consumer-device qualification is claimed.

Continue P03/P11/P17/P18/P21 correctness work before real-task acceptance. Blocking residuals include semantic acceptance/anti-gaming, original-file/directory races, verifier web security, native action risk classification, durable effect resolution, provider capacity, dependency/update management and representative hardware/beta qualification. All production/main/payment/signing/spending/personal-PC boundaries remain in force.
