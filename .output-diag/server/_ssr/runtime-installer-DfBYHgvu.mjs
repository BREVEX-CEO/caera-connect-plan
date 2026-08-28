//#region node_modules/.nitro/vite/services/ssr/assets/runtime-installer-DfBYHgvu.js
/**
* Installing the local engine runtime, so a clean machine is not a dead one.
*
* WHAT THIS FIXES
* ---------------
* `runtime-supervisor.ts` searches a fixed list of paths and, finding nothing,
* returns `binary_not_found` with a sentence explaining that the runtime is not
* installed. That is true, honest, and completely useless to the person it is
* shown to: they did not choose to install a runtime, they installed OCADE. On
* a machine that has never had Ollama, first run currently dead-ends and there
* is nothing anywhere in the repository that would ever install it.
*
* A NON-TECHNICAL USER MUST NEVER SEE THE WORD "OLLAMA"
* ------------------------------------------------------
* Everything here reports through the same generic vocabulary the rest of first
* run uses — "Setting up your assistant". The runtime's name, its version, the
* download size and the URL are implementation details. A progress bar that
* says "Downloading Ollama 0.5.4 (1.2 GB)" turns a product into a homework
* assignment.
*
* AN UNVERIFIED DOWNLOAD IS NEVER EXECUTED, AND THAT IS THE WHOLE SAFETY MODEL
* ----------------------------------------------------------------------------
* This fetches an executable over the network and runs it. That is exactly the
* shape of a supply-chain attack, so the rules are absolute and enforced here
* rather than left to the caller:
*
*   1. HTTPS only, and only to a pinned host. A redirect to another origin is
*      refused rather than followed.
*   2. The bytes are hashed and compared to a digest shipped WITH THE APP, not
*      fetched alongside the download. A digest supplied by the same server as
*      the file proves nothing — whoever replaced one replaced the other.
*   3. A mismatch deletes the file. It is never executed "just this once", and
*      there is no flag to skip the check.
*
* `verifyDownload` is exported and pure so the rule can be tested without a
* network, because a security property that is only exercised by the happy path
* is not a property at all.
*/
/** The one host this module will fetch from. */
var RUNTIME_HOST = "ollama.com";
/**
* Where the runtime comes from on each platform, and how to run it silently.
*
* Linux is deliberately absent. Its official path is a shell script piped into
* `sh`, and piping a downloaded script into a shell is the one thing this
* module exists to refuse — there is no file to hash before it executes. Linux
* users are told to install it themselves, which is honest and, on Linux, a
* completely ordinary thing to be asked.
*/
var SOURCES = {
	win32: {
		url: `https://${RUNTIME_HOST}/download/OllamaSetup.exe`,
		fileName: "ocade-runtime-setup.exe",
		silentArgs: ["/S"]
	},
	darwin: {
		url: `https://${RUNTIME_HOST}/download/Ollama-darwin.zip`,
		fileName: "ocade-runtime.zip",
		silentArgs: []
	}
};
function installSourceFor(platform) {
	return SOURCES[platform] ?? null;
}
/**
* Is this URL one we are willing to fetch an executable from?
*
* Exported because it is also the redirect check: a 302 to a look-alike host is
* the cheapest way to defeat a pinned URL, so every hop is re-tested rather
* than only the first.
*/
/**
* Hosts a runtime download may legitimately end up on.
*
* WHY THIS IS A LIST AND NOT JUST THE VENDOR. `ollama.com/download/...` is a
* redirect to the project's GitHub release assets, so the URL that actually
* serves the bytes is `release-assets.githubusercontent.com`. Pinning to the
* vendor host alone and re-checking after redirects therefore refused the REAL
* download on every machine: the installer reported "Setup could not start
* safely" and installed nothing, forever.
*
* That was not caught by any test, including the end-to-end one, because every
* test supplied its own `finalUrl` and none of them followed a redirect to a
* different host the way the network does.
*
* WHAT ACTUALLY PROTECTS THE DOWNLOAD IS THE DIGEST. The bytes are hashed and
* compared against a manifest shipped inside the application, and a mismatch or
* a missing entry refuses the install. That check does not care which host
* served the file -- it cares that the file is the exact one the release pinned.
* So a CDN in this list is not being trusted to be honest; it is being allowed
* to deliver bytes that are then verified.
*
* The list stays narrow anyway, as defence in depth: an unexpected host is still
* a signal worth refusing on, and a redirect to somewhere arbitrary should never
* pass silently even when a digest would catch it afterwards.
*/
var RUNTIME_ASSET_HOSTS = [
	RUNTIME_HOST,
	"github.com",
	"release-assets.githubusercontent.com",
	"objects.githubusercontent.com"
];
function isTrustedRuntimeUrl(url) {
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	if (parsed.protocol !== "https:") return false;
	return RUNTIME_ASSET_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
}
/**
* Decide whether a downloaded installer may be run. Pure, so it is testable.
*
* A MISSING EXPECTED DIGEST IS A REFUSAL, NOT A PASS. That default is the
* entire point: the failure mode of "we could not check, so we ran it" is
* indistinguishable from having no check at all, and it is the one that ships
* by accident when a release forgets to update the manifest.
*/
function verifyDownload(input) {
	if (!input.expectedSha256) return {
		ok: false,
		reason: "no_expected_digest",
		detail: "This build carries no checksum for the runtime installer, so the download cannot be verified and will not be run."
	};
	if (input.actualSha256.toLowerCase() !== input.expectedSha256.toLowerCase()) return {
		ok: false,
		reason: "digest_mismatch",
		detail: "The runtime installer did not match its expected checksum, so it was deleted without being run."
	};
	return { ok: true };
}
/**
* Install the runtime silently, or explain why not — without ever naming it.
*/
async function installRuntime(deps) {
	const source = installSourceFor(deps.platform);
	if (!source) return {
		ok: false,
		reason: "unsupported_platform",
		detail: "Automatic setup is not available on this system. It can be set up manually."
	};
	if (!isTrustedRuntimeUrl(source.url)) return {
		ok: false,
		reason: "untrusted_source",
		detail: "Setup could not start safely."
	};
	deps.onProgress?.(null);
	let bytes;
	let finalUrl;
	try {
		const got = await deps.download(source.url);
		bytes = got.bytes;
		finalUrl = got.finalUrl;
	} catch {
		return {
			ok: false,
			reason: "download_failed",
			detail: "Setup could not finish. It will try again."
		};
	}
	if (!isTrustedRuntimeUrl(finalUrl)) return {
		ok: false,
		reason: "untrusted_redirect",
		detail: "Setup could not start safely."
	};
	const verdict = verifyDownload({
		actualSha256: await deps.digest(bytes),
		expectedSha256: await deps.expectedDigest(deps.platform)
	});
	if (!verdict.ok) return {
		ok: false,
		reason: verdict.reason,
		detail: "Setup could not be completed safely."
	};
	const path = await deps.writeTemp(source.fileName, bytes);
	let code;
	try {
		code = await deps.run(path, source.silentArgs);
	} catch {
		await deps.remove(path).catch(() => {});
		return {
			ok: false,
			reason: "run_failed",
			detail: "Setup could not finish. It will try again."
		};
	}
	await deps.remove(path).catch(() => {});
	if (code !== 0) return {
		ok: false,
		reason: "installer_failed",
		detail: "Setup could not finish. It will try again."
	};
	deps.onProgress?.(100);
	return {
		ok: true,
		detail: "Setup finished."
	};
}
//#endregion
export { RUNTIME_ASSET_HOSTS, RUNTIME_HOST, installRuntime, installSourceFor, isTrustedRuntimeUrl, verifyDownload };
