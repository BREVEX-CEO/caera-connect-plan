package com.caeracadane.ocade;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OcadeMobilePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
