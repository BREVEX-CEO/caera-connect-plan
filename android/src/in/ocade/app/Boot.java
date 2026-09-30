package in.ocade.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** A connected phone reconnects after a restart, the way the computer's agent starts at login. */
public final class Boot extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) && new Identity(context).connected()) {
            AgentService.start(context);
        }
    }
}
