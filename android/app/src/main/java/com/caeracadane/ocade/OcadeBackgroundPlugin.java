package com.caeracadane.ocade;

import android.app.DownloadManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;

/**
 * The OCADE background companion, on Android.
 *
 * WHY THIS IS A PLUGIN AND NOT A LOOPBACK SERVER. On a desktop the companion is
 * a separate process and the page reaches it over 127.0.0.1. Inside this shell
 * the companion IS this app, and loopback is not merely unnecessary — it is
 * impossible: capacitor.config.json serves the application over https with
 * cleartext and mixed content both disabled, so the WebView blocks a request to
 * http://127.0.0.1 before anything can answer. The bridge reaches this class
 * through Capacitor instead; the protocol is otherwise identical, method for
 * endpoint, and docs/OCADE_BACKGROUND_COMPANION_PROTOCOL.md governs both.
 *
 * WHY DownloadManager. It is the OS service that keeps transferring while the
 * app is closed or killed, resumes across reboots, and honours the user's
 * metered-network preferences without this code inventing a policy. That is the
 * entire benefit a handoff exists to buy: a tab can only promise to resume when
 * the person comes back, and this can promise the model will be there.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It does not decide whether the artifact is genuine. It reports a digest it
 * computed and the website compares that with the one in its own committed
 * catalogue before anything is activated. Being part of the same application
 * does not make this the judge of its own work — the rule that makes a
 * downloaded model safe is the rule that makes a handed-off one safe, and it is
 * the same rule rather than a weaker one.
 *
 * It does not substitute a source of its own. The website hands over its ordered
 * ladder and this works it in order, so a failover here lands where a failover
 * in the browser would have.
 *
 * It does not start a second transfer for a version already in progress. The
 * job registry is written to SharedPreferences rather than held in memory,
 * because the process this class lives in is exactly the process Android is
 * free to kill — and a registry that dies with it would let the next launch
 * enqueue a second download of the same gigabyte.
 */
@CapacitorPlugin(name = "OcadeBackground")
public final class OcadeBackgroundPlugin extends Plugin {
    /** The protocol version in the document above. Anything else is refused by the web side. */
    private static final int PROTOCOL = 1;

    private static final String STORE = "ocade.background.jobs";
    private static final String KEY_PREFIX = "job.";
    private static final String DIRECTORY = "ocade-intelligence";

    private DownloadManager downloads() {
        return (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
    }

    private SharedPreferences store() {
        return getContext().getSharedPreferences(STORE, Context.MODE_PRIVATE);
    }

    /** Where a version's artifact lives. One directory, so uninstall can be complete. */
    private File artifactFile(String version) {
        File directory = new File(getContext().getExternalFilesDir(null), DIRECTORY);
        if (!directory.exists()) directory.mkdirs();
        return new File(directory, version + ".gguf");
    }

    @PluginMethod
    public void identity(PluginCall call) {
        JSObject result = new JSObject();
        result.put("product", "ocade-companion");
        result.put("protocol", PROTOCOL);
        result.put("platform", "android");
        /*
         * The truth about THIS install, not about Android in general. If the
         * download service is unavailable to this app there is nothing here the
         * tab does not already have, and the website must keep the work rather
         * than hand it somewhere it would stall.
         */
        result.put("backgroundTransfer", downloads() != null);
        call.resolve(result);
    }

    @PluginMethod
    public void prepare(PluginCall call) {
        String version = call.getString("version");
        String sha256 = call.getString("sha256");
        JSArray sources = call.getArray("sources");
        if (version == null || sha256 == null || sources == null || sources.length() == 0) {
            call.reject("prepare needs a version, a digest and at least one source");
            return;
        }

        /*
         * A version already in flight returns the job it already has. Returning
         * a new one would be the two-downloads defect the protocol's first rule
         * exists to prevent, arrived at from the native side instead of the web
         * one.
         */
        String existing = store().getString(KEY_PREFIX + version, null);
        if (existing != null) {
            JSObject result = new JSObject();
            result.put("jobId", existing);
            call.resolve(result);
            return;
        }

        List<String> ladder = new ArrayList<>();
        try {
            for (int i = 0; i < sources.length(); i += 1) ladder.add(sources.getString(i));
        } catch (Exception failure) {
            call.reject("the source ladder could not be read");
            return;
        }

        try {
            File target = artifactFile(version);
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(ladder.get(0)));
            request.setDestinationUri(Uri.fromFile(target));
            request.setTitle("Preparing OCADE");
            // Deliberately no model name, vendor, file name or size: a
            // notification is ordinary user-facing surface and the product
            // language rule applies to it exactly as it does to a screen.
            request.setDescription("OCADE Intelligence");
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(false);
            request.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE
            );

            long id = downloads().enqueue(request);
            String jobId = version + ":" + id;
            store()
                .edit()
                .putString(KEY_PREFIX + version, jobId)
                .putString(jobId + ".version", version)
                .putString(jobId + ".sha256", sha256)
                .putString(jobId + ".sources", joined(ladder))
                .putInt(jobId + ".source", 0)
                .apply();

            JSObject result = new JSObject();
            result.put("jobId", jobId);
            call.resolve(result);
        } catch (Exception failure) {
            call.reject("the download could not be started: " + failure.getMessage());
        }
    }

    @PluginMethod
    public void progress(PluginCall call) {
        String jobId = call.getString("jobId");
        if (jobId == null) {
            call.reject("progress needs a jobId");
            return;
        }
        String version = store().getString(jobId + ".version", null);
        if (version == null) {
            call.resolve(phase("idle", "", 0, null));
            return;
        }

        long id;
        try {
            id = Long.parseLong(jobId.substring(jobId.lastIndexOf(':') + 1));
        } catch (NumberFormatException malformed) {
            call.resolve(phase("failed", version, 0, null));
            return;
        }

        Cursor cursor = downloads().query(new DownloadManager.Query().setFilterById(id));
        if (cursor == null || !cursor.moveToFirst()) {
            if (cursor != null) cursor.close();
            call.resolve(phase("failed", version, 0, null));
            return;
        }
        try {
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            long received =
                cursor.getLong(
                    cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
                );
            long total =
                cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));

            if (status == DownloadManager.STATUS_SUCCESSFUL) {
                /*
                 * Hashed only now. A digest reported before the artifact is
                 * whole would be compared against the published one and
                 * rejected, so reporting one early is worse than reporting
                 * none — it turns a working transfer into a failed handoff.
                 */
                File file = artifactFile(version);
                JSObject result = phase("complete", version, file.length(), total > 0 ? total : file.length());
                result.put("sha256", digestOf(file));
                result.put("artifactUrl", localUrl(file));
                call.resolve(result);
                return;
            }
            if (status == DownloadManager.STATUS_FAILED) {
                if (advanceToNextSource(jobId, version)) {
                    call.resolve(phase("downloading", version, 0, total > 0 ? total : null));
                    return;
                }
                JSObject result = phase("failed", version, received, total > 0 ? total : null);
                result.put("reason", "every source in the ladder failed");
                call.resolve(result);
                return;
            }
            call.resolve(phase("downloading", version, received, total > 0 ? total : null));
        } catch (Exception failure) {
            call.resolve(phase("failed", version, 0, null));
        } finally {
            cursor.close();
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String jobId = call.getString("jobId");
        JSObject result = new JSObject();
        if (jobId == null) {
            result.put("ok", false);
            call.resolve(result);
            return;
        }
        try {
            long id = Long.parseLong(jobId.substring(jobId.lastIndexOf(':') + 1));
            downloads().remove(id);
            forget(jobId);
            result.put("ok", true);
        } catch (Exception failure) {
            result.put("ok", false);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void uninstall(PluginCall call) {
        boolean removed = true;

        // Every job this app knows about, cancelled before its bytes are deleted.
        SharedPreferences preferences = store();
        for (String key : preferences.getAll().keySet()) {
            if (!key.startsWith(KEY_PREFIX)) continue;
            String jobId = preferences.getString(key, null);
            if (jobId == null) continue;
            try {
                downloads().remove(Long.parseLong(jobId.substring(jobId.lastIndexOf(':') + 1)));
            } catch (Exception ignored) {
                /* A job the service has already forgotten needs no cancelling. */
            }
        }

        File directory = new File(getContext().getExternalFilesDir(null), DIRECTORY);
        File[] contents = directory.listFiles();
        if (contents != null) {
            for (File file : contents) if (!file.delete()) removed = false;
        }
        if (directory.exists() && !directory.delete()) removed = directory.listFiles() == null;

        /*
         * The job registry goes too, and ONLY the job registry. "Remove OCADE
         * Intelligence" and "delete my account" are different requests, so
         * conversations, preferences and every other store this app keeps are
         * left exactly as they were.
         */
        preferences.edit().clear().apply();

        JSObject result = new JSObject();
        result.put("ok", removed);
        call.resolve(result);
    }

    /**
     * Move to the next source in the website's ladder.
     *
     * Returns false once the ladder is exhausted, which is the honest end of a
     * handoff rather than a silent stall.
     */
    private boolean advanceToNextSource(String jobId, String version) {
        SharedPreferences preferences = store();
        String[] ladder = preferences.getString(jobId + ".sources", "").split("\n");
        int next = preferences.getInt(jobId + ".source", 0) + 1;
        if (next >= ladder.length || ladder[next].isEmpty()) return false;
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(ladder[next]));
            request.setDestinationUri(Uri.fromFile(artifactFile(version)));
            request.setTitle("Preparing OCADE");
            request.setDescription("OCADE Intelligence");
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(false);
            long id = downloads().enqueue(request);
            String replacement = version + ":" + id;
            preferences
                .edit()
                .putString(KEY_PREFIX + version, replacement)
                .putString(replacement + ".version", version)
                .putString(replacement + ".sha256", preferences.getString(jobId + ".sha256", ""))
                .putString(replacement + ".sources", joined(ladder))
                .putInt(replacement + ".source", next)
                .apply();
            forget(jobId);
            return true;
        } catch (Exception failure) {
            return false;
        }
    }

    /*
     * Written by hand rather than with String.join, which arrived in API 26.
     * This module's minSdkVersion is 24, so the library method would compile
     * and then throw NoSuchMethodError on exactly the oldest devices — the ones
     * least able to spare a failed download.
     */
    private static String joined(String[] parts) {
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < parts.length; i += 1) {
            if (i > 0) out.append('\n');
            out.append(parts[i]);
        }
        return out.toString();
    }

    private static String joined(List<String> parts) {
        return joined(parts.toArray(new String[0]));
    }

    private void forget(String jobId) {
        SharedPreferences preferences = store();
        String version = preferences.getString(jobId + ".version", null);
        SharedPreferences.Editor editor = preferences.edit();
        if (version != null) editor.remove(KEY_PREFIX + version);
        editor
            .remove(jobId + ".version")
            .remove(jobId + ".sha256")
            .remove(jobId + ".sources")
            .remove(jobId + ".source")
            .apply();
    }

    private JSObject phase(String name, String version, long received, Long total) {
        JSObject result = new JSObject();
        result.put("phase", name);
        result.put("version", version);
        result.put("receivedBytes", received);
        result.put("totalBytes", total == null ? null : total);
        return result;
    }

    /** A URL the WebView can actually read the finished artifact from. */
    private String localUrl(File file) {
        return getBridge().getLocalUrl() + "/_capacitor_file_" + file.getAbsolutePath();
    }

    /** SHA-256 of the finished artifact, streamed so a gigabyte never sits in memory. */
    private String digestOf(File file) {
        try (InputStream input = new FileInputStream(file)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[1 << 16];
            int read;
            while ((read = input.read(buffer)) > 0) digest.update(buffer, 0, read);
            StringBuilder hex = new StringBuilder();
            for (byte b : digest.digest()) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception failure) {
            // No digest is reported rather than a wrong one: the website treats
            // a missing digest as "not verified" and keeps the work.
            return null;
        }
    }
}
