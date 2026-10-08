package es.cdmenciana.app;
import org.junit.Test;
import static org.junit.Assert.*;
public class NotificationImageTest {
 @Test public void onlyClubImagesCanBeFetchedInBackground(){
  assertTrue(NotificationImageWorker.safeUrl("https://raw.githubusercontent.com/djyuanyo/CDMenciana/main/notification-images/0123456789abcdef0123456789abcdef.jpg"));
  for(String bad:new String[]{null,"http://localhost/a.jpg","https://raw.githubusercontent.com/other/repo/main/a.jpg","https://raw.githubusercontent.com/djyuanyo/CDMenciana/main/notification-images/../secret","file:///private","https://raw.githubusercontent.com.evil.test/a.jpg"})assertFalse(NotificationImageWorker.safeUrl(bad));
 }
}
