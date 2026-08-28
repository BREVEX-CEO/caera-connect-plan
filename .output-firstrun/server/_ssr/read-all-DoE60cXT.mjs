//#region node_modules/.nitro/vite/services/ssr/assets/read-all-DoE60cXT.js
/**
* Enough pages for any real account, and a bounded mistake rather than a tab
* that grows until the browser kills it if a server keeps answering in full.
*/
var MAX_PAGES = 200;
/**
* Read every row a query matches, in pages.
*
* `build` is handed an inclusive row range and returns the PostgREST promise
* for it — that is `.range(from, to)` on an otherwise-complete query. Range
* paging rather than keyset because these callers order by `created_at`, which
* is not unique, so there is no key to seek on; the reads are of settled
* history where a shifting window is not a concern.
*/
async function readAllPages(build) {
	const out = [];
	for (let page = 0; page < MAX_PAGES; page += 1) {
		const from = page * 500;
		const { data, error } = await build(from, from + 500 - 1);
		if (error) throw new Error(error.message);
		const rows = data ?? [];
		out.push(...rows);
		if (rows.length < 500) return out;
	}
	throw new Error(`This list is larger than ${MAX_PAGES * 500} rows, which is past what one request can serve.`);
}
//#endregion
export { readAllPages as t };
