package com.lzlab.portal.plugins;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.alibaba.sdk.android.oss.ClientException;
import com.alibaba.sdk.android.oss.OSS;
import com.alibaba.sdk.android.oss.OSSClient;
import com.alibaba.sdk.android.oss.ServiceException;
import com.alibaba.sdk.android.oss.common.auth.OSSPlainTextAKSKCredentialProvider;
import com.alibaba.sdk.android.oss.model.GetObjectRequest;
import com.alibaba.sdk.android.oss.model.GetObjectResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.*;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@CapacitorPlugin(name = "LZPortalSync")
public class LZPortalSyncPlugin extends Plugin {

    private static final String TAG = "LZPortalSync";
    private static final String PREFS_NAME = "kbbook_prefs";
    private static final String KEY_MODE = "app_mode";
    private static final String KEY_NETWORK_URL = "network_url";
    private static final String KEY_LAST_SYNC = "last_sync_time";
    private static final String KEY_SYNC_VERSION = "sync_version";
    private static final String KEY_SYNC_FILE_COUNT = "sync_file_count";
    private static final String DEFAULT_MODE = "local";

    // OSS config — set your own values or use environment/asset config
    private static final String OSS_ENDPOINT = "https://oss-cn-shenzhen.aliyuncs.com";
    private static final String OSS_BUCKET = "";
    private static final String OSS_PREFIX = "";
    private static final String OSS_ACCESS_KEY_ID = "";
    private static final String OSS_ACCESS_KEY_SECRET = "";

    private static final int SYNC_THREADS = 5;

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    // === progress ===

    private void emitProgress(String stage, int percent, String detail) {
        JSObject data = new JSObject();
        data.put("stage", stage);
        data.put("percent", percent);
        data.put("detail", detail);
        notifyListeners("syncProgress", data);
    }

    // === Plugin methods ===

    @PluginMethod
    public void readLocalDoc(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) { call.reject("path required"); return; }
        // docs.ts passes path without .md extension, stored files have .md
        String filePath = path.endsWith(".md") ? path : path + ".md";
        try {
            String content = readDocFromStorage(filePath);
            if (content != null) {
                JSObject r = new JSObject(); r.put("content", content); r.put("source", "synced");
                call.resolve(r); return;
            }
            content = readDocFromAssets(filePath);
            if (content != null) {
                JSObject r = new JSObject(); r.put("content", content); r.put("source", "assets");
                call.resolve(r); return;
            }
            call.reject("Doc not found: " + filePath);
        } catch (Exception e) { Log.e(TAG, "readLocalDoc", e); call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void syncFromOSS(PluginCall call) {
        getBridge().executeOnMainThread(() -> new Thread(() -> {
            try {
                SyncResult r = doSync();
                getBridge().executeOnMainThread(() -> {
                    JSObject res = new JSObject();
                    res.put("fileCount", r.fileCount);
                    res.put("totalSize", r.totalSize);
                    res.put("version", r.version);
                    res.put("skipped", r.skipped);
                    res.put("added", r.added);
                    res.put("updated", r.updated);
                    res.put("deleted", r.deleted);
                    call.resolve(res);
                });
            } catch (Exception e) {
                Log.e(TAG, "Sync failed", e);
                getBridge().executeOnMainThread(() -> call.reject(e.getMessage()));
            }
        }).start());
    }

    @PluginMethod
    public void getSyncStatus(PluginCall call) {
        SharedPreferences p = getPrefs();
        JSObject r = new JSObject();
        r.put("lastSyncTime", p.getString(KEY_LAST_SYNC, null));
        r.put("syncVersion", p.getString(KEY_SYNC_VERSION, null));
        r.put("fileCount", p.getInt(KEY_SYNC_FILE_COUNT, 0));
        r.put("docsAvailable", isSyncedDocsAvailable());
        call.resolve(r);
    }

    @PluginMethod public void getMode(PluginCall call) {
        JSObject r = new JSObject(); r.put("mode", getPrefs().getString(KEY_MODE, DEFAULT_MODE)); call.resolve(r);
    }
    @PluginMethod public void setMode(PluginCall call) {
        getPrefs().edit().putString(KEY_MODE, call.getString("mode", DEFAULT_MODE)).apply(); call.resolve();
    }
    @PluginMethod public void getNetworkUrl(PluginCall call) {
        JSObject r = new JSObject(); r.put("url", getPrefs().getString(KEY_NETWORK_URL, "http://localhost:3004")); call.resolve(r);
    }
    @PluginMethod public void setNetworkUrl(PluginCall call) {
        getPrefs().edit().putString(KEY_NETWORK_URL, call.getString("url", "http://localhost:3004")).apply(); call.resolve();
    }

    // === Web OTA ===

    @PluginMethod
    public void checkWebUpdate(PluginCall call) {
        getBridge().executeOnMainThread(() -> new Thread(() -> {
            try {
                JSObject result = doWebUpdate();
                getBridge().executeOnMainThread(() -> call.resolve(result));
            } catch (Exception e) {
                Log.e(TAG, "Web update failed", e);
                getBridge().executeOnMainThread(() -> call.reject(e.getMessage()));
            }
        }).start());
    }

    @PluginMethod
    public void getWebVersion(PluginCall call) {
        JSObject r = new JSObject();
        r.put("version", getPrefs().getString("web_version", "0"));
        call.resolve(r);
    }

    private JSObject doWebUpdate() throws Exception {
        JSObject result = new JSObject();

        // 1. Download remote version
        String remoteVersion = null;
        try {
            remoteVersion = downloadVersionJson("webapp-version.json");
        } catch (Exception e) {
            Log.w(TAG, "No webapp version on OSS", e);
        }

        if (remoteVersion == null) {
            result.put("updateAvailable", false);
            result.put("reason", "No remote version");
            return result;
        }

        // 2. Compare with local
        String localVersion = getPrefs().getString("web_version", "0");
        if (remoteVersion.equals(localVersion)) {
            result.put("updateAvailable", false);
            result.put("reason", "Already latest");
            result.put("version", localVersion);
            return result;
        }

        // 3. Download webapp.zip
        emitProgress("download", 0, "Downloading web update...");
        File zipFile = new File(getContext().getCacheDir(), "webapp.zip");
        downloadWithProgress(OSS_PREFIX + "/latest/webapp.zip", zipFile);

        // 4. Extract to ota-webapp dir
        emitProgress("extract", 80, "Extracting...");
        File otaDir = new File(getContext().getFilesDir(), "ota-webapp");
        if (otaDir.exists()) deleteRecursive(otaDir);
        otaDir.mkdirs();
        int count = extractZip(zipFile, otaDir);
        zipFile.delete();

        // 5. Save version + set flag for next launch
        getPrefs().edit()
            .putString("web_version", remoteVersion)
            .putString("ota_path", otaDir.getAbsolutePath())
            .apply();

        emitProgress("done", 100, "Update ready: " + count + " files");
        result.put("updateAvailable", true);
        result.put("version", remoteVersion);
        result.put("fileCount", count);
        return result;
    }

    private String downloadVersionJson(String objectKey) {
        OSSPlainTextAKSKCredentialProvider cp =
            new OSSPlainTextAKSKCredentialProvider(OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET);
        OSS oss = new OSSClient(getContext(), OSS_ENDPOINT, cp);
        try {
            GetObjectRequest req = new GetObjectRequest(OSS_BUCKET, OSS_PREFIX + "/latest/" + objectKey);
            GetObjectResult res = oss.getObject(req);
            return readStreamToString(res.getObjectContent()).trim();
        } catch (Exception e) {
            Log.w(TAG, "Failed to get " + objectKey, e);
            return null;
        }
    }

    // === internal: doc reading ===

    private String readDocFromStorage(String path) {
        File f = new File(new File(getContext().getFilesDir(), "synced-docs"), path);
        if (f.exists()) { try { return readFileToString(f); } catch (IOException e) { Log.w(TAG, "read synced", e); } }
        return null;
    }

    private String readDocFromAssets(String path) {
        try (InputStream is = getContext().getAssets().open("public/docs/" + path)) {
            return readStreamToString(is);
        } catch (IOException e) { return null; }
    }

    private boolean isSyncedDocsAvailable() {
        File d = new File(getContext().getFilesDir(), "synced-docs");
        return d.exists() && d.isDirectory() && d.list() != null && d.list().length > 0;
    }

    // === sync engine ===

    static class SyncResult {
        int fileCount; long totalSize; String version; boolean skipped;
        int added, updated, deleted;
    }

    static class Manifest {
        String version;
        int fileCount;
        Map<String, String> files = new HashMap<>(); // path → md5
    }

    private SyncResult doSync() throws Exception {
        SyncResult result = new SyncResult();

        // 1. Download remote manifest
        emitProgress("check", 0, "Downloading manifest...");
        OSS oss = newOSSClient();
        Manifest remoteManifest;
        try {
            remoteManifest = downloadManifest(oss);
        } catch (Exception e) {
            Log.w(TAG, "Manifest download failed, trying full zip fallback", e);
            return doFullZipSync();
        }

        // 2. Load local manifest
        Manifest localManifest = loadLocalManifest();

        // 3. If no local manifest → first sync, use zip for speed
        if (localManifest == null || localManifest.files.isEmpty()) {
            Log.i(TAG, "First sync — using full zip");
            return doFullZipSync();
        }

        // 4. Diff
        emitProgress("diff", 10, "Comparing files...");
        List<String> added = new ArrayList<>();
        List<String> updated = new ArrayList<>();
        List<String> deleted = new ArrayList<>();

        for (Map.Entry<String, String> e : remoteManifest.files.entrySet()) {
            String path = e.getKey().startsWith("/") ? e.getKey().substring(1) : e.getKey();
            String remoteMD5 = e.getValue();
            String localMD5 = localManifest.files.get(path);
            if (localMD5 == null) {
                added.add(path);
            } else if (!remoteMD5.equals(localMD5)) {
                updated.add(path);
            }
        }
        for (String path : localManifest.files.keySet()) {
            if (!remoteManifest.files.containsKey(path)) {
                deleted.add(path);
            }
        }

        int totalChanges = added.size() + updated.size() + deleted.size();
        if (totalChanges == 0) {
            emitProgress("done", 100, "Already up to date (" + remoteManifest.fileCount + " files)");
            result.skipped = true;
            result.version = remoteManifest.version;
            result.fileCount = remoteManifest.fileCount;
            return result;
        }

        // 5. If >200 files changed, use zip for speed
        if (added.size() + updated.size() > 200) {
            Log.i(TAG, "Many changes (" + (added.size() + updated.size()) + "), using full zip");
            return doFullZipSync();
        }

        Log.i(TAG, "Incremental sync: +" + added.size() + " ~" + updated.size() + " -" + deleted.size());

        // 6. Delete removed files
        if (!deleted.isEmpty()) {
            emitProgress("delete", 15, "Removing " + deleted.size() + " files...");
            File syncedDir = new File(getContext().getFilesDir(), "synced-docs");
            for (String path : deleted) {
                new File(syncedDir, path).delete();
                // Clean up empty parent dirs
            }
        }

        // 7. Download new/changed files concurrently
        int toDownload = added.size() + updated.size();
        List<String> toDownloadList = new ArrayList<>();
        toDownloadList.addAll(added);
        toDownloadList.addAll(updated);

        emitProgress("download", 20, "Downloading " + toDownload + " files...");

        ExecutorService pool = Executors.newFixedThreadPool(SYNC_THREADS);
        List<Future<Long>> futures = new ArrayList<>();
        AtomicInteger downloaded = new AtomicInteger(0);
        File syncedDir = new File(getContext().getFilesDir(), "synced-docs");

        for (String path : toDownloadList) {
            futures.add(pool.submit(() -> {
                String p = path.startsWith("/") ? path.substring(1) : path;
                String ossKey = OSS_PREFIX + "/files/docs/" + p;
                File destFile = new File(syncedDir, p);
                destFile.getParentFile().mkdirs();
                downloadSingleFile(oss, ossKey, destFile);
                int done = downloaded.incrementAndGet();
                int pct = 20 + (done * 70 / toDownload);
                if (done % 5 == 0 || done == toDownload) {
                    emitProgress("download", pct, done + " / " + toDownload);
                }
                return destFile.length();
            }));
        }

        long totalSize = 0;
        for (Future<Long> f : futures) {
            try { totalSize += f.get(); } catch (Exception e) { Log.w(TAG, "Download failed", e); }
        }
        pool.shutdown();

        // 8. Save manifest
        emitProgress("save", 95, "Saving...");
        saveLocalManifest(remoteManifest);

        // 9. Save prefs
        String ts = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date());
        SharedPreferences p = getPrefs();
        p.edit().putString(KEY_LAST_SYNC, ts).putString(KEY_SYNC_VERSION, remoteManifest.version)
            .putInt(KEY_SYNC_FILE_COUNT, remoteManifest.fileCount).apply();

        result.skipped = false;
        result.version = remoteManifest.version;
        result.fileCount = remoteManifest.fileCount;
        result.totalSize = totalSize;
        result.added = added.size();
        result.updated = updated.size();
        result.deleted = deleted.size();

        emitProgress("done", 100, "+" + added.size() + " ~" + updated.size() + " -" + deleted.size());
        Log.i(TAG, "Incremental sync done: +" + added.size() + " ~" + updated.size() + " -" + deleted.size());
        return result;
    }

    // === Full zip sync (first sync / large changes fallback) ===

    private SyncResult doFullZipSync() throws Exception {
        SyncResult result = new SyncResult();
        emitProgress("download", 0, "Downloading full docs...");

        File zipFile = new File(getContext().getCacheDir(), "docs.zip");
        downloadWithProgress(OSS_PREFIX + "/latest/docs.zip", zipFile);

        emitProgress("extract", 90, "Extracting...");
        File syncedDir = new File(getContext().getFilesDir(), "synced-docs");
        if (syncedDir.exists()) deleteRecursive(syncedDir);
        syncedDir.mkdirs();
        int count = extractZip(zipFile, syncedDir);
        zipFile.delete();

        // Load remote manifest to save
        Manifest manifest = null;
        try { manifest = downloadManifest(newOSSClient()); } catch (Exception e) { Log.w(TAG, "No manifest after zip", e); }

        if (manifest != null) saveLocalManifest(manifest);

        String ts = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date());
        String version = manifest != null ? manifest.version : ts;
        getPrefs().edit().putString(KEY_LAST_SYNC, ts).putString(KEY_SYNC_VERSION, version)
            .putInt(KEY_SYNC_FILE_COUNT, count).apply();

        result.fileCount = count;
        result.totalSize = zipFile.length();
        result.version = version;
        result.skipped = false;
        result.added = count;
        result.updated = 0;
        result.deleted = 0;

        emitProgress("done", 100, count + " files synced");
        return result;
    }

    // === OSS helpers ===

    private OSS newOSSClient() {
        return new OSSClient(getContext(), OSS_ENDPOINT,
            new OSSPlainTextAKSKCredentialProvider(OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET));
    }

    private Manifest downloadManifest(OSS oss) throws ClientException, ServiceException, IOException, JSONException {
        GetObjectRequest req = new GetObjectRequest(OSS_BUCKET, OSS_PREFIX + "/manifest.json");
        GetObjectResult res = oss.getObject(req);
        String json = readStreamToString(res.getObjectContent());

        Manifest m = new Manifest();
        JSONObject root = new JSONObject(json);
        m.version = root.optString("version", "");
        m.fileCount = root.optInt("fileCount", 0);
        JSONObject files = root.optJSONObject("files");
        if (files != null) {
            for (Iterator<String> it = files.keys(); it.hasNext(); ) {
                String key = it.next();
                m.files.put(key, files.getString(key));
            }
        }
        return m;
    }

    private File getManifestFile() {
        return new File(getContext().getFilesDir(), "synced-manifest.json");
    }

    private Manifest loadLocalManifest() {
        File f = getManifestFile();
        if (!f.exists()) return null;
        try {
            String json = readFileToString(f);
            JSONObject root = new JSONObject(json);
            Manifest m = new Manifest();
            m.version = root.optString("version", "");
            m.fileCount = root.optInt("fileCount", 0);
            JSONObject files = root.optJSONObject("files");
            if (files != null) {
                for (Iterator<String> it = files.keys(); it.hasNext(); ) {
                    String key = it.next();
                    m.files.put(key, files.getString(key));
                }
            }
            return m;
        } catch (Exception e) {
            Log.w(TAG, "Failed to load local manifest", e);
            return null;
        }
    }

    private void saveLocalManifest(Manifest m) {
        try {
            JSONObject root = new JSONObject();
            root.put("version", m.version);
            root.put("fileCount", m.fileCount);
            JSONObject files = new JSONObject();
            for (Map.Entry<String, String> e : m.files.entrySet()) {
                files.put(e.getKey(), e.getValue());
            }
            root.put("files", files);

            try (FileWriter fw = new FileWriter(getManifestFile())) {
                fw.write(root.toString());
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to save local manifest", e);
        }
    }

    private void downloadSingleFile(OSS oss, String ossKey, File destFile) throws ClientException, ServiceException, IOException {
        GetObjectRequest req = new GetObjectRequest(OSS_BUCKET, ossKey);
        GetObjectResult res = oss.getObject(req);
        try (InputStream is = res.getObjectContent();
             FileOutputStream fos = new FileOutputStream(destFile)) {
            byte[] buf = new byte[8192];
            int len;
            while ((len = is.read(buf)) > 0) fos.write(buf, 0, len);
        }
    }

    private void downloadWithProgress(String ossKey, File destFile) throws ClientException, ServiceException, IOException {
        OSS oss = newOSSClient();
        // Get size
        long total = -1;
        try {
            total = oss.headObject(new com.alibaba.sdk.android.oss.model.HeadObjectRequest(OSS_BUCKET, ossKey))
                .getMetadata().getContentLength();
        } catch (Exception ignored) {}

        GetObjectRequest req = new GetObjectRequest(OSS_BUCKET, ossKey);
        GetObjectResult res = oss.getObject(req);
        try (InputStream is = res.getObjectContent();
             FileOutputStream fos = new FileOutputStream(destFile)) {
            byte[] buf = new byte[65536];
            int len; long dl = 0; int lastPct = 0;
            while ((len = is.read(buf)) > 0) {
                fos.write(buf, 0, len);
                dl += len;
                if (total > 0) {
                    int pct = (int)(dl * 100 / total);
                    if (pct > lastPct && pct % 10 == 0) {
                        lastPct = pct;
                        emitProgress("download", pct, formatSize(dl) + " / " + formatSize(total));
                    }
                }
            }
        }
    }

    // === zip utils ===

    private int extractZip(File zipFile, File destDir) throws IOException {
        int count = 0;
        try (ZipInputStream zis = new ZipInputStream(new FileInputStream(zipFile))) {
            ZipEntry entry; byte[] buf = new byte[65536];
            while ((entry = zis.getNextEntry()) != null) {
                if (entry.isDirectory()) continue;
                File out = new File(destDir, entry.getName());
                out.getParentFile().mkdirs();
                try (FileOutputStream fos = new FileOutputStream(out)) {
                    int len; while ((len = zis.read(buf)) > 0) fos.write(buf, 0, len);
                }
                zis.closeEntry(); count++;
            }
        }
        return count;
    }

    // === io ===

    private static String readFileToString(File f) throws IOException {
        return readStreamToString(new FileInputStream(f));
    }

    private static String readStreamToString(InputStream is) throws IOException {
        try (BufferedReader r = new BufferedReader(new InputStreamReader(is, "UTF-8"))) {
            StringBuilder sb = new StringBuilder(); String line;
            while ((line = r.readLine()) != null) sb.append(line).append("\n");
            return sb.toString();
        }
    }

    private static void deleteRecursive(File f) {
        if (f.isDirectory()) { File[] kids = f.listFiles(); if (kids != null) for (File c : kids) deleteRecursive(c); }
        f.delete();
    }

    private static String formatSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024*1024) return String.format(Locale.US, "%.1f KB", bytes/1024.0);
        return String.format(Locale.US, "%.1f MB", bytes/(1024.0*1024.0));
    }
}
