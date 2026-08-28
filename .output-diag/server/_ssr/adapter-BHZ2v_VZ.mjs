//#region node_modules/.nitro/vite/services/ssr/assets/adapter-BHZ2v_VZ.js
/** Convenience for adapters that are simply not present on this platform. */
function unavailable(code, reason, remedies = []) {
	return {
		available: false,
		code,
		reason,
		remedies
	};
}
/** Human sentence for a remedy, so every surface words it the same way. */
var REMEDY_LABELS = {
	install_ocade: "Install OCADE",
	pair_a_computer: "Pair a computer",
	download_model: "Download the engine",
	start_engine: "Start the engine",
	free_storage: "Free up storage",
	enable_in_settings: "Enable in settings"
};
//#endregion
export { unavailable as n, REMEDY_LABELS as t };
