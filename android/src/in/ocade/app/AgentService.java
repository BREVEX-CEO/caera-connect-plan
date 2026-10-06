package in.ocade.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Keeps this phone connected to OCADE while the person wants it: asks for work
 * about once a second while a task is open and every few seconds otherwise,
 * runs one step at a time, and reports what happened. STOP (from the bubble or
 * the notification) is local first: the running step's cancel is set before
 * OCADE is even told. A phone OCADE no longer knows forgets its key at once.
 */
public final class AgentService extends Service {
    static final String STOP = "in.ocade.app.STOP";
    static final String CHANNEL = "ocade";
    private static final long BUSY_MS = 1_000;
    private static final long IDLE_MS = 5_000;
    /** Unreachable this long with a step running: it is stopped, nobody could STOP it remotely. */
    private static final long CONTROL_LOSS_MS = 15_000;

    static volatile AgentService running;
    /** What the bubble and the screen show, in the words the person reads everywhere. */
    static volatile String status = "Connecting";
    static volatile JSONObject task;

    private Identity identity;
    private Thread loop;
    private final AtomicBoolean stopping = new AtomicBoolean(false);
    private final AtomicBoolean stopAll = new AtomicBoolean(false);
    private volatile AtomicBoolean cancel = new AtomicBoolean(false);
    private final Object admit = new Object();
    private Bubble bubble;
    private final Handler main = new Handler(Looper.getMainLooper());

    static void start(Context context) {
        context.startForegroundService(new Intent(context, AgentService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        identity = new Identity(this);
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(
                new NotificationChannel(CHANNEL, "OCADE JARVIS", NotificationManager.IMPORTANCE_LOW));
        startForeground(1, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        running = this;
        bubble = new Bubble(this);
        bubble.show();
        loop = new Thread(this::work, "ocade-exchange");
        loop.start();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP.equals(intent.getAction())) stopEverything();
        return START_STICKY;
    }

    /** STOP JARVIS on this phone: the running step now, everything else at OCADE. */
    void stopEverything() {
        synchronized (admit) { // never between a step's admission and its token (see work)
            cancel.set(true);
            stopAll.set(true);
        }
        Control.cancelGestures();
        setStatus("Stopping");
    }

    void openOcade(String path) {
        // Tells the page which device the person is on, so "open Chrome" means this phone's.
        String here = identity.deviceId() == null ? ""
                : (path.contains("?") ? "&" : "?") + "from=" + identity.deviceId();
        Intent view = new Intent(Intent.ACTION_VIEW, Uri.parse(identity.server() + path + here))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(view);
    }

    private void setStatus(String next) {
        status = next;
        main.post(() -> {
            getSystemService(NotificationManager.class).notify(1, notification());
            if (bubble != null) bubble.refresh();
        });
    }

    private Notification notification() {
        PendingIntent open = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 1,
                new Intent(this, AgentService.class).setAction(STOP), PendingIntent.FLAG_IMMUTABLE);
        JSONObject open_task = task;
        String text = open_task == null ? status
                : status + " · " + open_task.optString("title");
        return new Notification.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.presence_online)
                .setContentTitle("OCADE JARVIS")
                .setContentText(text)
                .setContentIntent(open)
                .setOngoing(true)
                .addAction(new Notification.Action.Builder(null, "STOP JARVIS", stop).build())
                .build();
    }

    private void work() {
        JSONArray results = new JSONArray();
        JSONObject frame = null;
        Thread step = null;
        final JSONObject[] outcome = new JSONObject[1];
        String stepId = null;
        String stepTask = null;
        long reached = System.currentTimeMillis();
        long appsSent = 0;
        while (!stopping.get()) {
            try {
                if (step != null && !step.isAlive()) {
                    JSONObject done = outcome[0];
                    JSONObject observation = done.optJSONObject("observation");
                    String live = observation == null ? null : (String) observation.remove("frame");
                    JSONObject result = new JSONObject().put("id", stepId)
                            .put("status", done.optString("status", "failed"))
                            .put("summary", done.optString("summary"));
                    if (observation != null) result.put("observation", observation);
                    JSONObject detail = new JSONObject(done.toString());
                    detail.remove("status");
                    detail.remove("summary");
                    detail.remove("observation");
                    if (detail.length() > 0) result.put("detail", detail);
                    results.put(result);
                    if (live != null) frame = new JSONObject().put("taskId", stepTask).put("jpeg", live);
                    step = null;
                }
                JSONObject body = new JSONObject()
                        .put("results", results)
                        .put("capabilities", Control.capabilities())
                        .put("softwareVersion", Identity.VERSION)
                        .put("running", step == null ? new JSONArray() : new JSONArray().put(stepId));
                if (frame != null) body.put("frame", frame);
                if (stopAll.get()) body.put("stop", true);
                if (System.currentTimeMillis() - appsSent > 3_600_000) {
                    body.put("apps", new JSONArray(Control.apps(this)));
                }
                // The control-loss bound holds while the exchange itself blocks, not only after it fails.
                final AtomicBoolean held = cancel;
                Runnable lost = () -> held.set(true);
                if (step != null) {
                    main.postDelayed(lost, Math.max(0, CONTROL_LOSS_MS - (System.currentTimeMillis() - reached)));
                }
                Identity.Reply reply;
                try {
                    reply = identity.exchange(body);
                } finally {
                    main.removeCallbacks(lost);
                }
                String error = reply.body.optString("error");
                if ((reply.status == 401 || reply.status == 410)
                        && ("device_not_enrolled".equals(error) || "enrollment_expired".equals(error))) {
                    // Removed in OCADE: the work stops first, then the key goes.
                    cancel.set(true);
                    identity.forget();
                    setStatus("Removed from OCADE");
                    stopping.set(true);
                    main.post(this::stopSelf);
                    return;
                }
                if (reply.status == 202 || (reply.status == 401 && identity.waiting())) {
                    setStatus("Waiting to be connected");
                    Thread.sleep(2_000);
                    continue;
                }
                if (reply.status != 200) throw new IllegalStateException("exchange " + reply.status);
                if (identity.waiting()) identity.approved();
                reached = System.currentTimeMillis();
                if (body.has("apps")) appsSent = reached;
                if (body.has("stop")) stopAll.set(false);
                // Only what OCADE kept leaves: a result it could not save is sent again.
                JSONArray acks = reply.body.optJSONArray("acks");
                JSONArray again = new JSONArray();
                for (int i = 0; acks != null && i < acks.length(); i++) {
                    JSONObject ack = acks.getJSONObject(i);
                    if (!"retry".equals(ack.optString("outcome"))) continue;
                    for (int j = 0; j < results.length(); j++) {
                        if (ack.optString("id").equals(results.getJSONObject(j).optString("id"))) {
                            again.put(results.getJSONObject(j));
                        }
                    }
                }
                results = again;
                frame = null;
                task = reply.body.optJSONObject("task");
                boolean busy = reply.body.optBoolean("busy");
                JSONArray stopNow = reply.body.optJSONArray("cancel");
                if (step != null && stopNow != null && stopNow.toString().contains(stepId)) cancel.set(true);
                JSONArray commands = reply.body.optJSONArray("commands");
                // STOP pressed while this exchange was on its way: what it handed out never starts.
                if (step == null && commands != null && commands.length() > 0 && stopAll.get()) {
                    results.put(new JSONObject().put("id", commands.getJSONObject(0).getString("id"))
                            .put("status", "failed").put("summary", "Stopped before it started"));
                    commands = null;
                }
                if (step == null && commands != null && commands.length() > 0) {
                    JSONObject command = commands.getJSONObject(0);
                    stepId = command.getString("id");
                    stepTask = command.optString("taskId");
                    AtomicBoolean mine;
                    synchronized (admit) { // a STOP just before cannot be lost on the old token
                        mine = cancel = new AtomicBoolean(stopAll.get());
                    }
                    JSONObject action = command.getJSONObject("action");
                    boolean confirmed = command.optBoolean("confirmed");
                    outcome[0] = Control.result("failed", "The step failed");
                    step = new Thread(() -> {
                        try {
                            outcome[0] = Control.run(this, action, confirmed, mine);
                        } catch (Exception e) {
                            try {
                                outcome[0] = Control.result("failed", "The step failed (" + e.getClass().getSimpleName() + ")");
                            } catch (Exception ignored) {
                                // the default failure stands
                            }
                        }
                    }, "ocade-step");
                    step.start();
                }
                setStatus(step != null || busy ? statusFrom(task, true) : "Ready");
                Thread.sleep(step != null || busy ? BUSY_MS : IDLE_MS);
            } catch (InterruptedException e) {
                return;
            } catch (Exception e) {
                // Fail closed: work OCADE can no longer see or stop does not continue.
                if (step != null && System.currentTimeMillis() - reached > CONTROL_LOSS_MS) cancel.set(true);
                setStatus("Offline");
                try {
                    Thread.sleep(3_000);
                } catch (InterruptedException stopped) {
                    return;
                }
            }
        }
    }

    private static String statusFrom(JSONObject task, boolean busy) {
        if (task == null) return busy ? "Working" : "Ready";
        switch (task.optString("status")) {
            case "waiting": return "Waiting for you";
            case "taken_over": return "You have control";
            default: return "Working";
        }
    }

    /** Turned sideways (or unfolded): the bubble is put back inside the new screen. */
    @Override
    public void onConfigurationChanged(android.content.res.Configuration changed) {
        super.onConfigurationChanged(changed);
        if (bubble != null) bubble.keepOnScreen();
    }

    @Override
    public void onDestroy() {
        stopping.set(true);
        cancel.set(true);
        if (loop != null) loop.interrupt();
        if (bubble != null) bubble.hide();
        running = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
