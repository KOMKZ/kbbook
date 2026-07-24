package com.lzlab.portal.plugins;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import java.net.ServerSocket;
import java.net.Socket;
import java.io.IOException;
import java.io.OutputStream;
import java.io.File;
import java.io.FileReader;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.net.URLDecoder;

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

    // OSS config defaults — overridden by SharedPreferences (set via JS saveOssConfig)
    private static final String OSS_ENDPOINT = "https://oss-cn-shenzhen.aliyuncs.com";
    private static final String OSS_BUCKET = "";
    private static final String OSS_PREFIX = "";
    private static final String OSS_ACCESS_KEY_ID = "";
    private static final String OSS_ACCESS_KEY_SECRET = "";
    private static final String PREFS_OSS_BUCKET = "oss_bucket";
    private static final String PREFS_OSS_PREFIX = "oss_prefix";
    private static final String PREFS_OSS_ENDPOINT = "oss_endpoint";
    private static final String PREFS_OSS_KEY_ID = "oss_key_id";
    private static final String PREFS_OSS_KEY_SECRET = "oss_key_secret";

    private String getOssBucket() { return getPrefs().getString(PREFS_OSS_BUCKET, OSS_BUCKET); }
    private String getOssPrefix() { return getPrefs().getString(PREFS_OSS_PREFIX, OSS_PREFIX); }
    private String getOssEndpoint() { return getPrefs().getString(PREFS_OSS_ENDPOINT, OSS_ENDPOINT); }
    private String getOssKeyId() { return getPrefs().getString(PREFS_OSS_KEY_ID, OSS_ACCESS_KEY_ID); }
    private String getOssKeySecret() { return getPrefs().getString(PREFS_OSS_KEY_SECRET, OSS_ACCESS_KEY_SECRET); }

    private static final int SYNC_THREADS = 5;

    // Debug HTTP server — serves files/debug-log.json + app state for adb reverse debugging
    private ServerSocket debugServerSocket;
    private Thread debugServerThread;

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
        // Only append .md if the filename (last path segment) has no extension.
        // Use last path segment to avoid false positives from directory names like "v0.1.0".
        int lastSlash = path.lastIndexOf('/');
        String baseName = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
        String filePath = baseName.contains(".") ? path : path + ".md";
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
    public void saveOssConfig(PluginCall call) {
        SharedPreferences.Editor e = getPrefs().edit();
        if (call.hasOption("endpoint")) e.putString(PREFS_OSS_ENDPOINT, call.getString("endpoint"));
        if (call.hasOption("bucket")) e.putString(PREFS_OSS_BUCKET, call.getString("bucket"));
        if (call.hasOption("path")) e.putString(PREFS_OSS_PREFIX, call.getString("path"));
        if (call.hasOption("accessKeyId")) e.putString(PREFS_OSS_KEY_ID, call.getString("accessKeyId"));
        if (call.hasOption("accessKeySecret")) e.putString(PREFS_OSS_KEY_SECRET, call.getString("accessKeySecret"));
        e.apply();
        Log.i(TAG, "OSS config saved: bucket=" + getOssBucket() + " prefix=" + getOssPrefix());
        call.resolve();
    }

    @PluginMethod
    public void syncFromOSS(PluginCall call) {
        // Save OSS config from JS call params (extract directly — don't delegate to
        // saveOssConfig(call) which would resolve THIS PluginCall prematurely!)
        if (call.hasOption("bucket") && call.getString("bucket") != null && !call.getString("bucket").isEmpty()) {
            SharedPreferences.Editor e = getPrefs().edit();
            if (call.hasOption("endpoint")) e.putString(PREFS_OSS_ENDPOINT, call.getString("endpoint"));
            if (call.hasOption("bucket")) e.putString(PREFS_OSS_BUCKET, call.getString("bucket"));
            if (call.hasOption("path")) e.putString(PREFS_OSS_PREFIX, call.getString("path"));
            if (call.hasOption("accessKeyId")) e.putString(PREFS_OSS_KEY_ID, call.getString("accessKeyId"));
            if (call.hasOption("accessKeySecret")) e.putString(PREFS_OSS_KEY_SECRET, call.getString("accessKeySecret"));
            e.apply();
        }
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

    /**
     * 全量同步：先删除所有本地数据（synced-docs、manifest、sync prefs），再执行全量同步。
     * 相当于"恢复出厂同步设置"——本地不留任何旧文件，全部从 OSS 重新下载。
     */
    @PluginMethod
    public void resetAndSync(PluginCall call) {
        // Save OSS config from JS call params (extract directly — don't delegate to
        // saveOssConfig(call) because that would resolve THIS PluginCall prematurely!)
        if (call.hasOption("bucket") && call.getString("bucket") != null && !call.getString("bucket").isEmpty()) {
            SharedPreferences.Editor e = getPrefs().edit();
            if (call.hasOption("endpoint")) e.putString(PREFS_OSS_ENDPOINT, call.getString("endpoint"));
            if (call.hasOption("bucket")) e.putString(PREFS_OSS_BUCKET, call.getString("bucket"));
            if (call.hasOption("path")) e.putString(PREFS_OSS_PREFIX, call.getString("path"));
            if (call.hasOption("accessKeyId")) e.putString(PREFS_OSS_KEY_ID, call.getString("accessKeyId"));
            if (call.hasOption("accessKeySecret")) e.putString(PREFS_OSS_KEY_SECRET, call.getString("accessKeySecret"));
            e.apply();
        }
        getBridge().executeOnMainThread(() -> new Thread(() -> {
            try {
                emitProgress("reset", 0, "正在清除本地数据...");
                Log.i(TAG, "resetAndSync: wiping all local data");

                // 1. Delete entire synced-docs directory
                File syncedDir = new File(getContext().getFilesDir(), "synced-docs");
                if (syncedDir.exists()) {
                    deleteRecursive(syncedDir);
                    Log.i(TAG, "resetAndSync: deleted synced-docs/");
                }

                // 2. Delete local manifest
                File manifestFile = getManifestFile();
                if (manifestFile.exists()) {
                    manifestFile.delete();
                    Log.i(TAG, "resetAndSync: deleted manifest");
                }

                // 3. Clear sync-related SharedPreferences
                SharedPreferences p = getPrefs();
                p.edit()
                    .remove(KEY_LAST_SYNC)
                    .remove(KEY_SYNC_VERSION)
                    .remove(KEY_SYNC_FILE_COUNT)
                    .apply();
                Log.i(TAG, "resetAndSync: cleared sync prefs");

                emitProgress("reset", 5, "本地数据已清除，开始全量同步...");

                // 4. Run fresh sync (no local manifest → full download)
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
                Log.e(TAG, "Reset+Sync failed", e);
                getBridge().executeOnMainThread(() -> call.reject(e.getMessage()));
            }
        }).start());
    }

    /**
     * 仅清除本地数据（不触发同步）。
     * 删除 synced-docs/、manifest、sync prefs。清除后本地回到"从未同步过"的状态。
     */
    @PluginMethod
    public void clearLocalData(PluginCall call) {
        getBridge().executeOnMainThread(() -> new Thread(() -> {
            try {
                emitProgress("reset", 0, "正在清除本地数据...");
                Log.i(TAG, "clearLocalData: wiping all local data");

                File syncedDir = new File(getContext().getFilesDir(), "synced-docs");
                if (syncedDir.exists()) {
                    deleteRecursive(syncedDir);
                    Log.i(TAG, "clearLocalData: deleted synced-docs/");
                }

                File manifestFile = getManifestFile();
                if (manifestFile.exists()) {
                    manifestFile.delete();
                    Log.i(TAG, "clearLocalData: deleted manifest");
                }

                SharedPreferences p = getPrefs();
                p.edit()
                    .remove(KEY_LAST_SYNC)
                    .remove(KEY_SYNC_VERSION)
                    .remove(KEY_SYNC_FILE_COUNT)
                    .apply();
                Log.i(TAG, "clearLocalData: cleared sync prefs");

                emitProgress("done", 100, "本地数据已全部清除");

                getBridge().executeOnMainThread(() -> {
                    JSObject res = new JSObject();
                    res.put("success", true);
                    call.resolve(res);
                });
            } catch (Exception e) {
                Log.e(TAG, "clearLocalData failed", e);
                getBridge().executeOnMainThread(() -> call.reject(e.getMessage()));
            }
        }).start());
    }

    /** Download kbdata/latest.json via native OSS SDK (bypasses WebView CORS). */
    @PluginMethod
    public void pullKbdata(PluginCall call) {
        getBridge().executeOnMainThread(() -> new Thread(() -> {
            try {
                String bucket = getOssBucket();
                String prefix = getOssPrefix();
                String key = prefix + "/kbdata/latest.json";
                if (bucket.isEmpty()) { call.reject("OSS bucket not configured"); return; }

                OSSPlainTextAKSKCredentialProvider cp =
                    new OSSPlainTextAKSKCredentialProvider(getOssKeyId(), getOssKeySecret());
                OSS oss = new OSSClient(getContext(), getOssEndpoint(), cp);
                GetObjectRequest req = new GetObjectRequest(bucket, key);
                GetObjectResult res = oss.getObject(req);

                // Read stream to string
                java.io.InputStream is = res.getObjectContent();
                java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n;
                while ((n = is.read(buf)) != -1) baos.write(buf, 0, n);
                is.close();
                String json = baos.toString("UTF-8");

                JSObject r = new JSObject();
                r.put("success", true);
                r.put("key", key);
                r.put("sizeBytes", json.length());
                r.put("json", json);
                Log.i(TAG, "pullKbdata OK: " + json.length() + " bytes from " + key);
                call.resolve(r);
            } catch (Exception e) {
                Log.e(TAG, "pullKbdata failed", e);
                call.reject(e.getMessage());
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
        JSObject r = new JSObject(); r.put("url", getPrefs().getString(KEY_NETWORK_URL, "http://192.168.3.213:3004")); call.resolve(r);
    }
    @PluginMethod public void setNetworkUrl(PluginCall call) {
        getPrefs().edit().putString(KEY_NETWORK_URL, call.getString("url", "http://192.168.3.213:3004")).apply(); call.resolve();
    }

    // === Debug log file (adb: run-as com.lzlab.portal cat files/debug-log.json) ===

    @PluginMethod
    public void writeDebugLog(PluginCall call) {
        try {
            String json = call.getString("json");
            if (json == null || json.isEmpty()) { call.resolve(); return; }
            java.io.File file = new java.io.File(getContext().getFilesDir(), "debug-log.json");
            java.io.FileWriter fw = new java.io.FileWriter(file);
            fw.write(json);
            fw.close();
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void readDebugLog(PluginCall call) {
        try {
            java.io.File file = new java.io.File(getContext().getFilesDir(), "debug-log.json");
            if (!file.exists()) { JSObject r = new JSObject(); r.put("json", "[]"); call.resolve(r); return; }
            java.io.BufferedReader br = new java.io.BufferedReader(new java.io.FileReader(file));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
            br.close();
            JSObject r = new JSObject(); r.put("json", sb.toString()); call.resolve(r);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
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
        downloadWithProgress(getOssPrefix() + "/latest/webapp.zip", zipFile);

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
            new OSSPlainTextAKSKCredentialProvider(getOssKeyId(), getOssKeySecret());
        OSS oss = new OSSClient(getContext(), getOssEndpoint(), cp);
        try {
            GetObjectRequest req = new GetObjectRequest(getOssBucket(), getOssPrefix() + "/latest/" + objectKey);
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
        //    首次同步(无本地 manifest)不再走 full-zip:latest/webapp.zip 是网页壳、不是文档,
        //    latest/docs.zip 又长期不再生成而过期。把缺失的本地 manifest 当作空,让下面的 diff
        //    将远端全部文件识别为 added,统一走 files/docs/ 增量下载(远端唯一保持新鲜的内容源)。
        Manifest localManifest = loadLocalManifest();
        if (localManifest == null) {
            localManifest = new Manifest();
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

        // 5. 一律走 files/docs/ 逐文件增量下载(含首次全量),不再因变更多而回退到 zip
        //    —— zip 分支(doFullZipSync)已废弃。首次约 989 个文件,SYNC_THREADS 并发,数分钟完成。
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
        List<Future<String>> futures = new ArrayList<>();
        AtomicInteger downloaded = new AtomicInteger(0);
        File syncedDir = new File(getContext().getFilesDir(), "synced-docs");

        for (String path : toDownloadList) {
            futures.add(pool.submit(() -> {
                String p = path.startsWith("/") ? path.substring(1) : path;
                String ossKey = getOssPrefix() + "/files/docs/" + p;
                File destFile = new File(syncedDir, p);
                destFile.getParentFile().mkdirs();
                downloadSingleFile(oss, ossKey, destFile);
                int done = downloaded.incrementAndGet();
                int pct = 20 + (done * 70 / toDownload);
                if (done % 5 == 0 || done == toDownload) {
                    emitProgress("download", pct, done + " / " + toDownload);
                }
                return p; // 成功:返回已落盘的规范化路径
            }));
        }

        // 收集本次“确实下载成功”的文件;失败的不计入,不会写进 manifest。
        Map<String, String> okFiles = new HashMap<>(); // path -> remoteMD5
        long totalSize = 0;
        for (Future<String> f : futures) {
            try {
                String okPath = f.get();
                if (okPath == null) continue;
                String md5 = remoteManifest.files.get(okPath);
                if (md5 == null) md5 = remoteManifest.files.get("/" + okPath);
                okFiles.put(okPath, md5 != null ? md5 : "");
                totalSize += new File(syncedDir, okPath).length();
            } catch (Exception e) {
                Log.w(TAG, "Download failed", e);
            }
        }
        pool.shutdown();

        // 8. Save manifest —— 只记录“确实落盘”的文件:未改动的旧文件 + 本次成功下载的文件。
        //    失败/被中断的文件不写入,下次同步会把它们当作缺失重新下载,
        //    杜绝“残缺 manifest 谎报已最新、缺文件永远补不上”的复发坑。
        emitProgress("save", 95, "Saving...");
        Manifest toSave = new Manifest();
        for (Map.Entry<String, String> le : localManifest.files.entrySet()) {
            String path = le.getKey();
            if (!deleted.contains(path) && !toDownloadList.contains(path)) {
                toSave.files.put(path, le.getValue()); // 未改动,仍在盘上
            }
        }
        toSave.files.putAll(okFiles); // 本次新下成功的
        toSave.fileCount = toSave.files.size();
        toSave.version = String.valueOf(toSave.files.size());
        saveLocalManifest(toSave);

        // 9. Save prefs
        String ts = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date());
        SharedPreferences p = getPrefs();
        p.edit().putString(KEY_LAST_SYNC, ts).putString(KEY_SYNC_VERSION, toSave.version)
            .putInt(KEY_SYNC_FILE_COUNT, toSave.files.size()).apply();

        result.skipped = false;
        result.version = toSave.version;
        result.fileCount = toSave.files.size();
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

        File zipFile = new File(getContext().getCacheDir(), "webapp.zip");
        downloadWithProgress(getOssPrefix() + "/latest/webapp.zip", zipFile);

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
        return new OSSClient(getContext(), getOssEndpoint(),
            new OSSPlainTextAKSKCredentialProvider(getOssKeyId(), getOssKeySecret()));
    }

    private Manifest downloadManifest(OSS oss) throws ClientException, ServiceException, IOException, JSONException {
        GetObjectRequest req = new GetObjectRequest(getOssBucket(), getOssPrefix() + "/manifest.json");
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
        // 上传端 manifest.json 只写 {files:{...}},没有 fileCount/version 字段;
        // 用实际文件数兜底,否则同步成功后仍会回报 "0 files" / 空版本,让人误以为没生效。
        if (m.fileCount == 0) m.fileCount = m.files.size();
        if (m.version == null || m.version.isEmpty()) m.version = String.valueOf(m.files.size());
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
        GetObjectRequest req = new GetObjectRequest(getOssBucket(), ossKey);
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
            total = oss.headObject(new com.alibaba.sdk.android.oss.model.HeadObjectRequest(getOssBucket(), ossKey))
                .getMetadata().getContentLength();
        } catch (Exception ignored) {}

        GetObjectRequest req = new GetObjectRequest(getOssBucket(), ossKey);
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

    // === Debug HTTP Server (adb reverse → curl localhost:{port}/debug) ===

    @PluginMethod
    public void startDebugServer(PluginCall call) {
        int port = call.getInt("port", 9123);
        if (debugServerSocket != null) {
            JSObject r = new JSObject(); r.put("port", port); r.put("status", "already-running"); call.resolve(r); return;
        }
        final SharedPreferences prefs = getPrefs();
        final File debugFile = new File(getContext().getFilesDir(), "debug-log.json");

        debugServerThread = new Thread(() -> {
            try {
                debugServerSocket = new ServerSocket(port);
                Log.i(TAG, "Debug server listening on port " + port);
                while (!Thread.currentThread().isInterrupted()) {
                    Socket client = debugServerSocket.accept();
                    try {
                        BufferedReader in = new BufferedReader(new InputStreamReader(client.getInputStream()));
                        String line = in.readLine();
                        boolean isPost = false;
                        String path = "/"; String postBody = "";
                        int contentLength = 0;
                        boolean isPostReq = false;
                        if (line != null) {
                            String[] parts = line.split(" ");
                            if (parts.length >= 2) { path = parts[1]; isPostReq = "POST".equals(parts[0]); }
                        }
                        while (line != null && !line.isEmpty()) {
                            if (line.startsWith("Content-Length:"))
                                try { contentLength = Integer.parseInt(line.substring(15).trim()); } catch (Exception ignored) {}
                            line = in.readLine();
                        }
                        if (isPostReq && contentLength > 0) {
                            char[] buf = new char[contentLength];
                            in.read(buf, 0, contentLength);
                            postBody = new String(buf);
                        }

                        String body = "{}"; String contentType = "application/json; charset=utf-8";
                        if ("/state".equals(path)) {
                            body = "{\"mode\":\"" + prefs.getString(KEY_MODE, DEFAULT_MODE) +
                                "\",\"url\":\"" + prefs.getString(KEY_NETWORK_URL, "") +
                                "\",\"lastSync\":\"" + prefs.getString(KEY_LAST_SYNC, "") + "\"}";
                        } else if ("/ping".equals(path)) {
                            body = "{\"ok\":true}";
                        } else if (path.startsWith("/rpc/")) {
                            body = handleRpc(path, postBody);
                        } else {
                            // /debug or any other path → serve debug log file
                            if (debugFile.exists()) {
                                BufferedReader fr = new BufferedReader(new FileReader(debugFile));
                                StringBuilder sb = new StringBuilder(); String l;
                                while ((l = fr.readLine()) != null) sb.append(l);
                                fr.close(); body = sb.toString();
                            } else {
                                body = "[]";
                            }
                        }

                        byte[] resp = body.getBytes("UTF-8");
                        String header = "HTTP/1.1 200 OK\r\nContent-Type: " + contentType +
                            "\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: " + resp.length + "\r\n\r\n";
                        OutputStream os = client.getOutputStream();
                        os.write(header.getBytes("UTF-8")); os.write(resp); os.flush();
                    } catch (Exception e) { Log.w(TAG, "Debug request error: " + e.getMessage()); }
                    finally { try { client.close(); } catch (Exception ignored) {} }
                }
            } catch (IOException e) {
                if (!Thread.currentThread().isInterrupted())
                    Log.e(TAG, "Debug server error: " + e.getMessage());
            }
        });
        debugServerThread.setDaemon(true);
        debugServerThread.start();
        JSObject r = new JSObject(); r.put("port", port); r.put("status", "started"); call.resolve(r);
    }

    @PluginMethod
    public void stopDebugServer(PluginCall call) {
        if (debugServerThread != null) { debugServerThread.interrupt(); debugServerThread = null; }
        if (debugServerSocket != null) { try { debugServerSocket.close(); } catch (Exception ignored) {} debugServerSocket = null; }
        Log.i(TAG, "Debug server stopped");
        call.resolve();
    }

    // === RPC handler (curl -X POST .../rpc/eval -d 'code') ===

    private String handleRpc(String path, String postBody) {
        try {
            String query = "";
            int qi = path.indexOf('?');
            if (qi > 0) { query = path.substring(qi + 1); path = path.substring(0, qi); }

            // Get code from query param or POST body
            final String code;
            if (query.startsWith("code=")) {
                String raw = query.substring(5).replace("+", "%2B");
                code = URLDecoder.decode(raw, "UTF-8");
            } else {
                code = postBody;
            }

            if ("/rpc/ping".equals(path)) {
                return "{\"rpc\":true}";
            }

            if ("/rpc/reload".equals(path)) {
                getBridge().executeOnMainThread(() -> getBridge().getWebView().reload());
                return "{\"reload\":true}";
            }

            if ("/rpc/eval".equals(path)) {
                if (code.isEmpty()) return "{\"error\":\"missing code\"}";

                // Execute code and store result in window._kbbook_rpc.
                // We use a global variable + polling because evaluateJavascript
                // does NOT await Promises on this WebView (returns {} for them).
                String encoded;
                try { encoded = java.net.URLEncoder.encode(code, "UTF-8"); }
                catch (Exception ue) { encoded = code; }

                String wrapped =
                    "try{" +
                    "  var __r=eval(decodeURIComponent('" + encoded + "'));" +
                    "  if(__r&&typeof __r.then==='function'){" +
                    "    __r.then(function(v){window._kbbook_rpc=JSON.stringify(v);})" +
                    "       .catch(function(e){window._kbbook_rpc=JSON.stringify({_rpc_error:e&&e.message||String(e)});});" +
                    "  }else{" +
                    "    window._kbbook_rpc=JSON.stringify(__r);" +
                    "  }" +
                    "}catch(e){" +
                    "  window._kbbook_rpc=JSON.stringify({_rpc_error:e&&e.message||String(e)});" +
                    "}";

                // Execute the wrapped code (fire and forget)
                getBridge().executeOnMainThread(() -> {
                    getBridge().getWebView().evaluateJavascript(wrapped, null);
                });

                // Poll window._kbbook_rpc for up to 10 seconds
                long start = System.currentTimeMillis();
                String rpcValue = "";
                while (System.currentTimeMillis() - start < 10000) {
                    final CountDownLatch pollLatch = new CountDownLatch(1);
                    final String[] pollResult = {""};
                    getBridge().executeOnMainThread(() -> {
                        getBridge().getWebView().evaluateJavascript(
                            "(typeof window._kbbook_rpc!=='undefined')?window._kbbook_rpc:null",
                            val -> { pollResult[0] = val != null ? val : "null"; pollLatch.countDown(); });
                    });
                    try { pollLatch.await(200, java.util.concurrent.TimeUnit.MILLISECONDS); }
                    catch (InterruptedException ie) { break; }
                    if (!pollResult[0].isEmpty() && !"null".equals(pollResult[0])) {
                        rpcValue = pollResult[0];
                        // Clean up
                        getBridge().executeOnMainThread(() -> {
                            getBridge().getWebView().evaluateJavascript("delete window._kbbook_rpc", null);
                        });
                        break;
                    }
                }

                if (rpcValue.isEmpty()) {
                    return "{\"error\":\"timeout (10s) — result is null or async code did not resolve\"}";
                }

                // rpcValue is the JSON from evaluateJavascript.
                // Our stored value in window._kbbook_rpc is a JSON string.
                // evaluateJavascript returns it as a JSON-encoded string (double-encoded).
                // Strip the outer JSON quotes to get our inner JSON.
                String inner = rpcValue;
                if (inner.startsWith("\"") && inner.endsWith("\"")) {
                    inner = inner.substring(1, inner.length() - 1)
                        .replace("\\\\", "\\")
                        .replace("\\\"", "\"");
                }
                try {
                    org.json.JSONObject obj = new org.json.JSONObject(inner);
                    if (obj.has("_rpc_error")) {
                        return "{\"error\":\"eval: " + obj.getString("_rpc_error") + "\"}";
                    }
                    // Return the inner value as the result
                    return "{\"result\":" + inner + "}";
                } catch (Exception ex) {
                    // Not JSON — return as-is
                    return "{\"result\":" + inner + "}";
                }
            }

            return "{\"error\":\"unknown rpc: " + path + "\"}";
        } catch (Exception e) {
            return "{\"error\":\"" + e.getMessage() + "\"}";
        }
    }
}
