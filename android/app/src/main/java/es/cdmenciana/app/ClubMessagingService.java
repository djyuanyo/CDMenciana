package es.cdmenciana.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/** Data messages prevent the SDK from displaying alerts for a signed-out account. */
public final class ClubMessagingService extends FirebaseMessagingService {
    @Override public void onNewToken(String token){
        FirebaseUser user=FirebaseAuth.getInstance().getCurrentUser();if(user==null||!user.getUid().equals(ClubPush.prefs(this).getString("uid","")))return;
        ClubPush.register(this,user,token,true,()->ClubPush.prefs(this).edit().putString("token",token).apply(),()->{});
    }
    @Override public void onMessageReceived(RemoteMessage message){
        Map<String,String> data=message.getData();FirebaseUser user=FirebaseAuth.getInstance().getCurrentUser();
        String recipient=data.get("uid"),event=data.get("eventId"),team=data.get("teamKey"),acta=data.get("acta");
        if(user==null||!user.getUid().equals(recipient)||!recipient.equals(ClubPush.prefs(this).getString("uid",""))||!ClubPush.permitted(this)||event==null||!event.matches("[a-f0-9]{64}")||!(NotificationRoutes.validTeam(team)||"all".equals(team)))return;
        // Keep a bounded history; stable notification tags also replace duplicate deliveries.
        String seen=ClubPush.prefs(this).getString("seen-"+recipient,"");if(java.util.Arrays.asList(seen.split(",")).contains(event))return;
        NotificationManager manager=getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel("club-results","Avisos del club y resultados",NotificationManager.IMPORTANCE_DEFAULT));
        Intent intent=new Intent(this,MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("notificationTeam",team);
        if(acta!=null&&acta.matches("[0-9]{1,12}"))intent.putExtra("notificationActa",acta);
        String news=data.get("newsSlug");if(news!=null&&news.matches("[a-z0-9][a-z0-9-]{0,199}"))intent.putExtra("notificationNews",news);
        PendingIntent pending=PendingIntent.getActivity(this,event.hashCode(),intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        String title=data.get("title"),body=data.get("body");if(title==null||body==null||title.length()>200||body.length()>500)return;
        Notification notification=new Notification.Builder(this,"club-results").setSmallIcon(R.drawable.notification_ball).setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body)).setContentIntent(pending).setAutoCancel(true).build();
        manager.notify(event,0,notification);
        String image=data.get("imageUrl");
        if(NotificationImageWorker.safeUrl(image)){
            androidx.work.Data input=new androidx.work.Data.Builder().putString("uid",recipient).putString("eventId",event).putString("body",body).putString("imageUrl",image).build();
            androidx.work.OneTimeWorkRequest.Builder builder=new androidx.work.OneTimeWorkRequest.Builder(NotificationImageWorker.class).setInputData(input);
            if(android.os.Build.VERSION.SDK_INT>=31)builder.setExpedited(androidx.work.OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST);
            androidx.work.OneTimeWorkRequest work=builder.build();
            androidx.work.WorkManager.getInstance(this).enqueueUniqueWork("notification-image-"+event,androidx.work.ExistingWorkPolicy.KEEP,work);
        }
        String[] history=(event+(seen.isEmpty()?"":","+seen)).split(",");ClubPush.prefs(this).edit().putString("seen-"+recipient,String.join(",",java.util.Arrays.copyOf(history,Math.min(history.length,100)))).apply();
    }
}

