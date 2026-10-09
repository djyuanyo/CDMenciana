package es.cdmenciana.app;

/** Firebase is activated only after adult account access, including opt-in background messaging. */
public final class ClubApplication extends android.app.Application {
    @Override public void onCreate() {
        super.onCreate();
        if(getSharedPreferences("club-adult",MODE_PRIVATE).getBoolean("approved",false))
            com.google.firebase.FirebaseApp.initializeApp(this);
    }
}
