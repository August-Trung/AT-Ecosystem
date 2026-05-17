package com.augusttrung.atremote;

import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;

@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {
    private static final String PREFS_NAME = "share_receiver";
    private static final String KEY_PENDING = "pending";
    private static final String KEY_TYPE = "type";
    private static final String KEY_TEXT = "text";
    private static final String KEY_SUBJECT = "subject";
    private static final String KEY_NAME = "name";
    private static final String KEY_MIME = "mime";
    private static final String KEY_PATH = "path";
    private static final String KEY_SIZE = "size";
    private static final long MAX_SHARED_FILE_BYTES = 25L * 1024L * 1024L;

    static void captureIntent(Context context, Intent intent) {
        if (context == null || intent == null) {
            return;
        }
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            return;
        }
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        String subject = String.valueOf(intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT) == null ? "" : intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT));
        SharedPreferences.Editor editor = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit();

        Uri streamUri = firstStreamUri(intent);
        if (streamUri != null) {
            File copied = copySharedUri(context, streamUri, intent.getType());
            if (copied != null) {
                editor.clear();
                editor.putBoolean(KEY_PENDING, true);
                editor.putString(KEY_TYPE, "file");
                editor.putString(KEY_NAME, copied.getName());
                editor.putString(KEY_MIME, cleanMime(context.getContentResolver().getType(streamUri), intent.getType()));
                editor.putString(KEY_PATH, copied.getAbsolutePath());
                editor.putLong(KEY_SIZE, copied.length());
                editor.apply();
                return;
            }
        }

        String cleanText = text == null ? "" : text.toString().trim();
        if (!cleanText.isEmpty()) {
            editor.clear();
            editor.putBoolean(KEY_PENDING, true);
            editor.putString(KEY_TYPE, "text");
            editor.putString(KEY_TEXT, cleanText);
            editor.putString(KEY_SUBJECT, subject);
            editor.apply();
        }
    }

    @PluginMethod
    public void getSharedPayload(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        JSObject payload = new JSObject();
        if (!prefs.getBoolean(KEY_PENDING, false)) {
            payload.put("ok", false);
            call.resolve(payload);
            return;
        }

        String type = prefs.getString(KEY_TYPE, "");
        payload.put("ok", true);
        payload.put("type", type);
        if ("text".equals(type)) {
            payload.put("text", prefs.getString(KEY_TEXT, ""));
            payload.put("subject", prefs.getString(KEY_SUBJECT, ""));
            call.resolve(payload);
            return;
        }

        if ("file".equals(type)) {
            File file = new File(prefs.getString(KEY_PATH, ""));
            if (!file.exists() || !file.isFile()) {
                payload.put("ok", false);
                payload.put("message", "Shared file is no longer available.");
                call.resolve(payload);
                return;
            }
            if (file.length() > MAX_SHARED_FILE_BYTES) {
                payload.put("ok", false);
                payload.put("message", "Shared file is too large.");
                call.resolve(payload);
                return;
            }
            try {
                byte[] raw = readAllBytes(file);
                payload.put("name", prefs.getString(KEY_NAME, file.getName()));
                payload.put("mime", prefs.getString(KEY_MIME, "application/octet-stream"));
                payload.put("size", file.length());
                payload.put("dataBase64", Base64.encodeToString(raw, Base64.NO_WRAP));
                call.resolve(payload);
            } catch (Exception exc) {
                payload.put("ok", false);
                payload.put("message", exc.getMessage());
                call.resolve(payload);
            }
            return;
        }

        payload.put("ok", false);
        call.resolve(payload);
    }

    @PluginMethod
    public void clearSharedPayload(PluginCall call) {
        clearPending(getContext());
        JSObject payload = new JSObject();
        payload.put("ok", true);
        call.resolve(payload);
    }

    private static Uri firstStreamUri(Intent intent) {
        Object stream = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (stream instanceof Uri) {
            return (Uri) stream;
        }
        ArrayList<Uri> streams = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
        if (streams != null && !streams.isEmpty()) {
            return streams.get(0);
        }
        return null;
    }

    private static File copySharedUri(Context context, Uri uri, String intentMime) {
        try {
            ContentResolver resolver = context.getContentResolver();
            String name = safeName(displayName(resolver, uri));
            if (name.isEmpty()) {
                name = safeName(uri.getLastPathSegment());
            }
            if (name.isEmpty()) {
                name = "shared-file";
            }
            File dir = new File(context.getCacheDir(), "shared");
            if (!dir.exists() && !dir.mkdirs()) {
                return null;
            }
            File target = uniqueTarget(dir, name);
            try (InputStream input = resolver.openInputStream(uri); FileOutputStream output = new FileOutputStream(target)) {
                if (input == null) {
                    return null;
                }
                byte[] buffer = new byte[8192];
                int read;
                long total = 0;
                while ((read = input.read(buffer)) != -1) {
                    total += read;
                    if (total > MAX_SHARED_FILE_BYTES) {
                        target.delete();
                        return null;
                    }
                    output.write(buffer, 0, read);
                }
            }
            return target;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String displayName(ContentResolver resolver, Uri uri) {
        try (Cursor cursor = resolver.query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    return cursor.getString(index);
                }
            }
        } catch (Exception ignored) {
        }
        return "";
    }

    private static File uniqueTarget(File dir, String name) {
        File target = new File(dir, name);
        if (!target.exists()) {
            return target;
        }
        String stem = name;
        String ext = "";
        int dot = name.lastIndexOf('.');
        if (dot > 0) {
            stem = name.substring(0, dot);
            ext = name.substring(dot);
        }
        return new File(dir, stem + "-" + System.currentTimeMillis() + ext);
    }

    private static byte[] readAllBytes(File file) throws Exception {
        try (FileInputStream input = new FileInputStream(file); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    private static String safeName(String raw) {
        String value = raw == null ? "" : raw.trim();
        value = value.replaceAll("[\\\\/:*?\"<>|\\x00-\\x1f]+", "_").replaceAll("^\\.+", "").trim();
        if (value.length() > 120) {
            value = value.substring(0, 120);
        }
        return value;
    }

    private static String cleanMime(String resolverMime, String intentMime) {
        String mime = resolverMime == null || resolverMime.trim().isEmpty() ? intentMime : resolverMime;
        return mime == null || mime.trim().isEmpty() ? "application/octet-stream" : mime.trim();
    }

    private static void clearPending(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String path = prefs.getString(KEY_PATH, "");
        if (path != null && !path.isEmpty()) {
            try {
                new File(path).delete();
            } catch (Exception ignored) {
            }
        }
        prefs.edit().clear().apply();
    }
}
