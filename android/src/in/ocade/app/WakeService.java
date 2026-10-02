package in.ocade.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.IBinder;
import android.os.SystemClock;

import org.json.JSONObject;

/**
 * Wake Mode on the phone: listens for "OCADE" and "Hey OCADE" with OCADE's own model,
 * bundled in this app (assets/wake), and opens OCADE JARVIS with voice on when it hears
 * one. The audio never leaves the phone. Android requires a notification while the
 * microphone is in use in the background, and this one says plainly what is happening.
 */
public final class WakeService extends Service {
    static final String CHANNEL = "ocade-wake";
    static final String OFF = "in.ocade.app.WAKE_OFF";
    static final float QUIET_RMS = 0.004f;
    static final long REFRACTORY_MS = 2_000;

    static volatile WakeService running;
    /** What the screen shows: listening, or why not. */
    static volatile String status = "Off";

    private volatile boolean stopping;
    private Thread loop;

    static void start(Context context) {
        context.startForegroundService(new Intent(context, WakeService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(
                new NotificationChannel(CHANNEL, "OCADE Wake Mode", NotificationManager.IMPORTANCE_LOW));
        startForeground(2, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        running = this;
        loop = new Thread(this::listen, "ocade-wake");
        loop.start();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && OFF.equals(intent.getAction())) {
            new Identity(this).prefs.edit().putBoolean("wake", false).apply();
            stopSelf();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopping = true;
        running = null;
        status = "Off";
        if (loop != null) loop.interrupt();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification notification() {
        Intent off = new Intent(this, WakeService.class).setAction(OFF);
        PendingIntent turnOff = PendingIntent.getService(this, 2, off, PendingIntent.FLAG_IMMUTABLE);
        PendingIntent open = PendingIntent.getActivity(this, 3, new Intent(this, MainActivity.class),
                PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setContentTitle("OCADE is listening for “OCADE”")
                .setContentText("Wake Mode. What you say stays on this phone until you say OCADE.")
                .setContentIntent(open)
                .setOngoing(true)
                .addAction(new Notification.Action.Builder(null, "Turn off", turnOff).build())
                .build();
    }

    private WakeModel load() throws Exception {
        JSONObject manifest = new JSONObject(new String(
                WakeModel.readAll(getAssets().open("wake/manifest.json")), "UTF-8"));
        byte[] model = WakeModel.readAll(getAssets().open("wake/" + manifest.getString("file")));
        return new WakeModel(model, manifest.getString("sha256"));
    }

    private void listen() {
        WakeModel model;
        try {
            model = load();
        } catch (Exception e) {
            status = "Wake Mode is not available in this version of OCADE";
            stopSelf();
            return;
        }
        float[] audio = new float[WakeModel.WINDOW_SAMPLES];
        short[] block = new short[WakeModel.STEP_SAMPLES];
        int hits = 0;
        long quietUntil = 0;
        while (!stopping) {
            AudioRecord recorder = null;
            try {
                int size = Math.max(AudioRecord.getMinBufferSize(WakeModel.SAMPLE_RATE,
                        AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT), block.length * 4);
                recorder = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, WakeModel.SAMPLE_RATE,
                        AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, size);
                recorder.startRecording();
                status = "Listening for “OCADE”";
                while (!stopping) {
                    int read = 0;
                    while (read < block.length && !stopping) {
                        int n = recorder.read(block, read, block.length - read);
                        if (n < 0) throw new IllegalStateException("microphone read " + n);
                        read += n;
                    }
                    System.arraycopy(audio, block.length, audio, 0, audio.length - block.length);
                    for (int i = 0; i < block.length; i++) audio[audio.length - block.length + i] = block[i] / 32768f;
                    long now = SystemClock.elapsedRealtime();
                    double energy = 0;
                    for (int i = audio.length - 8000; i < audio.length; i++) energy += audio[i] * audio[i];
                    if (now < quietUntil || Math.sqrt(energy / 8000) < QUIET_RMS) {
                        hits = 0;
                        continue;
                    }
                    hits = model.score(model.logMel(audio)) >= model.threshold ? hits + 1 : 0;
                    if (hits >= 2) {  // two looks in a row, 100 ms apart
                        hits = 0;
                        quietUntil = now + REFRACTORY_MS;
                        heard();
                    }
                }
            } catch (Exception e) {
                // The microphone is busy (a call), was taken away, or Android paused it: try again shortly.
                status = "Waiting for the microphone";
                SystemClock.sleep(2_000);
            } finally {
                if (recorder != null) recorder.release();
            }
        }
    }

    /** Heard: OCADE JARVIS opens with voice on, on this phone. */
    private void heard() {
        Identity identity = new Identity(this);
        String here = identity.deviceId() == null ? "" : "&from=" + identity.deviceId();
        startActivity(new Intent(Intent.ACTION_VIEW,
                Uri.parse(identity.server() + "/ocade-jarvis?voice=1" + here))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    }
}
