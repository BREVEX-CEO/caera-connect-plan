package in.ocade.app;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;

/**
 * Android's own door for reading and using other apps, which only the person
 * can open (Settings > Accessibility). OCADE uses it only to run the step
 * JARVIS was allowed to take, through `Control`; it records nothing by itself.
 */
public final class OcadeAccessibility extends AccessibilityService {
    static volatile OcadeAccessibility instance;

    @Override
    protected void onServiceConnected() {
        instance = this;
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // Nothing is recorded. A new window, dialog or overlay only makes what JARVIS read
        // before stale, so its next step reads the screen again; OCADE's own bubble does not.
        int type = event.getEventType();
        boolean moved = type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                || type == AccessibilityEvent.TYPE_WINDOWS_CHANGED;
        if (moved && !getPackageName().contentEquals(String.valueOf(event.getPackageName()))) {
            Control.invalidate();
        }
    }

    @Override
    public void onConfigurationChanged(android.content.res.Configuration configuration) {
        super.onConfigurationChanged(configuration);
        Control.invalidate(); // rotated, resized or density changed: every position moved
    }

    @Override
    public void onInterrupt() {
        Control.cancelGestures();
    }

    @Override
    public void onDestroy() {
        instance = null;
        super.onDestroy();
    }
}
