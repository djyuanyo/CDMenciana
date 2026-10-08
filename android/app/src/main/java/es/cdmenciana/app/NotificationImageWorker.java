package es.cdmenciana.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Show the text immediately, then enrich the same still-visible notification. */
public final class NotificationImageWorker extends Worker {
    public NotificationImageWorker(Context context,WorkerParameters params){super(context,params);}
    static boolean safeUrl(String value){return value!=null&&value.matches("https://raw\\.githubusercontent\\.com/djyuanyo/CDMenciana/main/notification-images/[a-f0-9]{32}\\.jpg");}
    private boolean allowed(String uid){FirebaseUser user=FirebaseAuth.getInstance().getCurrentUser();return user!=null&&user.getUid().equals(uid)&&uid.equals(ClubPush.prefs(getApplicationContext()).getString("uid",""))&&ClubPush.permitted(getApplicationContext());}
    @Override public Result doWork(){
        String uid=getInputData().getString("uid"),event=getInputData().getString("eventId"),url=getInputData().getString("imageUrl");
        if(uid==null||event==null||!event.matches("[a-f0-9]{64}")||!safeUrl(url)||!allowed(uid))return Result.success();
        HttpURLConnection connection=null;
        try{
            connection=(HttpURLConnection)new URL(url).openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(5000);connection.setReadTimeout(5000);
            int code=connection.getResponseCode();if((code==404||code>=500)&&getRunAttemptCount()<4)return Result.retry();
            if(code!=200||connection.getContentLength()>350000)return Result.success();
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(java.io.InputStream stream=connection.getInputStream()){byte[] buffer=new byte[8192];int n;while((n=stream.read(buffer))!=-1){if(bytes.size()+n>350000)return Result.success();bytes.write(buffer,0,n);}}
            byte[] data=bytes.toByteArray();BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(data,0,data.length,options);if(options.outWidth<1||options.outHeight<1||options.outWidth>4096||options.outHeight>4096)return Result.success();options.inJustDecodeBounds=false;options.inSampleSize=1;while(Math.max(options.outWidth,options.outHeight)/options.inSampleSize>1200){options.inSampleSize=options.inSampleSize<1?2:options.inSampleSize*2;}
            Bitmap picture=BitmapFactory.decodeByteArray(data,0,data.length,options);if(picture==null||!allowed(uid))return Result.success();
            NotificationManager manager=getApplicationContext().getSystemService(NotificationManager.class);
            for(android.service.notification.StatusBarNotification active:manager.getActiveNotifications())if(event.equals(active.getTag())){
                Notification updated=Notification.Builder.recoverBuilder(getApplicationContext(),active.getNotification()).setStyle(new Notification.BigPictureStyle().bigPicture(picture).setSummaryText(getInputData().getString("body"))).setOnlyAlertOnce(true).build();
                if(allowed(uid))manager.notify(event,0,updated);break;
            }
        }catch(Exception ignored){if(getRunAttemptCount()<4&&allowed(uid))return Result.retry();/* The text remains visible even when the image cannot be loaded. */}finally{if(connection!=null)connection.disconnect();}
        return Result.success();
    }
}
