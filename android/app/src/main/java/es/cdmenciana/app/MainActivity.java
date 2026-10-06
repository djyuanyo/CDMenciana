package es.cdmenciana.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.FrameLayout;
import android.view.WindowInsets;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Native Android shell for the club's own hosted interface. No JS bridge. */
public class MainActivity extends Activity {
    private WebView web;
    private String base;
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        if(android.os.Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        getWindow().setStatusBarColor(Color.rgb(8,41,85));
        getWindow().setNavigationBarColor(Color.rgb(8,41,85));
        getWindow().getDecorView().setSystemUiVisibility(0);
        base=getPreferences(MODE_PRIVATE).getString("server", "");
        load();
    }
    private void configure() {
        LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(40,70,40,40);box.setBackgroundColor(Color.rgb(240,244,248));
        TextView title=new TextView(this);title.setText("CD MENCIANA\nAPAGA Y VÁMONOS");title.setTextSize(26);title.setTextColor(Color.rgb(8,41,85));box.addView(title);
        TextView hint=new TextView(this);hint.setText("Conecta la app al servidor del club. Introduce la dirección HTTPS facilitada por administración.");hint.setPadding(0,30,0,30);box.addView(hint);
        EditText url=new EditText(this);url.setHint("https://app.tu-dominio.es");url.setSingleLine(true);url.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_URI);box.addView(url);
        Button connect=new Button(this);connect.setText("Conectar con el club");box.addView(connect);
        connect.setOnClickListener(v->{Uri uri=Uri.parse(url.getText().toString().trim());if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null||!(uri.getPath()==null||uri.getPath().isEmpty()||"/".equals(uri.getPath()))){url.setError("Introduce una dirección HTTPS sin rutas ni parámetros.");return;}base=uri.buildUpon().path("").build().toString();getPreferences(MODE_PRIVATE).edit().putString("server",base).apply();load();});
        mountSafe(box);
    }
    /** Insets belong to the parent: this physically resizes the WebView viewport. */
    private void mountSafe(View content) {
        FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.rgb(8,41,85));
        root.addView(content,new FrameLayout.LayoutParams(-1,-1));setContentView(root);
        if(android.os.Build.VERSION.SDK_INT>=30){
            root.setOnApplyWindowInsetsListener((v,insets)->{
                android.graphics.Insets safe=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()|WindowInsets.Type.ime());
                v.setPadding(safe.left,safe.top,safe.right,safe.bottom);
                return WindowInsets.CONSUMED;
            });
            root.post(root::requestApplyInsets);
        }else root.setFitsSystemWindows(true);
    }
    /** Public club content only. Never credentials or private member information. */
    private synchronized android.webkit.WebResourceResponse publicDataResponse(String filename,boolean refresh) {
        java.io.File cache=new java.io.File(getFilesDir(),filename.replace('/','_'));
        byte[] data=null;String source="bundled";
        try {
            if(!refresh&&cache.exists()&&System.currentTimeMillis()-cache.lastModified()<300000){data=java.nio.file.Files.readAllBytes(cache.toPath());source="cached";}
            if(data==null){
                HttpURLConnection connection=(HttpURLConnection)new URL("https://raw.githubusercontent.com/djyuanyo/CDMenciana/main/data/"+filename).openConnection();
                connection.setConnectTimeout(5000);connection.setReadTimeout(5000);connection.setInstanceFollowRedirects(false);
                try {
                    if(connection.getResponseCode()!=200)throw new java.io.IOException("Source unavailable");
                    try(InputStream input=connection.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()){
                        byte[] buf=new byte[4096];int count;while((count=input.read(buf))!=-1){if(output.size()+count>524288)throw new java.io.IOException("Data limit");output.write(buf,0,count);}data=output.toByteArray();
                    }
                    JSONObject parsed=new JSONObject(new String(data,StandardCharsets.UTF_8));int itemCount=parsed.getJSONArray(filename.startsWith("actas/")?"blocks":filename.equals("news.json")?"news":"matches").length();if(!filename.equals("news.json")&&itemCount==0)throw new java.io.IOException("Empty calendar");
                    java.nio.file.Files.write(cache.toPath(),data);source="live";
                }finally{connection.disconnect();}
            }
        }catch(Exception ignored){data=null;}
        if(data==null)try{data=java.nio.file.Files.readAllBytes(cache.toPath());source="cached";}catch(Exception ignored){}
        if(data==null)try(InputStream in=getAssets().open(filename);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);data=out.toByteArray();}catch(Exception ignored){}
        try{JSONObject json=new JSONObject(new String(data,StandardCharsets.UTF_8));json.put("connection_state",source);data=json.toString().getBytes(StandardCharsets.UTF_8);}catch(Exception ignored){data="{\"matches\":[],\"connection_state\":\"unavailable\"}".getBytes(StandardCharsets.UTF_8);}
        return new android.webkit.WebResourceResponse("application/json","UTF-8",new ByteArrayInputStream(data));
    }
    private boolean sameOrigin(Uri uri){Uri home=Uri.parse(base.isEmpty()?"https://appassets.androidplatform.net":base);return "https".equals(uri.getScheme())&&home.getHost().equalsIgnoreCase(uri.getHost())&&home.getPort()==uri.getPort();}
    private void load() {
        web=new WebView(this);
        mountSafe(web);web.setBackgroundColor(Color.rgb(8,41,85));
        WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(false);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient(){
            @Override public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest req){
                if(base.isEmpty() && "https".equals(req.getUrl().getScheme()) && "appassets.androidplatform.net".equals(req.getUrl().getHost())){
                    String path=req.getUrl().getPath();String name=path==null?"":path.substring(1);
                    if(name.matches("actas/[0-9]+\\.json")||"fixtures.json".equals(name)||"news.json".equals(name))return publicDataResponse(name,req.getUrl().getQueryParameter("refresh")!=null);
                    if(!name.matches("players/[a-f0-9]{16}\\.webp")&&!name.matches("crests/[a-f0-9]{16}\\.(png|jpg)")&&!java.util.Arrays.asList("index.html","style.css","offline.js","ui.js","fixtures.js","crest.png").contains(name))return new android.webkit.WebResourceResponse("text/plain","UTF-8",new java.io.ByteArrayInputStream(new byte[0]));
                    String mime=name.endsWith("html")?"text/html":name.endsWith("css")?"text/css":name.endsWith("js")?"application/javascript":name.endsWith("webp")?"image/webp":name.endsWith("jpg")?"image/jpeg":"image/png";
                    try{return new android.webkit.WebResourceResponse(mime,"UTF-8",getAssets().open(name));}catch(java.io.IOException ignored){}
                }return null;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){Uri uri=req.getUrl();if(req.isForMainFrame()&&sameOrigin(uri)&&"/__native__/settings".equals(uri.getPath())){configure();return true;}if(sameOrigin(uri))return false;if("https".equals(uri.getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}}return true;}
            @Override public void onReceivedError(WebView view,WebResourceRequest req,WebResourceError error){if(req.isForMainFrame())new AlertDialog.Builder(MainActivity.this).setTitle("No se puede conectar").setMessage("Comprueba tu conexión y que el servidor del club esté disponible.").setPositiveButton("Reintentar",(d,w)->web.loadUrl(base.isEmpty()?"https://appassets.androidplatform.net/index.html":base)).setNeutralButton("Cambiar servidor",(d,w)->configure()).show();}
        });web.loadUrl(base.isEmpty()?"https://appassets.androidplatform.net/index.html":base);
    }
    @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else new AlertDialog.Builder(this).setMessage("¿Salir de la app?").setPositiveButton("Salir",(d,w)->finish()).setNegativeButton("Cancelar",null).setNeutralButton("Servidor",(d,w)->{CookieManager.getInstance().removeAllCookies(null);getPreferences(MODE_PRIVATE).edit().remove("server").apply();configure();}).show();}
    @Override protected void onDestroy(){if(web!=null)web.destroy();super.onDestroy();}
}
