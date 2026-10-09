package es.cdmenciana.app;
import org.junit.Test;
import static org.junit.Assert.*;

public final class NotificationRoutesTest {
    @Test public void finalsOpenTheCorrectTeamsReport(){
        assertEquals("#acta=12345&equipo=first",NotificationRoutes.route(null,"first","12345"));
        assertEquals("#acta=12345&equipo=filial",NotificationRoutes.route("","filial","12345"));
        assertEquals("#acta=12345&equipo=infantil",NotificationRoutes.route(null,"infantil","12345"));
        assertEquals("",NotificationRoutes.route(null,"all","12345"));
        assertEquals("",NotificationRoutes.route(null,"first","12345&equipo=filial"));
    }
    @Test public void importedTeamsHaveSafeReportRoutes(){
        assertEquals("#acta=12345&equipo=rfaf_49465413_1234",NotificationRoutes.route(null,"rfaf_49465413_1234","12345"));
        assertFalse(NotificationRoutes.validTeam("rfaf_1_2&equipo=first"));
        assertFalse(NotificationRoutes.validTeam("../../private"));
    }
    @Test public void newsOpenOnlyInternalArticleRoutes(){
        assertEquals("#noticia=nueva-noticia",NotificationRoutes.route("nueva-noticia","all",null));
        assertEquals("",NotificationRoutes.route("https://evil.test","all",null));
    }
}

