//#region node_modules/.nitro/vite/services/ssr/assets/unavailable-reason-BKLY-mVD.js
/**
* PostgREST/PostgreSQL signals for "this table is not there".
* `42P01` is undefined_table; `PGRST205` is PostgREST's schema-cache miss.
*/
var MISSING_TABLE = [
	/relation\s+"?[\w.]+"?\s+does not exist/i,
	/could not find the table/i,
	/\bPGRST205\b/,
	/\b42P01\b/,
	/in the schema cache/i
];
/** The connection, rather than the database, is the problem. */
var OFFLINE = [
	/failed to fetch/i,
	/network\s?error/i,
	/load failed/i,
	/fetch failed/i,
	/net::/i,
	/err_internet_disconnected/i,
	/the internet connection appears to be offline/i
];
function messageOf(error) {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "";
}
function classifyUnavailable(error, copy) {
	const raw = messageOf(error).trim();
	const detail = raw || null;
	if (MISSING_TABLE.some((p) => p.test(raw))) return {
		title: copy.migrationTitle,
		description: copy.migrationNote,
		detail,
		migrationMissing: true
	};
	if (OFFLINE.some((p) => p.test(raw))) return {
		title: copy.loadTitle,
		description: "The connection failed, so this could not be loaded. Check your network and try again.",
		detail,
		migrationMissing: false
	};
	return {
		title: copy.loadTitle,
		description: "Something went wrong while loading this. Try again in a moment.",
		detail,
		migrationMissing: false
	};
}
//#endregion
export { classifyUnavailable as t };
