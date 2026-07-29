import Capacitor
import Foundation

/**
 Native boundary for OCADE mobile mission control.

 Phase 34 supplies the authenticated relay. Until then this plug-in is
 intentionally fail-closed: it exposes the complete bridge shape but never
 reports pairing, a task mutation, a download, or an emergency stop as
 successful without a PC acknowledgement.
 */
@objc(OcadeMobilePlugin)
public class OcadeMobilePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OcadeMobilePlugin"
    public let jsName = "OcadeMobile"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pairingState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pair", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "missionSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "issueScopedCommand", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "emergencyStop", returnType: CAPPluginReturnPromise),
    ]

    private let unavailable =
        "The authenticated mobile relay is not connected. Nothing was sent to the computer."

    @objc func pairingState(_ call: CAPPluginCall) {
        call.resolve([
            "paired": false,
            "transportConnected": false,
            "detail": unavailable,
        ])
    }

    @objc func pair(_ call: CAPPluginCall) {
        resolveUnavailable(
            call,
            detail: "Pairing cannot complete until the computer acknowledges the single-use challenge."
        )
    }

    @objc func missionSnapshot(_ call: CAPPluginCall) {
        call.resolve([
            "verified": false,
            "detail": "No authenticated PC task snapshot is available.",
        ])
    }

    @objc func issueScopedCommand(_ call: CAPPluginCall) {
        resolveUnavailable(call, detail: unavailable)
    }

    @objc func emergencyStop(_ call: CAPPluginCall) {
        resolveUnavailable(call, detail: unavailable)
    }

    private func resolveUnavailable(_ call: CAPPluginCall, detail: String) {
        call.resolve([
            "acknowledged": false,
            "outcome": "refused",
            "detail": detail,
        ])
    }
}
