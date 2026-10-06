package es.cdmenciana.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
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

/** Native Android shell for the club's own hosted interface. The only JS bridge is offline-only and resolves public RFAF player links. */
public class MainActivity extends Activity {
    private WebView web;
    private String base;
    private String publicUserAgent;
    private final java.net.CookieManager federationCookies=new java.net.CookieManager(null,java.net.CookiePolicy.ACCEPT_ORIGINAL_SERVER);
    private long federationSessionAt=0L;
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
    /** Read public match reports directly when the scheduled copy is unavailable. */
    private android.webkit.WebResourceResponse publicReportResponse(String id,boolean refresh) {
        String filename="actas/"+id+".json";
        android.webkit.WebResourceResponse saved=publicDataResponse(filename,refresh);
        byte[] prior=new byte[0];boolean valid=false;
        try(InputStream in=saved.getData();ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);prior=out.toByteArray();
            JSONObject json=new JSONObject(new String(prior,StandardCharsets.UTF_8));
            valid=(json.optJSONArray("blocks")!=null&&json.getJSONArray("blocks").length()>0)||json.has("html");
            org.json.JSONArray players=json.optJSONArray("players");
            if(valid&&!json.has("html")&&(players==null||players.length()==0))valid=false;
        }catch(Exception ignored){}
        if(!valid||refresh)try {
            java.net.CookieManager cookies=new java.net.CookieManager(null,java.net.CookiePolicy.ACCEPT_ORIGINAL_SERVER);
            readPublicFederation("https://www.rfaf.es/",cookies);
            String roundSource="https://www.rfaf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=48466108&CodGrupo=48466109&CodTemporada=22&CodJornada=5";
            try {
                JSONObject fixtures=new JSONObject(new String(java.nio.file.Files.readAllBytes(new java.io.File(getFilesDir(),"fixtures.json").toPath()),StandardCharsets.UTF_8));
                org.json.JSONArray matches=fixtures.getJSONArray("round_matches");
                for(int i=0;i<matches.length();i++){JSONObject match=matches.getJSONObject(i);Uri link=Uri.parse(match.optString("acta_url"));if(id.equals(link.getQueryParameter("CodActa"))){String source=match.optString("source");Uri safe=Uri.parse(source);if("https".equals(safe.getScheme())&&"www.rfaf.es".equals(safe.getHost())&&"/pnfg/NPcd/NFG_CmpJornada".equals(safe.getPath()))roundSource=source;break;}}
            }catch(Exception ignored){}
            readPublicFederation(roundSource,cookies);
            String url="https://www.rfaf.es/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa="+id+"&cod_acta="+id;
            String html=new String(readPublicFederation(url,cookies),java.nio.charset.Charset.forName("ISO-8859-15"));
            if(!html.contains("Ficha de Partido"))throw new java.io.IOException("Acta unavailable");
            JSONObject data=new JSONObject();data.put("id",id);data.put("html",html);data.put("updated_at",java.time.Instant.now().toString());data.put("connection_state","official");
            prior=data.toString().getBytes(StandardCharsets.UTF_8);
            java.nio.file.Files.write(new java.io.File(getFilesDir(),filename.replace('/','_')).toPath(),prior);
        }catch(Exception ignored){}
        return new android.webkit.WebResourceResponse("application/json","UTF-8",new ByteArrayInputStream(prior));
    }
    private final class RfafResolverBridge {
        @JavascriptInterface public void resolveActaPlayers(String acta,String namesJson) {
            if(acta==null||!acta.matches("[0-9]{1,12}")||namesJson==null||namesJson.length()>12000)return;
            runOnUiThread(()->resolveActaPlayersInWebView(acta,namesJson));
        }
    }
    /** RFAF adds the player navigation after the page is rendered. Resolve those public IDs in an isolated WebView. */
    private void resolveActaPlayersInWebView(String acta,String namesJson) {
        final org.json.JSONArray names;
        try {
            names=new org.json.JSONArray(namesJson);
            if(names.length()==0||names.length()>40){deliverResolvedPlayers(acta,"[]");return;}
        } catch(Exception error){deliverResolvedPlayers(acta,"[]");return;}
        final WebView resolver=new WebView(this);
        final boolean[] done={false};final int[] stage={0};
        WebSettings settings=resolver.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(false);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setUserAgentString(publicUserAgent);
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(resolver,false);
        final String actaUrl="https://www.rfaf.es/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa="+acta+"&cod_acta="+acta;
        final String roundUrl="https://www.rfaf.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodCompeticion=48466108&CodGrupo=48466109&CodTemporada=22&CodJornada=5";
        final Runnable fail=()->{if(done[0])return;done[0]=true;deliverResolvedPlayers(acta,"[]");resolver.stopLoading();resolver.destroy();};
        resolver.setWebViewClient(new WebViewClient(){
            @Override public void onPageFinished(WebView view,String url){
                if(done[0])return;
                if(stage[0]==0){stage[0]=1;view.loadUrl(roundUrl);return;}
                if(stage[0]==1){stage[0]=2;view.loadUrl(actaUrl);return;}
                if(stage[0]!=2)return;stage[0]=3;
                final String wanted=names.toString();
                final String script="(function(){const wanted="+wanted+",norm=s=>String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/\\s+/g,' ').trim().toUpperCase(),people=wanted.map(name=>({name,key:norm(name)})),out=[],seen=new Set();for(const node of document.querySelectorAll('a,[onclick],[data-href],[data-url]')){let raw=(node.getAttribute&&node.getAttribute('href')||'')+' '+(node.getAttribute&&node.getAttribute('onclick')||'')+' '+(node.getAttribute&&node.getAttribute('data-href')||'')+' '+(node.getAttribute&&node.getAttribute('data-url')||'')+' '+(node.onclick?String(node.onclick):'')+' '+String(node.outerHTML||'').slice(0,2200),id='',m=raw.match(/(?:[?&]|\\b)jugador\\s*(?:=|%3D)\\s*(-?\\d{1,12})/i);if(m)id=m[1];if(!id){const fn=raw.match(/(?:EstadisticasJugador|Jugador)[^(]{0,70}\\(([^)]{0,260})\\)/i);if(fn){const n=fn[1].match(/-?\\d{1,12}/);if(n)id=n[0]}}if(!id)continue;const text=norm(node.textContent||''),person=people.find(p=>text===p.key||text.includes(p.key)||p.key.includes(text));if(!person)continue;const key=person.key+'|'+id;if(seen.has(key))continue;seen.add(key);out.push({name:person.name,player_id:id,url:(node.href||node.getAttribute&&node.getAttribute('href')||'')})}return JSON.stringify(out)})()";
                view.postDelayed(()->view.evaluateJavascript(script,value->{if(done[0])return;String rows="[]";try{Object decoded=new org.json.JSONTokener(value).nextValue();if(decoded instanceof String)rows=(String)decoded;new org.json.JSONArray(rows);}catch(Exception ignored){rows="[]";}done[0]=true;deliverResolvedPlayers(acta,rows);view.destroy();}),1200);
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())fail.run();}
        });
        resolver.postDelayed(fail,18000);resolver.loadUrl("https://www.rfaf.es/");
    }
    private void deliverResolvedPlayers(String acta,String rowsJson) {
        String rows="[]";try{new org.json.JSONArray(rowsJson);rows=rowsJson;}catch(Exception ignored){}
        final String script="window.Fixtures&&window.Fixtures.applyResolvedPlayers("+JSONObject.quote(acta)+","+rows+");";
        if(web!=null)web.post(()->web.evaluateJavascript(script,null));
    }
    private synchronized void ensureFederationSession() throws Exception {
        long now=System.currentTimeMillis();
        if(now-federationSessionAt<300000L)return;
        readPublicFederation("https://www.rfaf.es/",federationCookies);
        federationSessionAt=now;
    }
    private android.webkit.WebResourceResponse publicPlayerResponse(String player,String acta) {
        if(player==null||acta==null||!player.matches("[0-9]{1,12}")||!acta.matches("[0-9]{1,12}"))return new android.webkit.WebResourceResponse("application/json","UTF-8",new ByteArrayInputStream("{}".getBytes(StandardCharsets.UTF_8)));
        java.io.File cache=new java.io.File(getFilesDir(),"rfaf_player_"+player+"_"+acta+".json");
        byte[] data=null;
        try {
            if(cache.exists()&&System.currentTimeMillis()-cache.lastModified()<86400000L)data=java.nio.file.Files.readAllBytes(cache.toPath());
            if(data==null){
                ensureFederationSession();
                String query="?cod_primaria=3000328&jugador="+player+"&codacta="+acta+"&nueva_ventana=0";
                Exception last=null;String html=null;
                for(String prefix:new String[]{"https://www.rfaf.es/pnfg/NPcd/NFG_EstadisticasJugador","https://www.rfaf.es/pnfg/NFG_EstadisticasJugador"}){
                    try{
                        html=new String(readPublicFederation(prefix+query,federationCookies),java.nio.charset.Charset.forName("ISO-8859-15"));
                        if(html.length()<200||html.contains("No se ha aceptado el cookie"))throw new java.io.IOException("Player profile unavailable");
                        break;
                    }catch(Exception error){last=error;html=null;}
                }
                if(html==null)throw last==null?new java.io.IOException("Player profile unavailable"):last;
                JSONObject out=new JSONObject();out.put("player",player);out.put("acta",acta);out.put("html",html);out.put("updated_at",java.time.Instant.now().toString());
                data=out.toString().getBytes(StandardCharsets.UTF_8);java.nio.file.Files.write(cache.toPath(),data);
            }
        }catch(Exception ignored){
            try{if(cache.exists())data=java.nio.file.Files.readAllBytes(cache.toPath());}catch(Exception ignored2){}
        }
        if(data==null)data="{}".getBytes(StandardCharsets.UTF_8);
        return new android.webkit.WebResourceResponse("application/json","UTF-8",new ByteArrayInputStream(data));
    }
    private byte[] readPublicFederation(String address,java.net.CookieManager cookies) throws Exception {
        for(int hop=0;hop<6;hop++){
            java.net.URI uri=new java.net.URI(address);
            if(!"https".equals(uri.getScheme())||!("www.rfaf.es".equals(uri.getHost())||"rfaf.es".equals(uri.getHost()))||uri.getUserInfo()!=null)throw new java.io.IOException("Unsupported federation redirect");
            HttpURLConnection connection=(HttpURLConnection)uri.toURL().openConnection();
            connection.setConnectTimeout(8000);connection.setReadTimeout(8000);connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("User-Agent",publicUserAgent);connection.setRequestProperty("Accept","text/html");
            for(java.util.Map.Entry<String,java.util.List<String>> h:cookies.get(uri,java.util.Collections.emptyMap()).entrySet())connection.setRequestProperty(h.getKey(),String.join("; ",h.getValue()));
            try {
                int status=connection.getResponseCode();cookies.put(uri,connection.getHeaderFields());
                if(status==301||status==302||status==303||status==307||status==308){String location=connection.getHeaderField("Location");if(location==null)throw new java.io.IOException("Missing redirect");address=uri.resolve(location).toString();continue;}
                if(status!=200)throw new java.io.IOException("Federation response unavailable");
                try(InputStream in=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                    byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(out.size()+n>1048576)throw new java.io.IOException("Report size limit");out.write(b,0,n);}return out.toByteArray();
                }
            }finally{connection.disconnect();}
        }
        throw new java.io.IOException("Too many redirects");
    }
    private boolean sameOrigin(Uri uri){Uri home=Uri.parse(base.isEmpty()?"https://appassets.androidplatform.net":base);return "https".equals(uri.getScheme())&&home.getHost().equalsIgnoreCase(uri.getHost())&&home.getPort()==uri.getPort();}
    private void load() {
        publicUserAgent=WebSettings.getDefaultUserAgent(this);
        web=new WebView(this);
        mountSafe(web);web.setBackgroundColor(Color.rgb(8,41,85));
        WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(false);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if(base.isEmpty())web.addJavascriptInterface(new RfafResolverBridge(),"RfafResolver");
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient(){
            @Override public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest req){
                if(base.isEmpty() && "https".equals(req.getUrl().getScheme()) && "appassets.androidplatform.net".equals(req.getUrl().getHost())){
                    String path=req.getUrl().getPath();String name=path==null?"":path.substring(1);
                    if(name.matches("actas/[0-9]{1,12}\\.json"))return publicReportResponse(name.substring(6,name.length()-5),req.getUrl().getQueryParameter("refresh")!=null);
                    if(name.matches("rfaf-player/[0-9]{1,12}\\.json"))return publicPlayerResponse(name.substring(12,name.length()-5),req.getUrl().getQueryParameter("acta"));
                    if("fixtures.json".equals(name)||"news.json".equals(name))return publicDataResponse(name,req.getUrl().getQueryParameter("refresh")!=null);
                    if(!name.matches("players/[a-f0-9]{16}\\.webp")&&!name.matches("crests/[a-f0-9]{16}\\.(png|jpg)")&&!name.matches("rfaf-player/[0-9]{1,12}\\.json")&&!java.util.Arrays.asList("index.html","style.css","offline.js","ui.js","fixtures.js","crest.png").contains(name))return new android.webkit.WebResourceResponse("text/plain","UTF-8",new java.io.ByteArrayInputStream(new byte[0]));
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
