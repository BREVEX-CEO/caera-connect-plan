package in.ocade.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONObject;

/**
 * Setting up OCADE on this phone, in one place: what OCADE needs and why, one
 * button that walks through every Android permission screen in turn (Android
 * shows each one itself; OCADE never works around them), connecting this phone
 * to the person's OCADE account, and opening OCADE.
 */
public final class MainActivity extends Activity {
    private Identity identity;
    private TextView state;
    private LinearLayout checklist;
    private Button connect;
    private Button disconnect;
    /** The guided setup is walking through the permission screens. */
    private boolean guiding;
    /** The screen the walk-through last opened, so a decline is not asked again at once. */
    private String lastAsked;
    /** Steps the walk-through has taken, so each return from Android advances it once. */
    private int walked;
    /** What the person left off in this walk-through: the rest is still offered, once each. */
    private final java.util.Set<String> declined = new java.util.HashSet<>();
    /** Something was left off: said plainly, and Set up can be pressed again at any time. */
    private boolean skipped;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            render();
            main.postDelayed(this, 1_000);
        }
    };

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        identity = new Identity(this);
        // A test build may be pointed at a developer's own OCADE; a release build never can.
        String server = getIntent().getStringExtra("server");
        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (debuggable && server != null && server.startsWith("http")) identity.setServer(server);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.rgb(10, 10, 10));
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(20);
        page.setPadding(pad, pad, pad, pad);
        scroll.addView(page);
        // Android draws apps edge to edge: keep the page clear of the status and navigation bars.
        scroll.setOnApplyWindowInsetsListener((view, insets) -> {
            android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars());
            page.setPadding(pad, bars.top + pad, pad, bars.bottom + pad);
            return insets;
        });

        page.addView(text("OCADE", 28, true));
        page.addView(text("Connect this phone to OCADE JARVIS. Your conversations stay in OCADE; this app lets JARVIS work on this phone when you ask, shows the floating OCADE bubble, and lets you stop it at any time.", 15, false));
        state = text("", 16, true);
        state.setContentDescription("Connection");
        page.addView(state);

        checklist = new LinearLayout(this);
        checklist.setOrientation(LinearLayout.VERTICAL);
        page.addView(checklist);
        page.addView(button("Set up everything OCADE needs", v -> {
            guiding = true;
            nextPermission();
        }));

        connect = button("Connect this phone", v -> connectPhone());
        page.addView(connect);
        page.addView(button("Open OCADE JARVIS", v -> open("/ocade-jarvis")));
        disconnect = button("Disconnect this phone", v -> disconnectPhone());
        page.addView(disconnect);
        setContentView(scroll);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (identity.connected() || identity.waiting()) AgentService.start(this);
        // Back from an Android permission screen (its dialog, or a settings page): on to the next.
        if (guiding) advanceLater();
        main.post(tick);
    }

    @Override
    protected void onPause() {
        main.removeCallbacks(tick);
        super.onPause();
    }

    private int dp(float value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value,
                getResources().getDisplayMetrics()));
    }

    private TextView text(String value, int size, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextColor(Color.rgb(236, 236, 236));
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, size);
        if (bold) view.setTypeface(null, android.graphics.Typeface.BOLD);
        view.setPadding(0, dp(8), 0, dp(8));
        return view;
    }

    private Button button(String label, View.OnClickListener action) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setOnClickListener(action);
        return button;
    }

    private boolean notificationsAllowed() {
        return Build.VERSION.SDK_INT < 33
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean overlayAllowed() {
        return Settings.canDrawOverlays(this);
    }

    /** Turned on in Android's settings (it may take a moment to start, and a test tool can hold it back). */
    private boolean accessibilityAllowed() {
        String on = Settings.Secure.getString(getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return on != null && on.contains(getPackageName() + "/");
    }

    /**
     * Opens the next Android screen that still needs the person, or finishes the
     * walk-through. Each screen is shown once per walk-through: a person who
     * comes back without allowing something has decided, and is not sent back
     * to it (or refused by Android again) in a loop.
     */
    private void nextPermission() {
        walked++;
        if (lastAsked != null && !allowed(lastAsked)) declined.add(lastAsked);
        String missing = null;
        for (String step : new String[] {"notifications", "overlay", "accessibility"}) {
            if (!allowed(step) && !declined.contains(step)) {
                missing = step;
                break;
            }
        }
        if ("notifications".equals(missing)) {
            // After two noes Android no longer asks: its own settings page for OCADE still can.
            boolean askedBefore = identity.prefs.getBoolean("askedNotifications", false);
            if (askedBefore && !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
            } else {
                identity.prefs.edit().putBoolean("askedNotifications", true).apply();
                requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, 1);
            }
        } else if ("overlay".equals(missing)) {
            startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName())));
        } else if ("accessibility".equals(missing)) {
            startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
        } else {
            guiding = false;
            skipped = !declined.isEmpty();
            declined.clear();
            lastAsked = null;
            // The bubble appears as soon as it is allowed.
            if (AgentService.running != null) AgentService.running.stopSelf();
            if (identity.connected() || identity.waiting()) AgentService.start(this);
        }
        if (guiding) lastAsked = missing;
        render();
    }

    /**
     * Android answers a permission request either with its dialog (this screen is
     * covered, then resumed) or at once without asking (after two noes). Both
     * report here and on resume; whichever comes first advances the walk-through,
     * the other finds the step already taken. Advancing twice opened the next
     * screen twice and passed over the one in between unseen.
     */
    @Override
    public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (guiding) advanceLater();
    }

    private void advanceLater() {
        int at = walked;
        main.postDelayed(() -> {
            if (guiding && walked == at) nextPermission();
        }, 400);
    }

    private boolean allowed(String step) {
        switch (step) {
            case "notifications": return notificationsAllowed();
            case "overlay": return overlayAllowed();
            default: return accessibilityAllowed();
        }
    }

    private void render() {
        checklist.removeAllViews();
        checklist.addView(item(notificationsAllowed(), "Notifications",
                "So you can see what JARVIS is doing and stop it from the notification."));
        checklist.addView(item(overlayAllowed(), "Display over other apps",
                "For the floating OCADE bubble: task, STOP, Talk and Open JARVIS from any app."));
        checklist.addView(item(accessibilityAllowed(), "Accessibility: OCADE JARVIS",
                "So JARVIS can read and use apps on this phone when you ask. Turn it on in Settings > Accessibility."));
        if (skipped) {
            checklist.addView(text("Some of this was left off. OCADE works without it, with less: "
                    + "press Set up again whenever you want to allow it.", 13, false));
        }
        String now;
        if (identity.connected()) {
            now = "Connected · " + AgentService.status;
            JSONObject task = AgentService.task;
            if (task != null) now += "\n" + task.optString("title");
        } else if (identity.waiting()) {
            now = "Waiting to be connected: approve this phone in OCADE. Its fingerprint is "
                    + identity.fingerprint() + ".";
        } else {
            now = "Not connected";
        }
        state.setText(now);
        connect.setVisibility(identity.connected() ? View.GONE : View.VISIBLE);
        disconnect.setVisibility(identity.connected() || identity.waiting() ? View.VISIBLE : View.GONE);
    }

    private TextView item(boolean done, String name, String why) {
        TextView view = text((done ? "✓ " : "○ ") + name + "\n" + why, 14, false);
        view.setContentDescription(name + (done ? ": allowed" : ": not allowed yet"));
        return view;
    }

    private void open(String path) {
        String here = identity.deviceId() == null ? ""
                : (path.contains("?") ? "&" : "?") + "from=" + identity.deviceId();
        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(identity.server() + path + here)));
    }

    private void connectPhone() {
        connect.setEnabled(false);
        new Thread(() -> {
            try {
                String name = Build.MANUFACTURER + " " + Build.MODEL;
                String[] approve = identity.enroll(name.length() > 120 ? name.substring(0, 120) : name);
                runOnUiThread(() -> {
                    state.setText("Approve this phone in OCADE. Its fingerprint is " + approve[1] + ".");
                    AgentService.start(this);
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(approve[0])));
                    connect.setEnabled(true);
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    state.setText("OCADE could not be reached. Check the connection and try again.");
                    connect.setEnabled(true);
                });
            }
        }, "ocade-connect").start();
    }

    private void disconnectPhone() {
        new Thread(() -> {
            try {
                // Its key stops working in OCADE too.
                identity.exchange(new JSONObject().put("results", new org.json.JSONArray()).put("forget", true));
            } catch (Exception ignored) {
                // offline: the person can remove it in OCADE Devices
            }
            identity.forget();
            if (AgentService.running != null) AgentService.running.stopSelf();
            runOnUiThread(this::render);
        }, "ocade-disconnect").start();
    }
}
