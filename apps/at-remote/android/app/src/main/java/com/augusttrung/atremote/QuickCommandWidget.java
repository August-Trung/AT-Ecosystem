package com.augusttrung.atremote;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

public class QuickCommandWidget extends AppWidgetProvider {
    private static final int FLAG_IMMUTABLE = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
    static final String PREFS_NAME = "quick_command_widgets";
    static final String[] DEFAULT_LABELS = {
        "T\u1eaft sau 30 ph\u00fat",
        "Ch\u1ee5p m\u00e0n h\u00ecnh",
        "Tr\u1ea1ng th\u00e1i m\u00e1y"
    };
    static final String[] DEFAULT_COMMANDS = {
        "t\u1eaft m\u00e1y sau 30 ph\u00fat",
        "ch\u1ee5p m\u00e0n h\u00ecnh",
        "tr\u1ea1ng th\u00e1i m\u00e1y"
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        SharedPreferences.Editor editor = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit();
        for (int appWidgetId : appWidgetIds) {
            for (int index = 0; index < DEFAULT_COMMANDS.length; index++) {
                editor.remove(key(appWidgetId, index, "label"));
                editor.remove(key(appWidgetId, index, "command"));
            }
        }
        editor.apply();
    }

    static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_commands);
        int[] viewIds = {R.id.widget_command_1, R.id.widget_command_2, R.id.widget_command_3};
        for (int index = 0; index < viewIds.length; index++) {
            String label = prefs.getString(key(appWidgetId, index, "label"), DEFAULT_LABELS[index]);
            String command = prefs.getString(key(appWidgetId, index, "command"), DEFAULT_COMMANDS[index]);
            views.setTextViewText(viewIds[index], label);
            bindCommand(context, views, viewIds[index], command, appWidgetId * 10 + index);
        }
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    static String key(int appWidgetId, int index, String field) {
        return appWidgetId + "_" + index + "_" + field;
    }

    private static void bindCommand(Context context, RemoteViews views, int viewId, String command, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("atremote://command?text=" + Uri.encode(command)));
        intent.setClass(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, requestCode, intent, FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(viewId, pendingIntent);
    }
}
