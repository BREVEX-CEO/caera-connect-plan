import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as supabase } from "./client-D46NpEQY.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/session-VpaXwoLS.js
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
		const settle = (session) => {
			if (!mounted) return;
			setState({
				user: session?.user ?? null,
				session,
				loading: false
			});
		};
		supabase.auth.getSession().then(({ data }) => settle(data.session)).catch(() => settle(null));
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
