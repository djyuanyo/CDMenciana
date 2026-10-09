package es.cdmenciana.app;

/** Shared by the WebView request handler and the bootstrap-resource checks. */
final class BundledAssets {
    private BundledAssets() {}

    static boolean allows(String name) {
        return java.util.Arrays.asList("index.html", "style.css", "theme.css", "offline.js",
                "ui.js", "auth.js", "club-access.js", "news-reader.js", "auth.css", "appearance.js", "roster-snapshot.js", "fixtures.js", "matchday.js", "rfaf_extract.js", "crest.png").contains(name)
                || name.matches("players/[a-f0-9]{16}\\.webp")
                || name.matches("crests/[a-f0-9]{16}\\.(png|jpg)");
    }
}
