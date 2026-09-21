package com.owais.anime;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final int REQUEST_NATIVE_PLAYER = 3001;

    private WebView webView;
    private ProgressBar progressBar;
    private FrameLayout root;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private int previousOrientation;
    private LocalAnimeBackend localBackend;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(5, 7, 11));
        getWindow().setNavigationBarColor(Color.rgb(5, 7, 11));

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(5, 7, 11));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(5, 7, 11));
        webView.setKeepScreenOn(true);

        progressBar = new ProgressBar(
            this,
            null,
            android.R.attr.progressBarStyleHorizontal
        );
        progressBar.setIndeterminate(false);
        progressBar.setMax(100);
        progressBar.setProgressTintList(
            android.content.res.ColorStateList.valueOf(Color.rgb(139, 92, 246))
        );

        root.addView(
            webView,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        root.addView(
            progressBar,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(3)
            )
        );

        setContentView(root);
        configureWebView();
        startLocalBackend();
    }

    private void startLocalBackend() {
        progressBar.setVisibility(View.VISIBLE);

        new Thread(() -> {
            try {
                localBackend = new LocalAnimeBackend(this);
                String localUrl = localBackend.start();

                runOnUiThread(() -> webView.loadUrl(localUrl + "/"));
            } catch (Exception ex) {
                runOnUiThread(() -> showStartupError(
                    "Local backend could not start.\n\n" +
                    (ex.getMessage() == null ? "Unknown error" : ex.getMessage())
                ));
            }
        }, "owais-backend-boot").start();
    }

    private void showStartupError(String message) {
        progressBar.setVisibility(View.GONE);
        webView.setVisibility(View.GONE);

        TextView error = new TextView(this);
        error.setText(message);
        error.setTextColor(Color.rgb(248, 250, 252));
        error.setTextSize(16);
        error.setGravity(android.view.Gravity.CENTER);
        error.setPadding(dp(28), dp(28), dp(28), dp(28));
        error.setBackgroundColor(Color.rgb(5, 7, 11));

        root.addView(
            error,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
    }

    @SuppressWarnings("deprecation")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccess(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setUserAgentString(
            settings.getUserAgentString() + " OwaisAnimeAndroid/3.0"
        );

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(
                WebView view,
                WebResourceRequest request
            ) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();

                if ("owais".equalsIgnoreCase(scheme)) {
                    handleAppUri(uri);
                    return true;
                }

                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    if (
                        uri.getHost() != null
                            && (
                                "127.0.0.1".equals(uri.getHost())
                                || "localhost".equalsIgnoreCase(uri.getHost())
                            )
                    ) {
                        return false;
                    }

                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ex) {
                        Toast.makeText(
                            MainActivity.this,
                            "Could not open external link.",
                            Toast.LENGTH_SHORT
                        ).show();
                    }

                    return true;
                }

                return !"about".equalsIgnoreCase(scheme);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(
                    newProgress >= 100 ? View.GONE : View.VISIBLE
                );
            }

            @Override
            public void onShowCustomView(
                View view,
                CustomViewCallback callback
            ) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }

                customView = view;
                customViewCallback = callback;
                previousOrientation = getRequestedOrientation();

                webView.setVisibility(View.GONE);
                root.addView(
                    customView,
                    new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                );

                setRequestedOrientation(
                    ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                );
                setSystemBarsImmersive(true);
            }

            @Override
            public void onHideCustomView() {
                exitFullscreen();
            }
        });
    }

    private void handleAppUri(Uri uri) {
        String host = uri.getHost();

        if ("play".equalsIgnoreCase(host)) {
            launchNativePlayer(uri);
            return;
        }

        if ("external".equalsIgnoreCase(host)) {
            String url = uri.getQueryParameter("url");
            if (url == null || url.isBlank()) {
                return;
            }

            try {
                startActivity(
                    new Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse(url)
                    )
                );
            } catch (Exception ex) {
                Toast.makeText(
                    this,
                    "Could not open provider.",
                    Toast.LENGTH_SHORT
                ).show();
            }
        }
    }

    private void launchNativePlayer(Uri uri) {
        String url = uri.getQueryParameter("url");

        if (url == null || url.isBlank()) {
            Toast.makeText(this, "Missing stream URL.", Toast.LENGTH_SHORT).show();
            return;
        }

        Intent intent = new Intent(this, PlayerActivity.class);
        intent.putExtra(PlayerActivity.EXTRA_URL, url);
        intent.putExtra(
            PlayerActivity.EXTRA_TITLE,
            valueOr(uri.getQueryParameter("title"), "OWAIS Anime")
        );
        intent.putExtra(
            PlayerActivity.EXTRA_SUBTITLE,
            valueOr(uri.getQueryParameter("subtitle"), "Now Playing")
        );
        intent.putExtra(
            PlayerActivity.EXTRA_ANIME_ID,
            valueOr(uri.getQueryParameter("id"), "")
        );

        int episode = 1;
        try {
            episode = Integer.parseInt(
                valueOr(uri.getQueryParameter("episode"), "1")
            );
        } catch (Exception ignored) {
        }

        long position = 0L;
        try {
            position = Long.parseLong(
                valueOr(uri.getQueryParameter("position"), "0")
            );
        } catch (Exception ignored) {
        }

        intent.putExtra(PlayerActivity.EXTRA_EPISODE, episode);
        intent.putExtra(PlayerActivity.EXTRA_POSITION, position);

        startActivityForResult(intent, REQUEST_NATIVE_PLAYER);
    }

    private void setSystemBarsImmersive(boolean enabled) {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                if (enabled) {
                    controller.hide(
                        WindowInsets.Type.statusBars()
                            | WindowInsets.Type.navigationBars()
                    );
                    controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    );
                } else {
                    controller.show(
                        WindowInsets.Type.statusBars()
                            | WindowInsets.Type.navigationBars()
                    );
                }
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                enabled
                    ? View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    : View.SYSTEM_UI_FLAG_VISIBLE
            );
        }
    }

    private void exitFullscreen() {
        if (customView == null) {
            return;
        }

        root.removeView(customView);
        customView = null;
        webView.setVisibility(View.VISIBLE);

        if (customViewCallback != null) {
            customViewCallback.onCustomViewHidden();
            customViewCallback = null;
        }

        setRequestedOrientation(previousOrientation);
        setSystemBarsImmersive(false);
    }

    @Override
    protected void onActivityResult(
        int requestCode,
        int resultCode,
        Intent data
    ) {
        super.onActivityResult(requestCode, resultCode, data);

        if (
            requestCode != REQUEST_NATIVE_PLAYER
                || resultCode != RESULT_OK
                || data == null
                || webView == null
        ) {
            return;
        }

        String id = valueOr(
            data.getStringExtra(PlayerActivity.EXTRA_ANIME_ID),
            ""
        );
        int episode = data.getIntExtra(PlayerActivity.EXTRA_EPISODE, 1);
        long currentPosition = data.getLongExtra("current_position", 0L);
        long duration = data.getLongExtra("duration", 0L);
        boolean ended = data.getBooleanExtra("ended", false);

        String script =
            "window.OWAIS_NATIVE_PROGRESS && window.OWAIS_NATIVE_PROGRESS(" +
                quoteJs(id) + "," +
                episode + "," +
                currentPosition + "," +
                duration + "," +
                (ended ? "true" : "false") +
            ");";

        webView.evaluateJavascript(script, null);
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            exitFullscreen();
            return;
        }

        webView.evaluateJavascript(
            "(window.OWAIS_APP_BACK && window.OWAIS_APP_BACK()) || false",
            value -> {
                if (!"true".equals(value)) {
                    if (webView.canGoBack()) {
                        webView.goBack();
                    } else {
                        finish();
                    }
                }
            }
        );
    }

    @Override
    protected void onPause() {
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (localBackend != null) {
            localBackend.stop();
            localBackend = null;
        }

        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }

        super.onDestroy();
    }

    private String quoteJs(String value) {
        String safe = value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r");
        return "\"" + safe + "\"";
    }

    private String valueOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
