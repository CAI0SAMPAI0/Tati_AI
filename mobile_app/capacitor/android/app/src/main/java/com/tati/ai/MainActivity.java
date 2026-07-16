package com.tati.ai;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExternalBrowserPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
