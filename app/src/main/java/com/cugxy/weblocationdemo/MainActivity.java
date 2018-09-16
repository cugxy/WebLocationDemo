package com.cugxy.weblocationdemo;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.support.v4.app.ActivityCompat;
import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

public class MainActivity extends AppCompatActivity {

    private WebView mWebVeiw;

    private ConfirmationDialogFragment  mLocationDialog = null;

    private static final String         FRAGMENT_PERMISSION = "permission";

    private String URL = "https://hqcode.gitee.io/cesium-test/lesson21/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        mWebVeiw = findViewById(R.id.webview);

        WebSettings settings = mWebVeiw.getSettings();
        settings.setJavaScriptEnabled(true);
        mWebVeiw.setWebChromeClient(new WebChromeClient(){
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, true);
                super.onGeolocationPermissionsShowPrompt(origin, callback);
            }
        });
        //mWebVeiw.loadUrl("file:///android_asset/web/location.html");
        mWebVeiw.loadUrl(URL);
    }

    @Override
    protected void onResume(){
        super.onResume();

        requestLocationPermission();
    }

    private void requestLocationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            //检查权限
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                    && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                return;
            } else if (ActivityCompat.shouldShowRequestPermissionRationale(this, Manifest.permission.ACCESS_COARSE_LOCATION)
                    && ActivityCompat.shouldShowRequestPermissionRationale(this, Manifest.permission.ACCESS_FINE_LOCATION)) {
                if (mLocationDialog == null){
                    mLocationDialog = ConfirmationDialogFragment.newInstance(R.string.location_permission_confirmation,
                            new String[]{Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION },
                            101,
                            R.string.location_permission_not_granted);
                }
                if (mLocationDialog != null){
                    mLocationDialog.show(getSupportFragmentManager(), FRAGMENT_PERMISSION);
                }
            }
            else {
                //请求权限
                ActivityCompat.requestPermissions(this,
                        new String[]{Manifest.permission.ACCESS_COARSE_LOCATION,
                                Manifest.permission.ACCESS_FINE_LOCATION},
                        101);
            }
        }
    }

}
