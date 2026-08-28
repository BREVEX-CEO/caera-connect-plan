package com.caeracadane.ocade;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OcadeMobilePlugin.class);
        registerPlugin(OcadeBackgroundPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
