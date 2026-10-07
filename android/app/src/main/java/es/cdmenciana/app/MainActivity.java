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
        @JavascriptInterface public void resolvePlayerProfile(String profileUrl,String playerKey) {
            if(playerKey==null||!playerKey.matches("[a-f0-9]{8,64}")||profileUrl==null||profileUrl.length()>2000)return;
            runOnUiThread(()->resolvePlayerProfileInWebView(profileUrl,playerKey));
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
                final String script="(function(){const wanted="+wanted+",norm=s=>String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/\\s+/g,' ').trim().toUpperCase(),people=wanted.map(name=>({name,key:norm(name)})),docs=[document];for(const frame of document.querySelectorAll('iframe')){try{if(frame.contentDocument)docs.push(frame.contentDocument)}catch(e){}}const all=sel=>docs.flatMap(d=>[...d.querySelectorAll(sel)]),absolute=(raw,base)=>{try{const u=new URL(raw,base||location.href),h=u.hostname.toLowerCase();if(u.protocol==='http:'&&(h==='rfaf.es'||h==='www.rfaf.es'||h.endsWith('.rfaf.es')||h.endsWith('.filesnovanet.es')))u.protocol='https:';return u.href}catch(e){return ''}},photoFor=node=>{const scopes=[],add=x=>{if(x&&!scopes.includes(x))scopes.push(x)};add(node);add(node.closest&&node.closest('tr'));add(node.closest&&node.closest('li'));add(node.closest&&node.closest('[class*=jug]'));add(node.closest&&node.closest('[id*=jug]'));add(node.closest&&node.closest('[class*=player]'));add(node.closest&&node.closest('[id*=player]'));let p=node.parentElement;for(let i=0;p&&i<4;i++,p=p.parentElement)add(p);const found=[];for(const scope of scopes){for(const img of scope.querySelectorAll?scope.querySelectorAll('img[src],img[data-src],img[data-original],img[data-lazy-src]'):[]){let raw=img.currentSrc||img.getAttribute('src')||img.getAttribute('data-src')||img.getAttribute('data-original')||img.getAttribute('data-lazy-src')||'',src=absolute(raw,img.baseURI||location.href);if(!src)continue;const meta=norm([src,img.className||'',img.id||'',img.alt||'',img.title||''].join(' '));let score=/\\/PIMG\\/JUGADORES\\//i.test(src)?100:/JUGADOR|FOTO|PHOTO|PLAYER|RETRATO/.test(meta)?35:0;if(/ESCUDO|LOGO|ICON|TARJ_|PUBLICIDAD|SOCIAL/.test(meta))score-=100;if((img.naturalWidth||img.width||0)>=50&&(img.naturalHeight||img.height||0)>=50)score+=10;found.push([score,src])}for(const el of scope.querySelectorAll?scope.querySelectorAll('[style*=background]'):[]){const bg=(el.ownerDocument?.defaultView||window).getComputedStyle(el).backgroundImage||'';if(!bg.startsWith('url('))continue;const raw=bg.slice(4,-1).replaceAll(String.fromCharCode(34),'').replaceAll(String.fromCharCode(39),''),src=absolute(raw,el.baseURI||location.href),meta=norm(src+' '+(el.className||'')+' '+(el.id||''));let score=/\\/PIMG\\/JUGADORES\\//i.test(src)?95:/JUGADOR|FOTO|PHOTO|PLAYER/.test(meta)?30:0;if(src)found.push([score,src])}}found.sort((a,b)=>b[0]-a[0]);return found[0]&&found[0][0]>=10?found[0][1]:''},out=[],seen=new Set();for(const node of all('a,[onclick],[data-href],[data-url]')){let raw=(node.getAttribute&&node.getAttribute('href')||'')+' '+(node.getAttribute&&node.getAttribute('onclick')||'')+' '+(node.getAttribute&&node.getAttribute('data-href')||'')+' '+(node.getAttribute&&node.getAttribute('data-url')||'')+' '+(node.onclick?String(node.onclick):'')+' '+String(node.outerHTML||'').slice(0,2600),id='',m=raw.match(/(?:[?&]|\\b)jugador\\s*(?:=|%3D)\\s*(-?\\d{1,12})/i);if(m)id=m[1];if(!id){const fn=raw.match(/(?:EstadisticasJugador|Jugador)[^(]{0,70}\\(([^)]{0,260})\\)/i);if(fn){const n=fn[1].match(/-?\\d{1,12}/);if(n)id=n[0]}}if(!id)continue;const text=norm(node.textContent||''),person=people.find(p=>text===p.key||text.includes(p.key)||p.key.includes(text));if(!person)continue;const key=person.key+'|'+id;if(seen.has(key))continue;seen.add(key);const pm=raw.match(/(?:[?&]|\\b)cod_primaria\\s*(?:=|%3D)\\s*(\\d{1,12})/i),primary=pm?pm[1]:'5000274',photo=photoFor(node);out.push({name:person.name,player_id:id,primary,url:(node.href||node.getAttribute&&node.getAttribute('href')||''),photo})}return JSON.stringify(out)})()";
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
    private Uri safePlayerProfileUri(String profileUrl) {
        try {
            Uri uri=Uri.parse(profileUrl);
            String host=uri.getHost(),path=uri.getPath(),player=uri.getQueryParameter("jugador"),primary=uri.getQueryParameter("cod_primaria");
            if(!"https".equals(uri.getScheme())||host==null||!("www.rfaf.es".equalsIgnoreCase(host)||"rfaf.es".equalsIgnoreCase(host))||uri.getUserInfo()!=null)return null;
            if(path==null||!path.matches("/pnfg/(?:NPcd/)?NFG_EstadisticasJugador"))return null;
            if(player==null||!player.matches("[0-9]{1,12}"))return null;
            if(primary==null||!primary.matches("[0-9]{1,12}"))return null;
            return uri;
        } catch(Exception ignored){return null;}
    }
    private void resolvePlayerProfileInWebView(String profileUrl,String playerKey) {
        final Uri profile=safePlayerProfileUri(profileUrl);
        if(profile==null){deliverResolvedProfile(playerKey,new JSONObject());return;}
        final String player=profile.getQueryParameter("jugador"),primary=profile.getQueryParameter("cod_primaria");
        final String acta=profile.getQueryParameter("codacta")==null?profile.getQueryParameter("CodActa"):profile.getQueryParameter("codacta");
        final WebView resolver=new WebView(this);
        final boolean[] done={false};final int[] stage={0};
        WebSettings settings=resolver.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(false);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setUserAgentString(publicUserAgent);
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(resolver,false);
        final String actaUrl=acta!=null&&acta.matches("[0-9]{1,12}")?"https://www.rfaf.es/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa="+acta+"&cod_acta="+acta:"";
        final Runnable fail=()->{if(done[0])return;done[0]=true;deliverResolvedProfile(playerKey,new JSONObject());resolver.stopLoading();resolver.destroy();};
        resolver.setWebViewClient(new WebViewClient(){
            @Override public void onPageFinished(WebView view,String url){
                if(done[0])return;
                if(stage[0]==0){stage[0]=1;if(!actaUrl.isEmpty()){view.loadUrl(actaUrl);return;}}
                if(stage[0]<=1){stage[0]=2;view.loadUrl(profileUrl);return;}
                if(stage[0]!=2)return;stage[0]=3;
                final String script="(function(){const clean=s=>String(s||'').replace(/\\s+/g,' ').trim(),upper=s=>clean(s).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase(),bad=/ESCUDO|LOGO|BANNER|COOKIE|PUBLICIDAD|SOCIAL|ICON|TARJ_/,docs=[document];for(const frame of document.querySelectorAll('iframe')){try{if(frame.contentDocument)docs.push(frame.contentDocument)}catch(e){}}const all=sel=>docs.flatMap(d=>[...d.querySelectorAll(sel)]),imgs=[];for(const img of all('img[src],img[data-src],img[data-original],img[data-lazy-src]')){const raw=img.currentSrc||img.src||img.getAttribute('data-src')||img.getAttribute('data-original')||img.getAttribute('data-lazy-src')||'';let src='';try{src=new URL(raw,img.baseURI||location.href).href}catch(e){}const meta=upper([src,img.className||'',img.id||'',img.alt||'',img.title||'',img.parentElement?.className||''].join(' '));if(!src||bad.test(meta))continue;let score=/\\/pimg\\/jugadores\\//i.test(src)?40:/JUGADOR|FUTBOLISTA|PLAYER|PERSONA|FOTO|PHOTO|RETRATO/.test(meta)?14:0;if(/\\/pimg\\/|NOVANET/.test(meta))score+=3;if((img.naturalWidth||img.width||0)>=80&&(img.naturalHeight||img.height||0)>=80)score+=4;if((img.naturalHeight||0)>(img.naturalWidth||0)*0.8)score+=2;imgs.push([score,src])}for(const el of all('[style*=background],[class*=jug],[class*=foto],[id*=jug],[id*=foto]')){const bg=(el.ownerDocument?.defaultView||window).getComputedStyle(el).backgroundImage||'';if(bg.startsWith('url(')){const src=bg.slice(4,-1).replaceAll(String.fromCharCode(34),'').replaceAll(String.fromCharCode(39),'');if(src&&!bad.test(upper(src))){try{imgs.push([12,new URL(src,el.baseURI||location.href).href])}catch(e){}}}}imgs.sort((a,b)=>b[0]-a[0]);const photo_source=imgs[0]?.[0]>=4?imgs[0][1]:'';const sections=[],fallback=[];let index=0;for(const table of all('table')){const rows=[...table.querySelectorAll('tr')].map(tr=>[...tr.children].filter(c=>/^(TD|TH)$/.test(c.tagName)).map(c=>clean(c.textContent)).slice(0,10)).filter(r=>r.some(Boolean));if(rows.length<1)continue;let title='';for(let el=table.previousElementSibling,tries=0;el&&tries<5;el=el.previousElementSibling,tries++){const t=clean(el.textContent);if(t&&t.length<180){title=t;break}}if(!title){const box=table.closest('.panel,.card,.well,.box,[class*=panel],[class*=card]');if(box){const h=box.querySelector('h1,h2,h3,h4,h5,h6,.panel-title,.card-title,strong');if(h)title=clean(h.textContent)}}const sample=upper(title+' '+rows.slice(0,6).flat().join(' '));let score=0;if(/COMPETICION|COMPETENCIA|LIGA|CAMPEONATO/.test(sample))score+=12;if(/TEMPORADA/.test(sample))score+=7;if(/ESTADIST/.test(sample))score+=8;if(/PARTIDOS JUGADOS|PJ\\b|MINUTOS|GOLES|TARJETAS|AMARILLAS|ROJAS|TITULARIDADES|CONVOCATORIAS/.test(sample))score+=6;if(/ACTA|DATOS DEL PARTIDO|ALINEACION|TITULARES|SUPLENTES|ARBITR|RESULTADO DEL PARTIDO/.test(upper(title)))score-=14;const numeric=rows.flat().filter(x=>/\\d/.test(x)).length,section={title:title||'Estadísticas de competición',rows:rows.slice(0,30),score,index:index++};if(score>=8)sections.push(section);else if(numeric>=3&&/PARTIDOS|PJ\\b|MINUTOS|GOLES|TARJETAS|TEMPORADA|COMPETICION/.test(sample)&&score>=0)fallback.push(section)}const statWord=x=>/PARTIDOS?|PJ|MINUTOS?|GOLES?|TITULAR(?:ES|IDADES)?|SUPLENTES?|CONVOCATORIAS?|AMARILLAS?|ROJAS?|TARJETAS?|TEMPORADA|COMPETICION|LIGA|CAMPEONATO/.test(upper(x));for(const dl of all('dl')){const rows=[];for(const dt of dl.querySelectorAll('dt')){const dd=dt.nextElementSibling;if(dd&&dd.tagName==='DD'&&statWord(dt.textContent)&&/[0-9]/.test(dd.textContent||''))rows.push([clean(dt.textContent),clean(dd.textContent)])}if(rows.length)sections.push({title:'Estadísticas de competición',rows,score:20,index:index++})}for(const box of all('[class*=estad],[id*=estad],[class*=stat],[id*=stat],[class*=dato],[id*=dato],li,p')){const text=clean(box.textContent);if(!text||text.length>260||!statWord(text)||!/[0-9]/.test(text))continue;const children=[...box.children].map(x=>clean(x.textContent)).filter(Boolean);const rows=[];for(let i=0;i<children.length-1;i++){if(statWord(children[i])&&/[0-9]/.test(children[i+1]))rows.push([children[i],children[i+1]])}if(rows.length)sections.push({title:'Estadísticas de competición',rows,score:18,index:index++})}for(const root of all('[class*=estad],[id*=estad],[class*=stat],[id*=stat]')){const lines=(root.innerText||'').split(String.fromCharCode(10)).map(clean).filter(Boolean),rows=[];for(let i=0;i<lines.length-1;i++){if(statWord(lines[i])&&/^[0-9][0-9.,%]*$/.test(lines[i+1]))rows.push([lines[i],lines[i+1]])}if(rows.length)sections.push({title:'Estadísticas de competición',rows,score:22,index:index++})}const chosen=(sections.length?sections:fallback).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,6).map(x=>({title:x.title,rows:x.rows}));return JSON.stringify({photo_source,stats:chosen})})()";
                final int[] attempts={0};final Runnable[] probe={null};
                probe[0]=()->view.evaluateJavascript(script,value->{if(done[0])return;JSONObject data=new JSONObject();try{Object decoded=new org.json.JSONTokener(value).nextValue();String raw=decoded instanceof String?(String)decoded:"{}";data=new JSONObject(raw);}catch(Exception ignored){}try{
                    String photoSource=data.optString("photo_source");
                    if(!photoSource.isEmpty()){java.net.URI imageUri=new java.net.URI(photoSource);String h=imageUri.getHost(),scheme=imageUri.getScheme();if(h!=null&&("rfaf.es".equalsIgnoreCase(h)||"www.rfaf.es".equalsIgnoreCase(h)||h.toLowerCase().endsWith(".rfaf.es")||h.toLowerCase().endsWith(".filesnovanet.es"))&&("https".equalsIgnoreCase(scheme)||"http".equalsIgnoreCase(scheme))){if("http".equalsIgnoreCase(scheme))photoSource=photoSource.replaceFirst("^http://","https://");data.put("photo_source",photoSource);data.put("photo",photoSource);}else{data.put("photo_source","");}}
                    data.put("updated_at",java.time.Instant.now().toString());
                }catch(Exception ignored){}
                boolean hasPhoto=!data.optString("photo").isEmpty(),hasStats=data.optJSONArray("stats")!=null&&data.optJSONArray("stats").length()>0;
                attempts[0]++;if((!hasPhoto||!hasStats)&&attempts[0]<10){view.postDelayed(probe[0],700);return;}
                done[0]=true;deliverResolvedProfile(playerKey,data);view.destroy();});
                view.postDelayed(probe[0],900);
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())fail.run();}
        });
        resolver.postDelayed(fail,22000);resolver.loadUrl("https://www.rfaf.es/");
    }
    private void deliverResolvedProfile(String playerKey,JSONObject data) {
        final String script="window.Fixtures&&window.Fixtures.applyResolvedProfile("+JSONObject.quote(playerKey)+","+data.toString()+");";
        if(web!=null)web.post(()->web.evaluateJavascript(script,null));
    }
    private synchronized void ensureFederationSession() throws Exception {
        long now=System.currentTimeMillis();
        if(now-federationSessionAt<300000L)return;
        readPublicFederation("https://www.rfaf.es/",federationCookies);
        federationSessionAt=now;
    }
    private android.webkit.WebResourceResponse publicPlayerResponse(String player,String acta,String primary) {
        if(player==null||acta==null||!player.matches("[0-9]{1,12}")||!acta.matches("[0-9]{1,12}"))return new android.webkit.WebResourceResponse("application/json","UTF-8",new ByteArrayInputStream("{}".getBytes(StandardCharsets.UTF_8)));
        if(primary==null||!primary.matches("[0-9]{1,12}"))primary="5000274";
        java.io.File cache=new java.io.File(getFilesDir(),"rfaf_player_"+player+"_"+acta+"_"+primary+".json");
        byte[] data=null;
        try {
            if(cache.exists()&&System.currentTimeMillis()-cache.lastModified()<86400000L)data=java.nio.file.Files.readAllBytes(cache.toPath());
            if(data==null){
                ensureFederationSession();
                String query="?cod_primaria="+primary+"&jugador="+player+"&codacta="+acta+"&nueva_ventana=";
                Exception last=null;String html=null;
                for(String prefix:new String[]{"https://www.rfaf.es/pnfg/NPcd/NFG_EstadisticasJugador","https://www.rfaf.es/pnfg/NFG_EstadisticasJugador"}){
                    try{
                        html=new String(readPublicFederation(prefix+query,federationCookies),java.nio.charset.Charset.forName("ISO-8859-15"));
                        if(html.length()<200||html.contains("No se ha aceptado el cookie"))throw new java.io.IOException("Player profile unavailable");
                        break;
                    }catch(Exception error){last=error;html=null;}
                }
                if(html==null)throw last==null?new java.io.IOException("Player profile unavailable"):last;
                JSONObject out=new JSONObject();out.put("player",player);out.put("acta",acta);out.put("primary",primary);out.put("html",html);out.put("updated_at",java.time.Instant.now().toString());
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
                    if(name.matches("rfaf-player/[0-9]{1,12}\\.json"))return publicPlayerResponse(name.substring(12,name.length()-5),req.getUrl().getQueryParameter("acta"),req.getUrl().getQueryParameter("primary"));
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
