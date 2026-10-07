package es.cdmenciana.app;

import org.junit.Test;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import static org.junit.Assert.*;

public class BundledAssetsTest {
    @Test public void everyBootstrapResourceIsActuallyServedByTheWebView() throws Exception {
        Path assets=Paths.get("src/main/assets");
        String html=new String(Files.readAllBytes(assets.resolve("index.html")),StandardCharsets.UTF_8);
        Matcher refs=Pattern.compile("(?:href|src)=\"([^\"]+)\"").matcher(html);
        int count=0;
        while(refs.find()) {
            String path=refs.group(1).split("\\?",2)[0];
            assertTrue("WebView blocks a required resource: "+path,BundledAssets.allows(path));
            assertTrue("Missing bundled resource: "+path,Files.size(assets.resolve(path))>0);
            count++;
        }
        assertTrue("No bootstrap resources checked",count>=6);
        assertTrue(BundledAssets.allows("theme.css"));
    }
    @Test public void imagesStayAvailableWithoutOpeningOtherLocalFiles() {
        assertTrue(BundledAssets.allows("players/0123456789abcdef.webp"));
        assertTrue(BundledAssets.allows("crests/0123456789abcdef.jpg"));
        for(String unsafe:new String[]{"../theme.css","/theme.css","file:///theme.css","private.json","actas/../../index.html"})assertFalse(unsafe,BundledAssets.allows(unsafe));
    }
}
