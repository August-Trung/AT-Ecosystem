package com.augusttrung.atremote;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.EditText;

public class QuickCommandWidgetConfigureActivity extends Activity {
    private int appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private EditText[] labelInputs;
    private EditText[] commandInputs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setResult(RESULT_CANCELED);
        setContentView(R.layout.widget_quick_commands_configure);

        Intent intent = getIntent();
        Bundle extras = intent.getExtras();
        if (extras != null) {
            appWidgetId = extras.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        }
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }

        labelInputs = new EditText[] {
            findViewById(R.id.widget_label_1),
            findViewById(R.id.widget_label_2),
            findViewById(R.id.widget_label_3)
        };
        commandInputs = new EditText[] {
            findViewById(R.id.widget_command_text_1),
            findViewById(R.id.widget_command_text_2),
            findViewById(R.id.widget_command_text_3)
        };
        for (int index = 0; index < QuickCommandWidget.DEFAULT_COMMANDS.length; index++) {
            labelInputs[index].setText(QuickCommandWidget.DEFAULT_LABELS[index]);
            commandInputs[index].setText(QuickCommandWidget.DEFAULT_COMMANDS[index]);
        }

        findViewById(R.id.widget_config_save).setOnClickListener(this::saveWidget);
    }

    private void saveWidget(View view) {
        SharedPreferences.Editor editor = getSharedPreferences(QuickCommandWidget.PREFS_NAME, Context.MODE_PRIVATE).edit();
        for (int index = 0; index < QuickCommandWidget.DEFAULT_COMMANDS.length; index++) {
            String label = clean(labelInputs[index].getText().toString(), QuickCommandWidget.DEFAULT_LABELS[index]);
            String command = clean(commandInputs[index].getText().toString(), QuickCommandWidget.DEFAULT_COMMANDS[index]);
            editor.putString(QuickCommandWidget.key(appWidgetId, index, "label"), label);
            editor.putString(QuickCommandWidget.key(appWidgetId, index, "command"), command);
        }
        editor.apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(this);
        QuickCommandWidget.updateWidget(this, appWidgetManager, appWidgetId);

        Intent result = new Intent();
        result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        setResult(RESULT_OK, result);
        finish();
    }

    private static String clean(String value, String fallback) {
        String text = value == null ? "" : value.trim();
        return text.isEmpty() ? fallback : text;
    }
}
