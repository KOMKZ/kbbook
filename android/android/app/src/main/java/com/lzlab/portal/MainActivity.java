package com.lzlab.portal;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.BridgeActivity;
import com.lzlab.portal.plugins.LZPortalSyncPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

public class MainActivity extends BridgeActivity {

    private String otaAssetPath;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(LZPortalSyncPlugin.class);

        // Check for OTA update path
        SharedPreferences prefs = getSharedPreferences("kbbook_prefs", MODE_PRIVATE);
        String path = prefs.getString("ota_path", null);
        if (path != null && new File(path, "index.html").exists()) {
            otaAssetPath = path;
        }

        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
            webView.getSettings().setJavaScriptEnabled(true);
            // Allow HTTP fetch from HTTPS page (network mode → dev server)
            webView.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

            // OTA: intercept localhost requests, serve from updated storage
            if (otaAssetPath != null) {
                final WebViewClient original = webView.getWebViewClient();
                webView.setWebViewClient(new WebViewClient() {
                    @Override
                    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                        String url = request.getUrl().toString();
                        // Capacitor serves from https://localhost/
                        if (url.contains("localhost")) {
                            String reqPath = request.getUrl().getPath();
                            if (reqPath == null || reqPath.equals("/")) reqPath = "/index.html";
                            File f = new File(otaAssetPath, reqPath);
                            if (f.exists()) {
                                try {
                                    String mime = getMimeType(reqPath);
                                    return new WebResourceResponse(mime, "UTF-8", new FileInputStream(f));
                                } catch (IOException ignored) {}
                            }
                        }
                        // Fall through to Capacitor's handler
                        return original.shouldInterceptRequest(view, request);
                    }
                });
            }
        }
    }

    private static String getMimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".woff")) return "font/woff";
        String ext = MimeTypeMap.getFileExtensionFromUrl(path);
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return mime != null ? mime : "application/octet-stream";
    }
}
