package es.cdmenciana.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;
import org.json.JSONArray;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Opt-in registration; recipient ownership is checked again for every message. */
final class ClubPush {
    static final int PERMISSION = 7103;
    static final String PREFS="club-push";
    interface Output { void send(String id,JSONObject value); }
    private final Activity activity;
    private final Output output;
    private String waitingId;
    ClubPush(Activity activity,Output output){this.activity=activity;this.output=output;}
    static SharedPreferences prefs(Context c){return c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);}
    static boolean permitted(Context c){return (Build.VERSION.SDK_INT<33||c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED)&&c.getSystemService(NotificationManager.class).areNotificationsEnabled();}
    void reply(String id,boolean enabled,String error){try{JSONObject result=new JSONObject().put("ok",error==null).put("enabled",enabled);if(error!=null)result.put("error",error);output.send(id,result);}catch(Exception ignored){}}
    void firstLaunch(){
        if(prefs(activity).getBoolean("permissionAsked",false))return;
        prefs(activity).edit().putBoolean("permissionAsked",true).apply();
        if(Build.VERSION.SDK_INT>=33&&!permitted(activity)){waitingId="first-launch";activity.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},PERMISSION);}
        else prefs(activity).edit().putBoolean("autoEnable",permitted(activity)).apply();
    }
    void request(String id,String action){
        FirebaseUser user=FirebaseAuth.getInstance().getCurrentUser();
        if("bootstrap".equals(action)){
            if(user!=null&&permitted(activity)&&prefs(activity).getBoolean("autoEnable",false)){enable(id);return;}
            reply(id,false,null);return;
        }
        if("state".equals(action)){reply(id,user!=null&&user.getUid().equals(prefs(activity).getString("uid",""))&&permitted(activity),null);return;}
        if("disable".equals(action)){
            String token=prefs(activity).getString("token","");
            prefs(activity).edit().remove("uid").remove("token").putBoolean("autoEnable",false).apply();activity.getSystemService(NotificationManager.class).cancelAll();
            if(user==null||token.isEmpty()){reply(id,false,null);return;}
            register(activity,user,token,false,()->reply(id,false,null),()->reply(id,false,null));return;
        }
        if(!"enable".equals(action)||user==null){reply(id,false,"Inicia sesión para activar avisos.");return;}
        if(Build.VERSION.SDK_INT>=33&&activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
            if(waitingId!=null){reply(id,false,"Ya hay una solicitud de permiso abierta.");return;}
            waitingId=id;activity.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},PERMISSION);return;
        }
        enable(id);
    }
    void permissionResult(){String id=waitingId;waitingId=null;if(id==null)return;if("first-launch".equals(id)){prefs(activity).edit().putBoolean("autoEnable",permitted(activity)).apply();reply(id,permitted(activity),null);return;}if(!permitted(activity)){reply(id,false,"No has permitido las notificaciones. Puedes activarlas en los ajustes del móvil.");return;}enable(id);}
    private void enable(String id){
        if(!permitted(activity)){reply(id,false,"Activa las notificaciones de CD Menciana en los ajustes del móvil.");return;}
        FirebaseUser user=FirebaseAuth.getInstance().getCurrentUser();if(user==null){reply(id,false,"Inicia sesión para continuar.");return;}
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(activity,task->{
            if(!task.isSuccessful()||task.getResult()==null){reply(id,false,"No se pudo preparar el móvil para recibir avisos.");return;}
            String token=task.getResult();register(activity,user,token,true,()->{
                FirebaseUser current=FirebaseAuth.getInstance().getCurrentUser();
                if(current==null||!current.getUid().equals(user.getUid())){reply(id,false,"La sesión ha cambiado.");return;}
                prefs(activity).edit().putString("uid",user.getUid()).putString("token",token).putBoolean("autoEnable",true).apply();reply(id,true,null);
            },()->reply(id,false,"No se pudo activar el aviso. Vuelve a intentarlo."));
        });
    }
    static String deviceId(String token)throws Exception{byte[] hash=MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));StringBuilder s=new StringBuilder();for(byte b:hash)s.append(String.format("%02x",b&255));return s.toString();}
    static void register(Context context,FirebaseUser user,String token,boolean enabled,Runnable success,Runnable failure){
        user.getIdToken(false).addOnCompleteListener(task->{
            if(!task.isSuccessful()||task.getResult()==null||task.getResult().getToken()==null){failure.run();return;}
            String bearer=task.getResult().getToken();
            new Thread(()->{HttpURLConnection connection=null;try{
                FirebaseUser current=FirebaseAuth.getInstance().getCurrentUser();if(current==null||!current.getUid().equals(user.getUid()))throw new Exception();
                String name="projects/barpro-pos-menciana/databases/(default)/documents/clubUsers/"+user.getUid()+"/devices/"+deviceId(token);
                JSONObject fields=new JSONObject().put("uid",new JSONObject().put("stringValue",user.getUid())).put("token",new JSONObject().put("stringValue",token)).put("enabled",new JSONObject().put("booleanValue",enabled));
                JSONObject write=new JSONObject().put("update",new JSONObject().put("name",name).put("fields",fields)).put("updateTransforms",new JSONArray().put(new JSONObject().put("fieldPath","updatedAt").put("setToServerValue","REQUEST_TIME")));
                byte[] body=new JSONObject().put("writes",new JSONArray().put(write)).toString().getBytes(StandardCharsets.UTF_8);
                connection=(HttpURLConnection)new URL("https://firestore.googleapis.com/v1/projects/barpro-pos-menciana/databases/(default)/documents:commit").openConnection();connection.setRequestMethod("POST");connection.setConnectTimeout(15000);connection.setReadTimeout(15000);connection.setDoOutput(true);connection.setRequestProperty("Authorization","Bearer "+bearer);connection.setRequestProperty("Content-Type","application/json");try(java.io.OutputStream stream=connection.getOutputStream()){stream.write(body);}if(connection.getResponseCode()/100!=2)throw new Exception();success.run();
            }catch(Exception ignored){failure.run();}finally{if(connection!=null)connection.disconnect();}},"club-push-register").start();
        });
    }
}
