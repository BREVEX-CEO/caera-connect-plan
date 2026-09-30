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
        // Nothing is watched: the tree is read only when a step asks for it.
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
