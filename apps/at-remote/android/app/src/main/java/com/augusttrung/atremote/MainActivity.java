package com.augusttrung.atremote;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RemoteDisplayPlugin.class);
        registerPlugin(ShareReceiverPlugin.class);
        ShareReceiverPlugin.captureIntent(this, getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        ShareReceiverPlugin.captureIntent(this, intent);
    }
}
