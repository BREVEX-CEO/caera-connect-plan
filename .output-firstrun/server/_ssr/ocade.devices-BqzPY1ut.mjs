import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { E as Smartphone, Wt as LoaderCircle, Xt as Laptop, Y as RefreshCw } from "../_libs/lucide-react.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { t as TruthfulFailurePanel } from "./TruthfulFailurePanel-Bg65KPix.mjs";
import { i as revokeDevice, t as listDevicesForCurrentUser } from "./devices-WauG9lZl.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.devices-BqzPY1ut.js
var import_jsx_runtime = require_jsx_runtime();
function DevicesPage() {
	const qc = useQueryClient();
	const devices = useQuery({
		queryKey: ["ocade-devices"],
		queryFn: listDevicesForCurrentUser
	});
	const revoke = useMutation({
		mutationFn: async (id) => {
			const result = await revokeDevice(id);
			if (result.error) throw new Error(result.error);
			return id;
		},
		onSuccess: () => void qc.invalidateQueries({ queryKey: ["ocade-devices"] })
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "OCADE",
			title: "Devices",
			description: "Devices actually registered to this account. Revocation is persistent: a revoked browser cannot silently register itself back in.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => void devices.refetch(),
				className: "inline-flex min-h-[24px] items-center gap-1.5 px-1 py-1 text-xs text-muted-foreground hover:text-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, {
					className: "h-3.5 w-3.5",
					"aria-hidden": true
				}), " Refresh"]
			})
		}),
		devices.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TruthfulFailurePanel, {
			className: "mt-6",
			title: "Devices could not be read",
			failed: devices.error instanceof Error ? devices.error.message : String(devices.error),
			safe: "This read failure did not register, revoke or modify a device.",
			notDone: "OCADE did not infer device state from stale UI and did not claim any device was revoked.",
			alternative: "Device settings use the same account-scoped device records.",
			retry: () => void devices.refetch()
		}) : null,
		revoke.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TruthfulFailurePanel, {
			className: "mt-4",
			title: "Device revocation did not complete",
			failed: revoke.error instanceof Error ? revoke.error.message : String(revoke.error),
			safe: "The device remains in its previous authoritative state until the revocation write succeeds.",
			notDone: "OCADE did not mark the device revoked in the interface and did not claim the revocation succeeded.",
			alternative: "Refresh the device list before retrying if the account or network state changed.",
			retry: revoke.variables ? () => revoke.mutate(revoke.variables) : void 0,
			retryLabel: "Retry revocation"
		}) : null,
		!devices.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
			className: "mt-6 overflow-hidden p-0",
			children: devices.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 p-5 text-sm text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
					className: "h-4 w-4 animate-spin",
					"aria-hidden": true
				}), " Reading devices…"]
			}) : devices.data.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "p-5 text-sm text-muted-foreground",
				children: "No devices are registered to this account."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "divide-y divide-border/40",
				children: devices.data.map((device) => {
					const Icon = device.kind === "mobile" ? Smartphone : Laptop;
					const revoked = Boolean(device.revoked_at);
					const revokingThisDevice = revoke.isPending && revoke.variables === device.id;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center gap-3 px-4 py-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
								className: "h-4 w-4 shrink-0 text-muted-foreground",
								"aria-hidden": true
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate text-sm font-medium text-foreground",
									children: device.name ?? `${device.kind} device`
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-0.5 text-xs text-muted-foreground",
									children: revoked ? `Revoked ${new Date(device.revoked_at).toLocaleString()}` : device.last_active_at ? `Last active ${new Date(device.last_active_at).toLocaleString()}` : "No activity timestamp"
								})]
							}),
							revoked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-muted-foreground",
								children: "Revoked"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: revoke.isPending,
								onClick: () => {
									revoke.reset();
									revoke.mutate(device.id);
								},
								className: "rounded-md border border-destructive/30 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50",
								children: revokingThisDevice ? "Revoking…" : "Revoke"
							})
						]
					}, device.id);
				})
			})
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/settings/devices",
			className: "mt-4 inline-block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground",
			children: "Open full device settings"
		})
	] });
}
//#endregion
export { DevicesPage as component };
