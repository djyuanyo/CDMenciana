package es.cdmenciana.app;

/** Account choices survive an APK update and a temporary sign-out. */
final class PushPreferences {
    private PushPreferences() {}
    static boolean restore(String currentUid,String registeredUid,boolean legacyEnabled,boolean hasChoice,boolean choice) {
        if(hasChoice)return choice;
        return legacyEnabled&&(registeredUid.isEmpty()||currentUid.equals(registeredUid));
    }
}
