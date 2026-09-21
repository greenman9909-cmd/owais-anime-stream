package com.owais.anime;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.TextView;
import android.widget.Toast;

import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.Player;
import androidx.media3.common.Tracks;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.PlayerView;

import java.util.LinkedHashSet;
import java.util.Set;

public class PlayerActivity extends Activity {
    public static final String EXTRA_URL = "url";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_SUBTITLE = "subtitle";
    public static final String EXTRA_ANIME_ID = "anime_id";
    public static final String EXTRA_EPISODE = "episode";
    public static final String EXTRA_POSITION = "position";

    private ExoPlayer player;
    private PlayerView playerView;
    private Button qualityButton;
    private String streamUrl;
    private String animeTitle;
    private String episodeLabel;
    private String animeId;
    private int episode;
    private long startPosition;
    private boolean resultSent;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        streamUrl = getIntent().getStringExtra(EXTRA_URL);
        animeTitle = valueOr(getIntent().getStringExtra(EXTRA_TITLE), "OWAIS Anime");
        episodeLabel = valueOr(getIntent().getStringExtra(EXTRA_SUBTITLE), "Now Playing");
        animeId = valueOr(getIntent().getStringExtra(EXTRA_ANIME_ID), "");
        episode = getIntent().getIntExtra(EXTRA_EPISODE, 1);
        startPosition = getIntent().getLongExtra(EXTRA_POSITION, 0L);

        if (streamUrl == null || streamUrl.trim().isEmpty()) {
            Toast.makeText(this, "No stream URL provided.", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR);

        setContentView(buildUi());
        initializePlayer();
    }

    private View buildUi() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        playerView = new PlayerView(this);
        playerView.setBackgroundColor(Color.BLACK);
        playerView.setUseController(true);
        playerView.setControllerAutoShow(true);
        playerView.setControllerHideOnTouch(true);

        root.addView(
            playerView,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        LinearLayout topBar = new LinearLayout(this);
        topBar.setOrientation(LinearLayout.HORIZONTAL);
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        topBar.setPadding(dp(12), dp(10), dp(12), dp(10));
        topBar.setBackgroundColor(Color.argb(150, 0, 0, 0));

        Button back = pillButton("←");
        LinearLayout.LayoutParams backParams = new LinearLayout.LayoutParams(dp(42), dp(40));
        topBar.addView(back, backParams);

        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);
        titles.setPadding(dp(12), 0, dp(8), 0);

        TextView title = text(animeTitle, 14, Color.WHITE, true);
        title.setSingleLine(true);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);

        TextView subtitle = text(episodeLabel, 10, Color.rgb(172, 184, 201), false);
        subtitle.setSingleLine(true);
        subtitle.setEllipsize(android.text.TextUtils.TruncateAt.END);

        titles.addView(title);
        titles.addView(subtitle);

        LinearLayout.LayoutParams titlesParams = new LinearLayout.LayoutParams(
            0,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            1f
        );
        topBar.addView(titles, titlesParams);

        qualityButton = pillButton("AUTO");
        LinearLayout.LayoutParams qualityParams = new LinearLayout.LayoutParams(dp(62), dp(40));
        qualityParams.setMarginEnd(dp(7));
        topBar.addView(qualityButton, qualityParams);

        Button pipButton = pillButton("PiP");
        topBar.addView(
            pipButton,
            new LinearLayout.LayoutParams(dp(54), dp(40))
        );

        FrameLayout.LayoutParams topParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.TOP
        );
        root.addView(topBar, topParams);

        TextView badge = text("NATIVE MEDIA3 • LOCAL APP", 9, Color.rgb(196, 181, 253), true);
        badge.setGravity(Gravity.CENTER);
        badge.setPadding(dp(10), dp(6), dp(10), dp(6));
        badge.setBackground(roundRect(Color.argb(160, 76, 29, 149), 999));

        FrameLayout.LayoutParams badgeParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM | Gravity.START
        );
        badgeParams.setMargins(dp(14), 0, 0, dp(14));
        root.addView(badge, badgeParams);

        back.setOnClickListener(v -> finishWithResult());
        pipButton.setOnClickListener(v -> enterPip());
        qualityButton.setOnClickListener(v -> showQualityMenu());

        return root;
    }

    private void initializePlayer() {
        DefaultHttpDataSource.Factory httpFactory = new DefaultHttpDataSource.Factory()
            .setUserAgent("OWAIS-Anime-Android/3.0")
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15_000)
            .setReadTimeoutMs(30_000);

        player = new ExoPlayer.Builder(this)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(httpFactory))
            .build();

        playerView.setPlayer(player);

        MediaItem.Builder item = new MediaItem.Builder().setUri(Uri.parse(streamUrl));
        if (streamUrl.toLowerCase().contains(".m3u8")) {
            item.setMimeType(MimeTypes.APPLICATION_M3U8);
        }

        player.setMediaItem(item.build());
        player.prepare();

        if (startPosition > 0) {
            player.seekTo(startPosition);
        }

        player.setPlayWhenReady(true);

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_READY) {
                    qualityButton.setEnabled(true);
                } else if (playbackState == Player.STATE_ENDED) {
                    finishWithResult();
                }
            }

            @Override
            public void onPlayerError(androidx.media3.common.PlaybackException error) {
                Toast.makeText(
                    PlayerActivity.this,
                    "Playback error: " + error.getErrorCodeName(),
                    Toast.LENGTH_LONG
                ).show();
            }
        });
    }

    private void showQualityMenu() {
        if (player == null) return;

        PopupMenu menu = new PopupMenu(this, qualityButton);
        menu.getMenu().add("Auto");

        Set<Integer> heights = new LinkedHashSet<>();
        Tracks tracks = player.getCurrentTracks();

        for (Tracks.Group group : tracks.getGroups()) {
            if (group.getType() != C.TRACK_TYPE_VIDEO) continue;

            for (int i = 0; i < group.length; i++) {
                int height = group.getTrackFormat(i).height;
                if (height > 0) {
                    heights.add(height);
                }
            }
        }

        Integer[] sorted = heights.toArray(new Integer[0]);
        java.util.Arrays.sort(sorted, java.util.Collections.reverseOrder());

        for (Integer height : sorted) {
            menu.getMenu().add(height + "p");
        }

        menu.setOnMenuItemClickListener(item -> {
            String label = item.getTitle().toString();

            if ("Auto".equals(label)) {
                player.setTrackSelectionParameters(
                    player.getTrackSelectionParameters()
                        .buildUpon()
                        .setMaxVideoSize(Integer.MAX_VALUE, Integer.MAX_VALUE)
                        .build()
                );
                qualityButton.setText("AUTO");
                return true;
            }

            try {
                int height = Integer.parseInt(label.replace("p", ""));
                player.setTrackSelectionParameters(
                    player.getTrackSelectionParameters()
                        .buildUpon()
                        .setMaxVideoSize(Integer.MAX_VALUE, height)
                        .build()
                );
                qualityButton.setText(label);
                return true;
            } catch (Exception ignored) {
                return false;
            }
        });

        menu.show();
    }

    private void enterPip() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            Toast.makeText(this, "Picture-in-Picture requires Android 8+.", Toast.LENGTH_SHORT).show();
            return;
        }

        try {
            PictureInPictureParams params = new PictureInPictureParams.Builder()
                .setAspectRatio(new Rational(16, 9))
                .build();
            enterPictureInPictureMode(params);
        } catch (Exception ex) {
            Toast.makeText(this, "PiP is unavailable on this device.", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();

        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && player != null
                && player.isPlaying()
                && !isInPictureInPictureMode()
        ) {
            enterPip();
        }
    }

    @Override
    public void onPictureInPictureModeChanged(
        boolean isInPictureInPictureMode,
        android.content.res.Configuration newConfig
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);

        if (playerView != null) {
            playerView.setUseController(!isInPictureInPictureMode);
        }
    }

    private void finishWithResult() {
        sendResult();
        finish();
    }

    private void sendResult() {
        if (resultSent) return;
        resultSent = true;

        Intent data = new Intent();
        data.putExtra(EXTRA_ANIME_ID, animeId);
        data.putExtra(EXTRA_EPISODE, episode);

        if (player != null) {
            data.putExtra("current_position", Math.max(0L, player.getCurrentPosition()));
            data.putExtra("duration", Math.max(0L, player.getDuration()));
            data.putExtra("ended", player.getPlaybackState() == Player.STATE_ENDED);
        }

        setResult(RESULT_OK, data);
    }

    @Override
    public void onBackPressed() {
        finishWithResult();
    }

    @Override
    protected void onStop() {
        super.onStop();

        if (
            Build.VERSION.SDK_INT < Build.VERSION_CODES.N
                || !isInPictureInPictureMode()
        ) {
            if (player != null) {
                player.pause();
            }
        }
    }

    @Override
    protected void onStart() {
        super.onStart();

        if (player != null) {
            player.play();
        }
    }

    @Override
    protected void onDestroy() {
        sendResult();

        if (player != null) {
            playerView.setPlayer(null);
            player.release();
            player = null;
        }

        super.onDestroy();
    }

    private Button pillButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(Color.WHITE);
        button.setTextSize(10);
        button.setAllCaps(false);
        button.setGravity(Gravity.CENTER);
        button.setPadding(0, 0, 0, 0);
        button.setBackground(roundRect(Color.argb(175, 17, 24, 39), 14));
        return button;
    }

    private TextView text(String value, float size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setTypeface(
            android.graphics.Typeface.create(
                "sans",
                bold ? android.graphics.Typeface.BOLD : android.graphics.Typeface.NORMAL
            )
        );
        return view;
    }

    private GradientDrawable roundRect(int color, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        drawable.setStroke(dp(1), Color.argb(55, 255, 255, 255));
        return drawable;
    }

    private String valueOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
