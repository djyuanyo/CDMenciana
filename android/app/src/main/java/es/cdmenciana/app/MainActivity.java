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

/** Native Android shell for the club's own hosted interface. No JS bridge. */
public class MainActivity extends Activity {
    private WebView web;
    private String base;
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setStatusBarColor(Color.rgb(8,41,85));
        base=getPreferences(MODE_PRIVATE).getString("server", "");
        if(base.isEmpty()) configure(); else load();
    }
    private void configure() {
        LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(40,70,40,40);box.setBackgroundColor(Color.rgb(240,244,248));
        TextView title=new TextView(this);title.setText("CD MENCIANA\nAPAGA Y VÁMONOS");title.setTextSize(26);title.setTextColor(Color.rgb(8,41,85));box.addView(title);
        TextView hint=new TextView(this);hint.setText("Conecta la app al servidor del club. Introduce la dirección HTTPS facilitada por administración.");hint.setPadding(0,30,0,30);box.addView(hint);
        EditText url=new EditText(this);url.setHint("https://app.tu-dominio.es");url.setSingleLine(true);url.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_URI);box.addView(url);
        Button connect=new Button(this);connect.setText("Conectar con el club");box.addView(connect);
        connect.setOnClickListener(v->{Uri uri=Uri.parse(url.getText().toString().trim());if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null||!(uri.getPath()==null||uri.getPath().isEmpty()||"/".equals(uri.getPath()))){url.setError("Introduce una dirección HTTPS sin rutas ni parámetros.");return;}base=uri.buildUpon().path("").build().toString();getPreferences(MODE_PRIVATE).edit().putString("server",base).apply();load();});
        setContentView(box);
    }
    private boolean sameOrigin(Uri uri){Uri home=Uri.parse(base);return "https".equals(uri.getScheme())&&home.getHost().equalsIgnoreCase(uri.getHost())&&home.getPort()==uri.getPort();}
    private void load() {
        web=new WebView(this);setContentView(web);
        if(android.os.Build.VERSION.SDK_INT>=30) web.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets bars=insets.getInsets(android.view.WindowInsets.Type.systemBars());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;});
        WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(false);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){Uri uri=req.getUrl();if(sameOrigin(uri))return false;if("https".equals(uri.getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}}return true;}
            @Override public void onReceivedError(WebView view,WebResourceRequest req,WebResourceError error){if(req.isForMainFrame())new AlertDialog.Builder(MainActivity.this).setTitle("No se puede conectar").setMessage("Comprueba tu conexión y que el servidor del club esté disponible.").setPositiveButton("Reintentar",(d,w)->web.loadUrl(base)).setNeutralButton("Cambiar servidor",(d,w)->configure()).show();}
        });web.loadUrl(base);
    }
    @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else new AlertDialog.Builder(this).setMessage("¿Salir de la app?").setPositiveButton("Salir",(d,w)->finish()).setNegativeButton("Cancelar",null).setNeutralButton("Servidor",(d,w)->{CookieManager.getInstance().removeAllCookies(null);getPreferences(MODE_PRIVATE).edit().remove("server").apply();configure();}).show();}
    @Override protected void onDestroy(){if(web!=null)web.destroy();super.onDestroy();}
}
