package in.ocade.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * A connected phone reconnects after a restart, the way the computer's agent starts at login.
 * Android does not let the microphone start by itself after a restart, so Wake Mode asks
 * once, with a notification that turns it back on.
 */
public final class Boot extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        Identity identity = new Identity(context);
        if (identity.connected()) AgentService.start(context);
        if (identity.prefs.getBoolean("wake", false)) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            manager.createNotificationChannel(new NotificationChannel(
                    WakeService.CHANNEL, "OCADE Wake Mode", NotificationManager.IMPORTANCE_LOW));
            PendingIntent open = PendingIntent.getActivity(context, 4,
                    new Intent(context, MainActivity.class).putExtra("resumeWake", true),
                    PendingIntent.FLAG_IMMUTABLE);
            manager.notify(3, new Notification.Builder(context, WakeService.CHANNEL)
                    .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                    .setContentTitle("Wake Mode is paused after the restart")
                    .setContentText("Tap to let OCADE listen for “OCADE” again.")
                    .setContentIntent(open)
                    .setAutoCancel(true)
                    .build());
        }
    }
}
