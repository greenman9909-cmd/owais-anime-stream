package com.owais.anime;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
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

public class MainActivity extends Activity {
    private WebView webView;
    private ProgressBar progressBar;
    private FrameLayout root;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private int previousOrientation;

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
        webView.loadUrl("file:///android_asset/app/index.html");
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
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setUserAgentString(
            settings.getUserAgentString() + " OwaisAnimeAndroid/1.0"
        );

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(
                WebView view,
                WebResourceRequest request
            ) {
                String scheme = request.getUrl().getScheme();
                return !(
                    "http".equals(scheme)
                    || "https".equals(scheme)
                    || "file".equals(scheme)
                    || "about".equals(scheme)
                );
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
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
