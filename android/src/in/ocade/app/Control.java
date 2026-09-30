package in.ocade.app;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Path;
import android.graphics.Rect;
import android.hardware.HardwareBuffer;
import android.os.Bundle;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.accessibility.AccessibilityNodeInfo;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * The work JARVIS does on this phone, one step at a time, in the order of
 * preference every OCADE device keeps: the app's own launcher first, then the
 * app's controls as Android's accessibility layer describes them (by ref, from
 * the latest reading), and the screen itself only as the fallback: a tap at a
 * point is refused unless it comes from the current look at the screen.
 */
final class Control {
    private static final int FRAME_WIDTH = 720;
    private static final int MAX_CONTROLS = 150;

    private static int seq;
    private static String uiObservation;
    private static final Map<String, AccessibilityNodeInfo> refs = new HashMap<>();
    private static String screenObservation;
    private static float screenScale = 1f;

    private Control() {}

    /** What this phone offers, as OCADE's permissions name it. */
    static JSONObject capabilities() throws Exception {
        boolean allowed = OcadeAccessibility.instance != null;
        return new JSONObject()
                .put("apps", true)
                .put("screen", allowed)
                .put("computer_control", allowed)
                .put("accessibility", allowed);
    }

    static List<String> apps(Context context) {
        PackageManager pm = context.getPackageManager();
        Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<String> names = new ArrayList<>();
        for (ResolveInfo info : pm.queryIntentActivities(launcher, 0)) {
            String name = String.valueOf(info.loadLabel(pm)).trim();
            if (!name.isEmpty() && !names.contains(name) && names.size() < 300) names.add(name);
        }
        return names;
    }

    static JSONObject result(String status, String summary) throws Exception {
        return new JSONObject().put("status", status).put("summary", summary);
    }

    /** One action; `cancel` is STOP, checked before anything reaches the screen. */
    static JSONObject run(Context context, JSONObject action, AtomicBoolean cancel) throws Exception {
        String kind = action.optString("action");
        if (cancel.get()) return result("failed", "Stopped before it started");
        switch (kind) {
            case "apps": {
                JSONObject out = result("done", "Found the apps on this phone");
                out.put("apps", new JSONArray(apps(context)));
                return out;
            }
            case "open_app":
                return openApp(context, action.optString("name"));
            default:
                break;
        }
        OcadeAccessibility a11y = OcadeAccessibility.instance;
        if (a11y == null) {
            return result("blocked", "Turn on OCADE JARVIS in Android's Accessibility settings first");
        }
        switch (kind) {
            case "ui_inspect":
                return inspect(a11y);
            case "ui_act":
                return act(a11y, action);
            case "window_list":
                return windows(a11y);
            case "screen":
                return look(a11y);
            case "screen_click":
            case "screen_type":
            case "screen_keys":
            case "screen_scroll":
                return screenStep(a11y, kind, action, cancel);
            default:
                return result("failed", "That is not something JARVIS can do on this phone");
        }
    }

    private static JSONObject openApp(Context context, String name) throws Exception {
        PackageManager pm = context.getPackageManager();
        Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        for (ResolveInfo info : pm.queryIntentActivities(launcher, 0)) {
            if (String.valueOf(info.loadLabel(pm)).trim().equalsIgnoreCase(name.trim())) {
                Intent open = pm.getLaunchIntentForPackage(info.activityInfo.packageName);
                if (open == null) break;
                open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(open);
                return result("done", "Opened " + name);
            }
        }
        return result("failed", name + " is not installed on this phone");
    }

    private static JSONObject windows(OcadeAccessibility a11y) throws Exception {
        JSONArray list = new JSONArray();
        for (android.view.accessibility.AccessibilityWindowInfo window : a11y.getWindows()) {
            CharSequence title = window.getTitle();
            if (title != null) list.put(new JSONObject().put("title", title.toString()).put("active", window.isActive()));
        }
        JSONObject out = result("done", "Checked which apps are on screen");
        out.put("windows", list);
        return out;
    }

    // -- the app's own controls ---------------------------------------------------

    private static JSONObject inspect(OcadeAccessibility a11y) throws Exception {
        AccessibilityNodeInfo root = a11y.getRootInActiveWindow();
        if (root == null) return result("failed", "Nothing on screen can be read right now");
        refs.clear();
        uiObservation = "u" + (++seq);
        JSONArray elements = new JSONArray();
        List<AccessibilityNodeInfo> stack = new ArrayList<>();
        stack.add(root);
        while (!stack.isEmpty() && elements.length() < MAX_CONTROLS) {
            AccessibilityNodeInfo node = stack.remove(stack.size() - 1);
            if (node == null || !node.isVisibleToUser()) continue;
            for (int i = node.getChildCount() - 1; i >= 0; i--) stack.add(node.getChild(i));
            String name = label(node);
            boolean useful = node.isClickable() || node.isEditable() || node.isCheckable()
                    || node.isScrollable() || !name.isEmpty();
            if (!useful) continue;
            String ref = "a" + (refs.size() + 1);
            refs.put(ref, node);
            JSONObject item = new JSONObject().put("ref", ref).put("role", role(node));
            if (!name.isEmpty()) item.put("name", name.length() > 120 ? name.substring(0, 120) : name);
            if (node.isEditable() && !node.isPassword() && node.getText() != null) {
                item.put("value", node.getText().toString());
            }
            if (node.isPassword()) item.put("password", true);
            if (node.isCheckable()) item.put("checked", node.isChecked());
            if (!node.isEnabled()) item.put("disabled", true);
            if (node.isFocused()) item.put("focused", true);
            elements.put(item);
        }
        CharSequence app = root.getPackageName();
        JSONObject out = result("done", "Read the controls on screen");
        out.put("observation", new JSONObject()
                .put("observationId", uiObservation)
                .put("window", app == null ? "" : app.toString())
                .put("elements", elements)
                .put("complete", elements.length() < MAX_CONTROLS));
        return out;
    }

    private static String label(AccessibilityNodeInfo node) {
        CharSequence text = node.isPassword() ? null : node.getText();
        CharSequence said = node.getContentDescription();
        String value = text != null && text.length() > 0 ? text.toString() : said != null ? said.toString() : "";
        return value.trim().replaceAll("\\s+", " ");
    }

    private static String role(AccessibilityNodeInfo node) {
        if (node.isEditable()) return "Edit";
        if (node.isCheckable()) return "CheckBox";
        if (node.isScrollable()) return "List";
        CharSequence cls = node.getClassName();
        String name = cls == null ? "" : cls.toString();
        name = name.substring(name.lastIndexOf('.') + 1);
        if (node.isClickable()) return name.contains("Button") ? "Button" : "Clickable";
        return name.isEmpty() ? "Text" : name.replace("View", "").isEmpty() ? "Text" : name;
    }

    private static JSONObject act(OcadeAccessibility a11y, JSONObject action) throws Exception {
        if (!action.optString("observationId").equals(uiObservation)) {
            JSONObject fresh = inspect(a11y);
            fresh.put("status", "stale").put("summary", "The screen changed since it was read: read it again");
            return fresh;
        }
        AccessibilityNodeInfo node = refs.get(action.optString("ref"));
        if (node == null || !node.refresh()) {
            return result("stale", "That control is no longer on screen");
        }
        String op = action.optString("op");
        boolean ok;
        switch (op) {
            case "set_value": {
                Bundle text = new Bundle();
                text.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                        action.optString("value"));
                ok = node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, text);
                break;
            }
            case "focus":
                ok = node.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
                break;
            case "expand":
                ok = node.performAction(AccessibilityNodeInfo.ACTION_EXPAND);
                break;
            case "collapse":
                ok = node.performAction(AccessibilityNodeInfo.ACTION_COLLAPSE);
                break;
            default: // invoke, toggle, select: the control's own click
                ok = clickable(node).performAction(AccessibilityNodeInfo.ACTION_CLICK);
        }
        uiObservation = null; // anything read before this step is stale now
        return result(ok ? "done" : "failed", ok ? "Used the control" : "That control did not respond");
    }

    private static AccessibilityNodeInfo clickable(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo at = node;
        while (at != null && !at.isClickable()) at = at.getParent();
        return at == null ? node : at;
    }

    // -- the screen: the fallback, always against the current look ------------------

    private static JSONObject look(OcadeAccessibility a11y) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<Bitmap> shot = new AtomicReference<>();
        a11y.takeScreenshot(Display.DEFAULT_DISPLAY, a11y.getMainExecutor(),
                new AccessibilityService.TakeScreenshotCallback() {
                    @Override
                    public void onSuccess(AccessibilityService.ScreenshotResult result) {
                        HardwareBuffer buffer = result.getHardwareBuffer();
                        Bitmap wrapped = Bitmap.wrapHardwareBuffer(buffer, result.getColorSpace());
                        shot.set(wrapped == null ? null : wrapped.copy(Bitmap.Config.ARGB_8888, false));
                        buffer.close();
                        done.countDown();
                    }

                    @Override
                    public void onFailure(int errorCode) {
                        done.countDown();
                    }
                });
        done.await(5, TimeUnit.SECONDS);
        Bitmap bitmap = shot.get();
        if (bitmap == null) return result("failed", "This screen could not be seen (Android refused it)");
        screenScale = bitmap.getWidth() > FRAME_WIDTH ? (float) bitmap.getWidth() / FRAME_WIDTH : 1f;
        Bitmap frame = screenScale == 1f ? bitmap : Bitmap.createScaledBitmap(bitmap,
                Math.round(bitmap.getWidth() / screenScale), Math.round(bitmap.getHeight() / screenScale), true);
        ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
        frame.compress(Bitmap.CompressFormat.JPEG, 60, jpeg);
        screenObservation = "s" + (++seq);
        AccessibilityNodeInfo root = a11y.getRootInActiveWindow();
        JSONObject out = result("done", "Looked at the screen");
        out.put("observation", new JSONObject()
                .put("observationId", screenObservation)
                .put("screen", new JSONObject().put("w", frame.getWidth()).put("h", frame.getHeight()))
                .put("activeWindow", root == null || root.getPackageName() == null ? "" : root.getPackageName().toString())
                .put("imageScale", 1)
                .put("frame", Base64.encodeToString(jpeg.toByteArray(), Base64.NO_WRAP)));
        return out;
    }

    private static JSONObject screenStep(OcadeAccessibility a11y, String kind, JSONObject action,
                                         AtomicBoolean cancel) throws Exception {
        if (!action.optString("observationId").equals(screenObservation)) {
            JSONObject fresh = look(a11y);
            fresh.put("status", "stale").put("summary", "The screen may have changed: look at it again first");
            return fresh;
        }
        screenObservation = null; // one step per look: the next needs a fresh one
        if (cancel.get()) return result("failed", "Stopped before it reached the screen");
        switch (kind) {
            case "screen_click": {
                float x = (float) action.optDouble("x", -1) * screenScale;
                float y = (float) action.optDouble("y", -1) * screenScale;
                DisplayMetrics size = a11y.getResources().getDisplayMetrics();
                if (x < 0 || y < 0 || x > size.widthPixels || y > size.heightPixels) {
                    return result("failed", "That point is outside the screen");
                }
                Path at = new Path();
                at.moveTo(x, y);
                boolean twice = action.optBoolean("double");
                boolean ok = gesture(a11y, at, 0, 60) && (!twice || gesture(a11y, at, 0, 60));
                return result(ok ? "done" : "failed", ok ? (twice ? "Double-tapped" : "Tapped") + " on the screen" : "The tap did not reach the screen");
            }
            case "screen_scroll": {
                DisplayMetrics size = a11y.getResources().getDisplayMetrics();
                float mid = size.widthPixels / 2f;
                boolean down = !"up".equals(action.optString("direction"));
                Path swipe = new Path();
                swipe.moveTo(mid, size.heightPixels * (down ? 0.7f : 0.3f));
                swipe.lineTo(mid, size.heightPixels * (down ? 0.3f : 0.7f));
                boolean ok = gesture(a11y, swipe, 0, 300);
                return result(ok ? "done" : "failed", ok ? "Scrolled " + (down ? "down" : "up") : "The scroll did not reach the screen");
            }
            case "screen_type": {
                AccessibilityNodeInfo focused = a11y.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
                if (focused == null || !focused.isEditable()) {
                    return result("failed", "No text box is selected: tap one first");
                }
                CharSequence before = focused.getText();
                Bundle text = new Bundle();
                text.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                        (before == null ? "" : before.toString()) + action.optString("text"));
                boolean ok = focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, text);
                return result(ok ? "done" : "failed", ok ? "Typed" : "That text box did not accept the text");
            }
            default: { // screen_keys
                JSONArray keys = action.optJSONArray("keys");
                String key = keys == null || keys.length() == 0 ? "" : keys.optString(0).toLowerCase();
                int global;
                switch (key) {
                    case "back": case "escape": case "esc": global = AccessibilityService.GLOBAL_ACTION_BACK; break;
                    case "home": global = AccessibilityService.GLOBAL_ACTION_HOME; break;
                    case "recents": global = AccessibilityService.GLOBAL_ACTION_RECENTS; break;
                    case "notifications": global = AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS; break;
                    case "enter": {
                        AccessibilityNodeInfo focused = a11y.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
                        boolean ok = focused != null && focused.performAction(
                                AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.getId());
                        return result(ok ? "done" : "failed", ok ? "Pressed Enter" : "Nothing took Enter");
                    }
                    default:
                        return result("failed", "That key is not available on a phone");
                }
                boolean ok = a11y.performGlobalAction(global);
                return result(ok ? "done" : "failed", ok ? "Pressed " + key : "Android refused that key");
            }
        }
    }

    private static final AtomicReference<CountDownLatch> gestureWait = new AtomicReference<>();

    private static boolean gesture(OcadeAccessibility a11y, Path path, long start, long duration) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        gestureWait.set(done);
        AtomicBoolean ok = new AtomicBoolean(false);
        GestureDescription description = new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(path, start, duration))
                .build();
        boolean sent = a11y.dispatchGesture(description, new AccessibilityService.GestureResultCallback() {
            @Override
            public void onCompleted(GestureDescription gesture) {
                ok.set(true);
                done.countDown();
            }

            @Override
            public void onCancelled(GestureDescription gesture) {
                done.countDown();
            }
        }, null);
        if (!sent) return false;
        done.await(3, TimeUnit.SECONDS);
        return ok.get();
    }

    /** STOP: a gesture in flight is abandoned. */
    static void cancelGestures() {
        CountDownLatch waiting = gestureWait.getAndSet(null);
        if (waiting != null) waiting.countDown();
    }

    @SuppressWarnings("unused")
    private static Rect bounds(AccessibilityNodeInfo node) {
        Rect rect = new Rect();
        node.getBoundsInScreen(rect);
        return rect;
    }
}
