package es.cdmenciana.app;

import android.app.Activity;
import android.os.CancellationSignal;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseNetworkException;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GoogleAuthProvider;
import com.google.firebase.auth.UserProfileChangeRequest;
import org.json.JSONObject;

/** Real Firebase sessions; passwords and Google credentials stay in the native SDK. */
final class FirebaseAccount {
    interface Output { void send(String request, JSONObject data); }
    private final Activity activity;
    private final Output output;
    private FirebaseAuth auth;
    private final boolean configured;
    private CredentialManager credentials;
    private final FirebaseAuth.AuthStateListener listener;
    private CancellationSignal googleRequest;
    private boolean busy;
    private boolean closed;

    FirebaseAccount(Activity activity, Output output) {
        this.activity=activity;this.output=output;
        configured=activity.getResources().getIdentifier("google_app_id","string",activity.getPackageName())!=0;
        auth=null;credentials=null;
        listener=ignored->send("",state());
        if(auth!=null)auth.addAuthStateListener(listener);
    }
    private String googleClient() {
        int id=activity.getResources().getIdentifier("default_web_client_id","string",activity.getPackageName());
        return id==0?"":activity.getString(id);
    }
    JSONObject state() {
        JSONObject state=new JSONObject();
        try {
            state.put("configured",configured).put("google",configured&&!googleClient().isEmpty());
            FirebaseUser user=auth==null?null:auth.getCurrentUser();
            state.put("user",user==null?JSONObject.NULL:new JSONObject()
                    .put("uid",user.getUid()).put("name",user.getDisplayName()==null?"":user.getDisplayName())
                    .put("email",user.getEmail()==null?"":user.getEmail()).put("emailVerified",user.isEmailVerified()));
        } catch(Exception ignored) { }
        return state;
    }
    private void send(String request, JSONObject data) { if(!closed)output.send(request,data); }
    private void finish(String request,String message) {
        busy=false;JSONObject result=state();
        try { result.put("ok",true).put("message",message); } catch(Exception ignored) { }
        send(request,result);
    }
    private void fail(String request,String message) {
        busy=false;JSONObject result=state();
        try { result.put("ok",false).put("error",message); } catch(Exception ignored) { }
        send(request,result);
    }
    private String error(Exception e) {
        if(e instanceof FirebaseNetworkException)return "Comprueba tu conexión a internet y vuelve a intentarlo.";
        if(e instanceof FirebaseAuthException) {
            String code=((FirebaseAuthException)e).getErrorCode();
            switch(code) {
                case "ERROR_INVALID_EMAIL": return "Introduce un correo electrónico válido.";
                case "ERROR_WEAK_PASSWORD": return "Elige una contraseña más segura.";
                case "ERROR_EMAIL_ALREADY_IN_USE": return "Ese correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.";
                case "ERROR_USER_DISABLED": return "Esta cuenta está desactivada. Contacta con el club.";
                case "ERROR_TOO_MANY_REQUESTS": return "Demasiados intentos. Espera unos minutos y prueba de nuevo.";
                case "ERROR_OPERATION_NOT_ALLOWED": return "Este método de acceso todavía no está activado.";
                case "ERROR_ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL": return "Ese correo utiliza otro método de acceso. Entra con el método con el que te registraste.";
                case "ERROR_INVALID_CREDENTIAL": case "ERROR_WRONG_PASSWORD": case "ERROR_USER_NOT_FOUND": case "ERROR_INVALID_LOGIN_CREDENTIALS":
                    return "No se pudo iniciar sesión. Revisa el correo y la contraseña.";
                default: break;
            }
        }
        return "No se pudo completar la solicitud. Vuelve a intentarlo.";
    }
    private void activate() {
        if(auth!=null||!configured)return;
        if(FirebaseApp.getApps(activity).isEmpty())FirebaseApp.initializeApp(activity);
        auth=FirebaseAuth.getInstance();credentials=CredentialManager.create(activity);
        auth.addAuthStateListener(listener);
    }
    void request(String id,String action,JSONObject data) {
        if(closed)return;
        if("state".equals(action)){send(id,state());return;}
        if("resume".equals(action)){
            activity.getSharedPreferences("club-adult",android.content.Context.MODE_PRIVATE).edit().putBoolean("approved",true).apply();activate();finish(id,"");return;
        }
        if(!activity.getSharedPreferences("club-adult",android.content.Context.MODE_PRIVATE).getBoolean("approved",false)){fail(id,"Completa el acceso de una persona adulta.");return;}
        activate();
        if(auth==null){fail(id,"El acceso al club todavía no está activado.");return;}
        if("token".equals(action)) {
            FirebaseUser user=auth.getCurrentUser();
            if(user==null){fail(id,"Inicia sesión para continuar.");return;}
            user.getIdToken(true).addOnCompleteListener(activity,t->{
                if(!t.isSuccessful()){fail(id,error(t.getException()));return;}
                JSONObject result=state();try{result.put("ok",true).put("token",t.getResult().getToken());}catch(Exception ignored){}
                send(id,result);
            });return;
        }
        if(busy){JSONObject result=state();try{result.put("ok",false).put("error","Espera a que termine la solicitud anterior.");}catch(Exception ignored){}send(id,result);return;}
        busy=true;
        String email=data.optString("email").trim(),password=data.optString("password"),name=data.optString("name").trim();
        switch(action) {
            case "login":
                if(!validEmail(email)||password.isEmpty()||password.length()>128){fail(id,"Revisa tu correo y contraseña.");return;}
                auth.signInWithEmailAndPassword(email,password).addOnCompleteListener(activity,t->{if(t.isSuccessful())finish(id,"Sesión iniciada.");else fail(id,error(t.getException()));});break;
            case "register":
                if(!validEmail(email)||name.length()<2||name.length()>100||password.length()<10||password.length()>128){fail(id,"Indica tu nombre, un correo válido y una contraseña de 10 a 128 caracteres.");return;}
                auth.createUserWithEmailAndPassword(email,password).addOnCompleteListener(activity,t->{
                    if(!t.isSuccessful()){fail(id,error(t.getException()));return;}
                    FirebaseUser user=auth.getCurrentUser();
                    if(user==null){fail(id,"Inicia sesión para continuar.");return;}
                    user.updateProfile(new UserProfileChangeRequest.Builder().setDisplayName(name).build()).addOnCompleteListener(activity,p->{
                        user.sendEmailVerification().addOnCompleteListener(activity,v->finish(id,v.isSuccessful()?"Cuenta creada. Revisa tu correo para verificarla.":"Cuenta creada. Puedes enviar el correo de verificación desde Mi cuenta."));
                    });
                });break;
            case "reset":
                if(!validEmail(email)){fail(id,"Introduce tu correo electrónico.");return;}
                auth.sendPasswordResetEmail(email).addOnCompleteListener(activity,t->{if(t.isSuccessful()||t.getException() instanceof FirebaseAuthException&&"ERROR_USER_NOT_FOUND".equals(((FirebaseAuthException)t.getException()).getErrorCode()))finish(id,"Si el correo tiene una cuenta, recibirás un enlace para cambiar tu contraseña.");else fail(id,error(t.getException()));});break;
            case "verify":
                if(auth.getCurrentUser()==null){fail(id,"Inicia sesión para continuar.");return;}
                auth.getCurrentUser().sendEmailVerification().addOnCompleteListener(activity,t->{if(t.isSuccessful())finish(id,"Correo de verificación enviado. Revisa tu bandeja de entrada.");else fail(id,error(t.getException()));});break;
            case "reload":
                if(auth.getCurrentUser()==null){fail(id,"Inicia sesión para continuar.");return;}
                auth.getCurrentUser().reload().addOnCompleteListener(activity,t->{if(t.isSuccessful())finish(id,auth.getCurrentUser()!=null&&auth.getCurrentUser().isEmailVerified()?"Correo verificado.":"Tu correo todavía está pendiente de verificación.");else fail(id,error(t.getException()));});break;
            case "google": google(id);break;
            case "logout":
                activity.getSharedPreferences("club-adult",android.content.Context.MODE_PRIVATE).edit().clear().apply();
                auth.signOut();
                credentials.clearCredentialStateAsync(new ClearCredentialStateRequest(),null,activity::runOnUiThread,new CredentialManagerCallback<Void,ClearCredentialException>(){
                    @Override public void onResult(Void value){finish(id,"Sesión cerrada.");}
                    @Override public void onError(ClearCredentialException e){finish(id,"Sesión cerrada.");}
                });break;
            default: fail(id,"Solicitud no válida.");
        }
    }
    private boolean validEmail(String email){return email.length()<=254&&android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches();}
    private void google(String id) {
        if(googleClient().isEmpty()){fail(id,"El acceso con Google todavía no está activado.");return;}
        GetSignInWithGoogleOption option=new GetSignInWithGoogleOption.Builder(googleClient()).build();
        GetCredentialRequest request=new GetCredentialRequest.Builder().addCredentialOption(option).build();
        googleRequest=new CancellationSignal();
        credentials.getCredentialAsync(activity,request,googleRequest,activity::runOnUiThread,new CredentialManagerCallback<GetCredentialResponse,GetCredentialException>(){
            @Override public void onResult(GetCredentialResponse result) {
                try {
                    if(!(result.getCredential() instanceof CustomCredential))throw new IllegalArgumentException();
                    CustomCredential custom=(CustomCredential)result.getCredential();
                    if(!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(custom.getType()))throw new IllegalArgumentException();
                    GoogleIdTokenCredential token=GoogleIdTokenCredential.createFrom(custom.getData());
                    auth.signInWithCredential(GoogleAuthProvider.getCredential(token.getIdToken(),null)).addOnCompleteListener(activity,t->{if(t.isSuccessful())finish(id,"Sesión iniciada con Google.");else fail(id,error(t.getException()));});
                } catch(Exception e){fail(id,"No se pudo verificar la cuenta de Google. Prueba de nuevo.");}
            }
            @Override public void onError(GetCredentialException e){if(e instanceof GetCredentialCancellationException)finish(id,"");else fail(id,"No se pudo abrir el selector de Google. Comprueba tu conexión y los servicios de Google del dispositivo.");}
        });
    }
    void close(){closed=true;if(googleRequest!=null)googleRequest.cancel();if(auth!=null)auth.removeAuthStateListener(listener);}
}
