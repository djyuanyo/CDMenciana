package es.cdmenciana.app;
import org.junit.Test;
import static org.junit.Assert.*;
public class NotificationImageTest {
 @Test public void onlyClubImagesCanBeFetchedInBackground(){
  assertTrue(NotificationImageWorker.safeUrl("https://raw.githubusercontent.com/djyuanyo/CDMenciana/main/notification-images/0123456789abcdef0123456789abcdef.jpg"));
  assertTrue(NotificationImageWorker.safeUrl("https://cms.cdmenciana.es/media/80ff36e4-844a-4e8c-9398-13779df67d15/web"));
  assertFalse(NotificationImageWorker.safeUrl("https://cms.cdmenciana.es.evil.test/media/80ff36e4-844a-4e8c-9398-13779df67d15/web"));
  for(String bad:new String[]{null,"http://localhost/a.jpg","https://raw.githubusercontent.com/other/repo/main/a.jpg","https://raw.githubusercontent.com/djyuanyo/CDMenciana/main/notification-images/../secret","file:///private","https://raw.githubusercontent.com.evil.test/a.jpg"})assertFalse(NotificationImageWorker.safeUrl(bad));
 }
}
