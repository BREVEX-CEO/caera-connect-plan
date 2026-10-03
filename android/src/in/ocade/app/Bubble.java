package in.ocade.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

/**
 * The floating OCADE bubble, over other apps once the person allowed that in
 * Android's own settings. Drag it anywhere; let go and it settles on the
 * nearest edge, inside the screen, where it stays next time. Tap it for the
 * task in progress, STOP JARVIS, Talk and Open JARVIS.
 */
final class Bubble {
    private final AgentService service;
    private final WindowManager windows;
    private final SharedPreferences prefs;
    private final WindowManager.LayoutParams layout;
    private LinearLayout root;
    private TextView dot;
    private LinearLayout panel;
    private TextView line;

    Bubble(AgentService service) {
        this.service = service;
        this.windows = service.getSystemService(WindowManager.class);
        this.prefs = service.getSharedPreferences("ocade", Context.MODE_PRIVATE);
        layout = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT);
        layout.gravity = Gravity.TOP | Gravity.START;
        layout.x = prefs.getInt("bubbleX", 0);
        layout.y = prefs.getInt("bubbleY", dp(160));
    }

    private int dp(float value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value,
                service.getResources().getDisplayMetrics()));
    }

    /** Only where Android allows it: without the permission there is no bubble, and the app says so. */
    void show() {
        if (root != null || !Settings.canDrawOverlays(service)) return;
        root = new LinearLayout(service);
        root.setOrientation(LinearLayout.VERTICAL);
        dot = new TextView(service);
        dot.setText("O");
        dot.setTextColor(Color.WHITE);
        dot.setGravity(Gravity.CENTER);
        dot.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        dot.setContentDescription("OCADE JARVIS");
        GradientDrawable circle = new GradientDrawable();
        circle.setShape(GradientDrawable.OVAL);
        circle.setColor(Color.rgb(20, 20, 20));
        circle.setStroke(dp(2), Color.rgb(236, 236, 236));
        dot.setBackground(circle);
        root.addView(dot, new LinearLayout.LayoutParams(dp(56), dp(56)));

        panel = new LinearLayout(service);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(12), dp(10), dp(12), dp(10));
        GradientDrawable card = new GradientDrawable();
        card.setCornerRadius(dp(14));
        card.setColor(Color.rgb(24, 24, 24));
        panel.setBackground(card);
        line = new TextView(service);
        line.setTextColor(Color.WHITE);
        line.setMaxWidth(dp(240));
        line.setMinWidth(dp(200));
        panel.addView(line);
        panel.addView(button("STOP JARVIS", v -> service.stopEverything()));
        // Going to JARVIS folds the panel away: the bubble stays, out of the way.
        panel.addView(button("Talk to JARVIS", v -> {
            toggle();
            service.openOcade("/ocade-jarvis?voice=1");
        }));
        panel.addView(button("Open JARVIS", v -> {
            toggle();
            service.openOcade("/ocade-jarvis");
        }));
        panel.setVisibility(View.GONE);
        // Its own width: a vertical layout's default (match the parent) squeezed it to the bubble's.
        root.addView(panel, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        // A tap, and TalkBack's double-tap, open and close the panel the same way.
        dot.setOnClickListener(v -> toggle());
        dot.setOnTouchListener(new View.OnTouchListener() {
            private float downX;
            private float downY;
            private int startX;
            private int startY;
            private boolean moved;

            @Override
            public boolean onTouch(View view, MotionEvent event) {
                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        downX = event.getRawX();
                        downY = event.getRawY();
                        startX = layout.x;
                        startY = layout.y;
                        moved = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = event.getRawX() - downX;
                        float dy = event.getRawY() - downY;
                        if (Math.abs(dx) + Math.abs(dy) > dp(6)) moved = true;
                        layout.x = startX + Math.round(dx);
                        layout.y = startY + Math.round(dy);
                        windows.updateViewLayout(root, layout);
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (moved) settle();
                        else view.performClick();
                        return true;
                    default:
                        return false;
                }
            }
        });
        refresh();
        windows.addView(root, layout);
        settle();
    }

    private Button button(String label, View.OnClickListener action) {
        Button button = new Button(service);
        button.setText(label);
        button.setAllCaps(false);
        button.setOnClickListener(action);
        return button;
    }

    /**
     * Open or close the panel. The window is laid out again with it (Android
     * keeps a window's first size otherwise, which squeezed the panel into the
     * bubble's width), and an open panel is moved in so none of it is off screen.
     */
    private void toggle() {
        boolean opening = panel.getVisibility() != View.VISIBLE;
        panel.setVisibility(opening ? View.VISIBLE : View.GONE);
        refresh();
        if (!opening) {
            settle();
            return;
        }
        int width = service.getResources().getDisplayMetrics().widthPixels;
        root.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.AT_MOST),
                View.MeasureSpec.UNSPECIFIED);
        layout.x = Math.max(0, Math.min(layout.x, width - root.getMeasuredWidth()));
        windows.updateViewLayout(root, layout);
    }

    /** To the nearest side, never off screen, remembered for next time. */
    private void settle() {
        int width = service.getResources().getDisplayMetrics().widthPixels;
        int height = service.getResources().getDisplayMetrics().heightPixels;
        layout.x = layout.x + dp(28) < width / 2 ? 0 : width - dp(56);
        layout.y = Math.max(dp(24), Math.min(layout.y, height - dp(56) - dp(24)));
        windows.updateViewLayout(root, layout);
        prefs.edit().putInt("bubbleX", layout.x).putInt("bubbleY", layout.y).apply();
    }

    void keepOnScreen() {
        if (root == null) return;
        if (panel.getVisibility() == View.VISIBLE) toggle(); // folded, then settled below
        else settle();
    }

    void refresh() {
        if (line == null) return;
        JSONObject task = AgentService.task;
        String text = AgentService.status;
        if (task != null) {
            int steps = Math.max(1, task.optInt("steps", 0));
            text = task.optString("title") + "\n" + AgentService.status
                    + (task.optInt("steps", 0) > 0 ? " · step " + Math.min(steps, task.optInt("step") + 1) + " of " + steps : "");
        }
        line.setText(text);
        dot.setContentDescription("OCADE JARVIS · " + AgentService.status);
    }

    void hide() {
        if (root != null) windows.removeView(root);
        root = null;
    }
}
