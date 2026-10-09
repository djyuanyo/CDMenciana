package es.cdmenciana.app;

import org.junit.Test;
import static org.junit.Assert.*;

public final class PushPreferencesTest {
    @Test public void updatingAnExistingInstallKeepsItsChoice(){
        assertTrue(PushPreferences.restore("fan","fan",true,false,false));
        assertFalse(PushPreferences.restore("fan","",false,false,false));
        assertFalse(PushPreferences.restore("fan","fan",true,true,false));
    }
    @Test public void signingBackInRestoresOnlyThatAccountsPreference(){
        assertTrue(PushPreferences.restore("fan","",false,true,true));
        assertFalse(PushPreferences.restore("other","fan",true,false,false));
        assertFalse(PushPreferences.restore("other","",false,false,false));
    }
}
