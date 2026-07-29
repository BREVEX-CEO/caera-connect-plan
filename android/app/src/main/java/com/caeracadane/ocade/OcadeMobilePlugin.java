package com.caeracadane.ocade;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Native boundary for the OCADE mobile mission-control shell.
 *
 * Phase 33 deliberately does not invent a relay. Until Phase 34 registers an
 * authenticated transport, every mutating call returns an explicit negative
 * acknowledgement. The web shell therefore cannot turn a missing transport
 * into a false success.
 */
@CapacitorPlugin(name = "OcadeMobile")
public final class OcadeMobilePlugin extends Plugin {
    private static final String UNAVAILABLE =
        "The authenticated mobile relay is not connected. Nothing was sent to the computer.";

    @PluginMethod
    public void pairingState(PluginCall call) {
        JSObject result = new JSObject();
        result.put("paired", false);
        result.put("transportConnected", false);
        result.put("detail", UNAVAILABLE);
        call.resolve(result);
    }

    @PluginMethod
    public void pair(PluginCall call) {
        resolveUnavailable(call, "Pairing cannot complete until the computer acknowledges the single-use challenge.");
    }

    @PluginMethod
    public void missionSnapshot(PluginCall call) {
        JSObject result = new JSObject();
        result.put("verified", false);
        result.put("detail", "No authenticated PC task snapshot is available.");
        call.resolve(result);
    }

    @PluginMethod
    public void issueScopedCommand(PluginCall call) {
        resolveUnavailable(call, UNAVAILABLE);
    }

    @PluginMethod
    public void emergencyStop(PluginCall call) {
        resolveUnavailable(call, UNAVAILABLE);
    }

    private void resolveUnavailable(PluginCall call, String detail) {
        JSObject result = new JSObject();
        result.put("acknowledged", false);
        result.put("outcome", "refused");
        result.put("detail", detail);
        call.resolve(result);
    }
}
