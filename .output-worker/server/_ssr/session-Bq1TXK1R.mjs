import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as supabase } from "./client-BvyzyYvI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/session-Bq1TXK1R.js
var import_react = /* @__PURE__ */ __toESM(require_react());
/**
* Client-only session hook. Reads and subscribes to Supabase auth changes.
* Do NOT use inside a route beforeLoad — the _authenticated gate owns SSR-safe access.
*/
function useSession() {
	const [state, setState] = (0, import_react.useState)({
		user: null,
		session: null,
		loading: true
	});
	(0, import_react.useEffect)(() => {
		let mounted = true;
		supabase.auth.getSession().then(({ data }) => {
			if (!mounted) return;
			setState({
				user: data.session?.user ?? null,
				session: data.session,
				loading: false
			});
		});
		const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
			if (!mounted) return;
			setState({
				user: session?.user ?? null,
				session,
				loading: false
			});
		});
		return () => {
			mounted = false;
			sub.subscription.unsubscribe();
		};
	}, []);
	return state;
}
//#endregion
export { useSession as t };
