package com.owais.anime;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class LocalAnimeBackend {
    private static final String ANILIST = "https://graphql.anilist.co";
    private static final String PREFS = "owais_local_backend";

    private final Context context;
    private final SharedPreferences preferences;
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    private volatile boolean running;
    private ServerSocket serverSocket;
    private Thread acceptThread;
    private int port = 8765;

    public LocalAnimeBackend(Context context) {
        this.context = context.getApplicationContext();
        this.preferences = this.context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public synchronized String start() throws Exception {
        if (running) {
            return getBaseUrl();
        }

        Exception last = null;
        for (int candidate = 8765; candidate <= 8775; candidate++) {
            try {
                serverSocket = new ServerSocket(
                    candidate,
                    50,
                    InetAddress.getByName("127.0.0.1")
                );
                port = candidate;
                break;
            } catch (Exception ex) {
                last = ex;
            }
        }

        if (serverSocket == null) {
            throw new IllegalStateException("Could not start local backend.", last);
        }

        running = true;
        acceptThread = new Thread(this::acceptLoop, "owais-local-backend");
        acceptThread.setDaemon(true);
        acceptThread.start();
        return getBaseUrl();
    }

    public synchronized void stop() {
        running = false;

        if (serverSocket != null) {
            try {
                serverSocket.close();
            } catch (Exception ignored) {
            }
            serverSocket = null;
        }

        acceptThread = null;
    }

    public boolean isRunning() {
        return running;
    }

    public String getBaseUrl() {
        return "http://127.0.0.1:" + port;
    }

    private void acceptLoop() {
        while (running) {
            try {
                Socket socket = serverSocket.accept();
                Thread worker = new Thread(
                    () -> handle(socket),
                    "owais-local-request"
                );
                worker.setDaemon(true);
                worker.start();
            } catch (Exception ex) {
                if (running) {
                    ex.printStackTrace();
                }
            }
        }
    }

    private void handle(Socket socket) {
        try (
            Socket client = socket;
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(client.getInputStream(), StandardCharsets.ISO_8859_1)
            );
            OutputStream output = client.getOutputStream()
        ) {
            String requestLine = reader.readLine();
            if (requestLine == null || requestLine.isBlank()) {
                return;
            }

            String[] requestParts = requestLine.split(" ");
            if (requestParts.length < 2) {
                sendText(output, 400, "Bad Request", "Bad Request", "text/plain; charset=utf-8");
                return;
            }

            String method = requestParts[0].toUpperCase(Locale.ROOT);
            String target = requestParts[1];

            Map<String, String> headers = new HashMap<>();
            String line;
            while ((line = reader.readLine()) != null && !line.isEmpty()) {
                int colon = line.indexOf(':');
                if (colon > 0) {
                    headers.put(
                        line.substring(0, colon).trim().toLowerCase(Locale.ROOT),
                        line.substring(colon + 1).trim()
                    );
                }
            }

            int contentLength = 0;
            try {
                contentLength = Integer.parseInt(headers.getOrDefault("content-length", "0"));
            } catch (Exception ignored) {
            }

            String body = "";
            if (contentLength > 0) {
                char[] chars = new char[contentLength];
                int offset = 0;
                while (offset < chars.length) {
                    int read = reader.read(chars, offset, chars.length - offset);
                    if (read < 0) break;
                    offset += read;
                }
                body = new String(chars, 0, offset);
            }

            route(method, target, body, output);
        } catch (Exception ignored) {
        }
    }

    private void route(String method, String target, String body, OutputStream output) throws Exception {
        String path = target;
        String query = "";

        int question = target.indexOf('?');
        if (question >= 0) {
            path = target.substring(0, question);
            query = target.substring(question + 1);
        }

        if ("GET".equals(method) && ("/".equals(path) || "/index.html".equals(path))) {
            sendAsset(output, "app/index.html", "text/html; charset=utf-8");
            return;
        }

        if ("GET".equals(method) && "/styles.css".equals(path)) {
            sendAsset(output, "app/styles.css", "text/css; charset=utf-8");
            return;
        }

        if ("GET".equals(method) && "/app.js".equals(path)) {
            sendAsset(output, "app/app.js", "application/javascript; charset=utf-8");
            return;
        }

        if ("GET".equals(method) && "/api/health".equals(path)) {
            JSONObject data = new JSONObject();
            data.put("status", "ok");
            data.put("mode", "local");
            data.put("port", port);
            data.put("providerConfigured", providerConfigured());
            sendJson(output, 200, data);
            return;
        }

        if ("GET".equals(method) && "/api/provider".equals(path)) {
            sendJson(output, 200, providerJson());
            return;
        }

        if ("POST".equals(method) && "/api/provider".equals(path)) {
            JSONObject payload = new JSONObject(body.isBlank() ? "{}" : body);
            String subTemplate = payload.optString("subTemplate", "").trim();
            String dubTemplate = payload.optString("dubTemplate", "").trim();
            String mode = payload.optString("mode", "embed").trim();

            validateTemplate(subTemplate);
            validateTemplate(dubTemplate);

            if (!"embed".equals(mode) && !"direct".equals(mode)) {
                mode = "embed";
            }

            preferences.edit()
                .putString("subTemplate", subTemplate)
                .putString("dubTemplate", dubTemplate)
                .putString("providerMode", mode)
                .apply();

            JSONObject response = providerJson();
            response.put("saved", true);
            sendJson(output, 200, response);
            return;
        }

        if ("GET".equals(method) && "/api/search".equals(path)) {
            Map<String, String> params = queryParams(query);
            String q = params.getOrDefault("q", "");
            int perPage = clampInt(params.get("perPage"), 20, 1, 40);
            sendJson(output, 200, searchAnime(q, "search", perPage));
            return;
        }

        if ("GET".equals(method) && "/api/anime".equals(path)) {
            Map<String, String> params = queryParams(query);
            String q = params.getOrDefault("q", "");
            String sort = params.getOrDefault("sort", "trending");
            int perPage = clampInt(params.get("perPage"), 20, 1, 40);

            if (!q.isBlank()) {
                sendJson(output, 200, searchAnime(q, "search", perPage));
            } else {
                sendJson(output, 200, searchAnime("", sort, perPage));
            }
            return;
        }

        if ("GET".equals(method) && path.startsWith("/api/anime/")) {
            String idText = path.substring("/api/anime/".length());
            int id = Integer.parseInt(idText);
            sendJson(output, 200, animeDetail(id));
            return;
        }

        if ("GET".equals(method) && path.startsWith("/api/play/")) {
            String tail = path.substring("/api/play/".length());
            String[] parts = tail.split("/");
            if (parts.length < 2) {
                sendError(output, 400, "Invalid play request.");
                return;
            }

            int id = Integer.parseInt(parts[0]);
            int episode = Integer.parseInt(parts[1]);
            String track = queryParams(query).getOrDefault("track", "sub");
            sendJson(output, 200, playInfo(id, episode, track));
            return;
        }

        sendError(output, 404, "Not found.");
    }

    private JSONObject providerJson() throws Exception {
        JSONObject data = new JSONObject();
        data.put("subTemplate", preferences.getString("subTemplate", ""));
        data.put("dubTemplate", preferences.getString("dubTemplate", ""));
        data.put("mode", preferences.getString("providerMode", "embed"));
        data.put("configured", providerConfigured());
        return data;
    }

    private boolean providerConfigured() {
        return !preferences.getString("subTemplate", "").isBlank()
            || !preferences.getString("dubTemplate", "").isBlank();
    }

    private void validateTemplate(String template) {
        if (template == null || template.isBlank()) {
            return;
        }

        String lower = template.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("https://") && !lower.startsWith("http://")) {
            throw new IllegalArgumentException("Provider templates must use http:// or https://.");
        }
    }

    private JSONObject playInfo(int id, int episode, String track) throws Exception {
        JSONObject response = new JSONObject();
        response.put("anilistId", id);
        response.put("episode", episode);
        response.put("track", track);

        String sub = preferences.getString("subTemplate", "");
        String dub = preferences.getString("dubTemplate", "");
        String template = "dub".equalsIgnoreCase(track) ? dub : sub;

        if (template.isBlank()) {
            template = !sub.isBlank() ? sub : dub;
        }

        if (!template.isBlank()) {
            String url = expandTemplate(template, id, episode, track);
            response.put("available", true);
            response.put("mode", preferences.getString("providerMode", "embed"));
            response.put("url", url);
            response.put("source", "local-provider");
            return response;
        }

        JSONObject detail = animeDetail(id);
        JSONArray official = detail.optJSONArray("officialStreams");

        response.put("available", false);
        response.put("mode", "official");

        if (official != null && official.length() > 0) {
            JSONObject closest = official.optJSONObject(Math.max(0, Math.min(episode - 1, official.length() - 1)));
            if (closest != null) {
                response.put("officialUrl", closest.optString("url", ""));
                response.put("officialTitle", closest.optString("title", "Official stream"));
            }
        }

        response.put(
            "message",
            "No local playback provider is configured. Add an authorized embed/HLS template in Local Source settings."
        );
        return response;
    }

    private String expandTemplate(String template, int id, int episode, String track) {
        return template
            .replace("{id}", String.valueOf(id))
            .replace("{anilistId}", String.valueOf(id))
            .replace("{episode}", String.valueOf(episode))
            .replace("{ep}", String.valueOf(episode))
            .replace("{track}", track == null ? "sub" : track);
    }

    private JSONObject searchAnime(String q, String sort, int perPage) throws Exception {
        String cacheKey = "search:" + q + ":" + sort + ":" + perPage;
        JSONObject cached = cached(cacheKey, 15 * 60_000L);
        if (cached != null) {
            return cached;
        }

        String sortValue = "TRENDING_DESC";
        if ("score".equalsIgnoreCase(sort)) {
            sortValue = "SCORE_DESC";
        } else if ("popular".equalsIgnoreCase(sort)) {
            sortValue = "POPULARITY_DESC";
        }

        String gql =
            "query ($q: String, $perPage: Int, $sort: [MediaSort]) {" +
            " Page(page: 1, perPage: $perPage) {" +
            "  pageInfo { hasNextPage currentPage }" +
            "  media(search: $q, type: ANIME, sort: $sort, isAdult: false) {" +
            "   id title { romaji english native }" +
            "   coverImage { large extraLarge } bannerImage format episodes status seasonYear averageScore genres" +
            "  }" +
            " }" +
            "}";

        JSONObject variables = new JSONObject();
        variables.put("q", q == null || q.isBlank() ? JSONObject.NULL : q);
        variables.put("perPage", perPage);
        JSONArray sorts = new JSONArray();
        sorts.put(sortValue);
        variables.put("sort", sorts);

        JSONObject graph = graphQl(gql, variables);
        JSONObject page = graph.getJSONObject("data").getJSONObject("Page");
        JSONArray media = page.getJSONArray("media");
        JSONArray results = new JSONArray();

        for (int i = 0; i < media.length(); i++) {
            results.put(formatMedia(media.getJSONObject(i), false));
        }

        JSONObject result = new JSONObject();
        result.put("page", 1);
        result.put("hasNext", page.getJSONObject("pageInfo").optBoolean("hasNextPage", false));
        result.put("results", results);

        cache.put(cacheKey, new CacheEntry(System.currentTimeMillis(), result));
        return result;
    }

    private JSONObject animeDetail(int id) throws Exception {
        String cacheKey = "detail:" + id;
        JSONObject cached = cached(cacheKey, 60 * 60_000L);
        if (cached != null) {
            return cached;
        }

        String gql =
            "query ($id: Int) {" +
            " Media(id: $id, type: ANIME) {" +
            "  id idMal title { romaji english native }" +
            "  coverImage { large extraLarge } bannerImage description(asHtml: false)" +
            "  format episodes status seasonYear averageScore genres" +
            "  nextAiringEpisode { episode }" +
            "  streamingEpisodes { title thumbnail url site }
  externalLinks { site url type }" +
            " }" +
            "}";

        JSONObject variables = new JSONObject();
        variables.put("id", id);

        JSONObject graph = graphQl(gql, variables);
        JSONObject media = graph.getJSONObject("data").optJSONObject("Media");

        if (media == null) {
            throw new IllegalArgumentException("Anime not found.");
        }

        JSONObject result = formatMedia(media, true);
        result.put("synopsis", media.optString("description", "No synopsis available."));

        int episodes = result.optInt("episodes", 12);
        if (episodes <= 0) {
            JSONObject next = media.optJSONObject("nextAiringEpisode");
            episodes = next != null ? Math.max(1, next.optInt("episode", 1) - 1) : 12;
            result.put("episodes", episodes);
        }

        JSONArray episodeList = new JSONArray();
        for (int ep = 1; ep <= Math.min(episodes, 500); ep++) {
            JSONObject item = new JSONObject();
            item.put("number", ep);
            item.put("title", "Episode " + ep);
            item.put("thumbnail", result.optString("banner", result.optString("cover", "")));
            episodeList.put(item);
        }
        result.put("episodeList", episodeList);

        JSONArray officialStreams = new JSONArray();
        java.util.HashSet<String> officialUrls = new java.util.HashSet<>();

        JSONArray streams = media.optJSONArray("streamingEpisodes");
        if (streams != null) {
            for (int i = 0; i < streams.length(); i++) {
                JSONObject source = streams.optJSONObject(i);
                if (source == null) continue;

                String streamUrl = source.optString("url", "");
                if (streamUrl.isBlank() || !officialUrls.add(streamUrl)) continue;

                JSONObject item = new JSONObject();
                item.put("title", source.optString("title", "Official stream"));
                item.put("url", streamUrl);
                item.put("site", source.optString("site", ""));
                item.put("thumbnail", source.optString("thumbnail", ""));
                officialStreams.put(item);
            }
        }

        JSONArray externalLinks = media.optJSONArray("externalLinks");
        if (externalLinks != null) {
            for (int i = 0; i < externalLinks.length(); i++) {
                JSONObject source = externalLinks.optJSONObject(i);
                if (source == null) continue;

                String type = source.optString("type", "");
                String site = source.optString("site", "");
                String streamUrl = source.optString("url", "");

                if (
                    streamUrl.isBlank()
                        || officialUrls.contains(streamUrl)
                        || !(
                            "STREAMING".equalsIgnoreCase(type)
                                || site.toLowerCase(Locale.ROOT).contains("crunchyroll")
                                || site.toLowerCase(Locale.ROOT).contains("netflix")
                                || site.toLowerCase(Locale.ROOT).contains("hidive")
                                || site.toLowerCase(Locale.ROOT).contains("prime")
                        )
                ) {
                    continue;
                }

                officialUrls.add(streamUrl);

                JSONObject item = new JSONObject();
                item.put("title", site.isBlank() ? "Official provider" : site);
                item.put("url", streamUrl);
                item.put("site", site);
                item.put("thumbnail", "");
                officialStreams.put(item);
            }
        }

        result.put("officialStreams", officialStreams);

        cache.put(cacheKey, new CacheEntry(System.currentTimeMillis(), result));
        return result;
    }

    private JSONObject formatMedia(JSONObject media, boolean detail) throws Exception {
        JSONObject title = media.optJSONObject("title");
        JSONObject cover = media.optJSONObject("coverImage");

        String romaji = title != null ? title.optString("romaji", "Unknown") : "Unknown";
        String english = title != null ? title.optString("english", romaji) : romaji;
        String nativeTitle = title != null ? title.optString("native", "") : "";

        String coverUrl = "";
        if (cover != null) {
            coverUrl = cover.optString("extraLarge", cover.optString("large", ""));
        }

        JSONObject result = new JSONObject();
        result.put("anilistId", media.getInt("id"));
        result.put("malId", media.optInt("idMal", media.getInt("id")));

        JSONObject outTitle = new JSONObject();
        outTitle.put("romaji", romaji);
        outTitle.put("english", english);
        outTitle.put("native", nativeTitle);
        result.put("title", outTitle);

        result.put("cover", coverUrl);
        result.put("banner", media.optString("bannerImage", coverUrl));
        result.put("format", media.optString("format", "TV"));
        result.put("episodes", media.optInt("episodes", 12));
        result.put("status", media.optString("status", ""));
        result.put("year", media.optInt("seasonYear", 0));
        result.put("score", media.optInt("averageScore", 0));
        result.put("genres", media.optJSONArray("genres") != null ? media.optJSONArray("genres") : new JSONArray());

        return result;
    }

    private JSONObject graphQl(String query, JSONObject variables) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(ANILIST).openConnection();
        connection.setConnectTimeout(12_000);
        connection.setReadTimeout(18_000);
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("User-Agent", "OWAIS-Anime-Android/2.0");

        JSONObject body = new JSONObject();
        body.put("query", query);
        body.put("variables", variables);

        byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
        connection.setFixedLengthStreamingMode(payload.length);

        try (OutputStream output = connection.getOutputStream()) {
            output.write(payload);
        }

        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 300
            ? connection.getInputStream()
            : connection.getErrorStream();

        String text = readAll(stream);
        connection.disconnect();

        if (status < 200 || status >= 300) {
            throw new IllegalStateException("AniList returned HTTP " + status);
        }

        JSONObject data = new JSONObject(text);
        if (data.has("errors")) {
            throw new IllegalStateException("AniList query failed.");
        }
        return data;
    }

    private JSONObject cached(String key, long ttl) {
        CacheEntry entry = cache.get(key);
        if (entry == null) return null;

        if (System.currentTimeMillis() - entry.createdAt > ttl) {
            cache.remove(key);
            return null;
        }

        try {
            return new JSONObject(entry.data.toString());
        } catch (Exception ex) {
            return null;
        }
    }

    private Map<String, String> queryParams(String query) throws Exception {
        Map<String, String> params = new HashMap<>();
        if (query == null || query.isBlank()) return params;

        for (String pair : query.split("&")) {
            if (pair.isBlank()) continue;
            String[] bits = pair.split("=", 2);
            String key = URLDecoder.decode(bits[0], "UTF-8");
            String value = bits.length > 1 ? URLDecoder.decode(bits[1], "UTF-8") : "";
            params.put(key, value);
        }

        return params;
    }

    private int clampInt(String value, int fallback, int min, int max) {
        try {
            int parsed = Integer.parseInt(value);
            return Math.max(min, Math.min(max, parsed));
        } catch (Exception ex) {
            return fallback;
        }
    }

    private String readAll(InputStream input) throws Exception {
        if (input == null) return "";
        try (InputStream stream = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = stream.read(buffer)) >= 0) {
                output.write(buffer, 0, read);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private void sendAsset(OutputStream output, String asset, String mime) throws Exception {
        try (InputStream input = context.getAssets().open(asset)) {
            byte[] bytes = readAllBytes(input);
            writeHeaders(output, 200, "OK", mime, bytes.length);
            output.write(bytes);
        }
    }

    private void sendJson(OutputStream output, int status, JSONObject data) throws Exception {
        byte[] bytes = data.toString().getBytes(StandardCharsets.UTF_8);
        writeHeaders(
            output,
            status,
            status == 200 ? "OK" : "Error",
            "application/json; charset=utf-8",
            bytes.length
        );
        output.write(bytes);
    }

    private void sendError(OutputStream output, int status, String message) throws Exception {
        JSONObject data = new JSONObject();
        data.put("error", message);
        sendJson(output, status, data);
    }

    private void sendText(OutputStream output, int status, String statusText, String text, String mime) throws Exception {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        writeHeaders(output, status, statusText, mime, bytes.length);
        output.write(bytes);
    }

    private void writeHeaders(OutputStream output, int status, String statusText, String mime, int length) throws Exception {
        String headers =
            "HTTP/1.1 " + status + " " + statusText + "\r\n" +
            "Content-Type: " + mime + "\r\n" +
            "Content-Length: " + length + "\r\n" +
            "Cache-Control: no-cache\r\n" +
            "Access-Control-Allow-Origin: *\r\n" +
            "Connection: close\r\n\r\n";

        output.write(headers.getBytes(StandardCharsets.ISO_8859_1));
    }

    private byte[] readAllBytes(InputStream input) throws Exception {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = input.read(buffer)) >= 0) {
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    private static class CacheEntry {
        final long createdAt;
        final JSONObject data;

        CacheEntry(long createdAt, JSONObject data) {
            this.createdAt = createdAt;
            this.data = data;
        }
    }
}
