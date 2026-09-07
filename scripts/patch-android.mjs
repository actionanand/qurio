#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const androidRoot = path.join(root, 'android');
if (!existsSync(androidRoot)) {
  console.error('android/ is missing. Run npm run android:add first.');
  process.exit(1);
}

const sourceIcon = path.join(root, 'src', 'assets', 'qurio.png');
if (!existsSync(sourceIcon)) {
  console.error('src/assets/qurio.png is missing. It is the canonical Qurio Android artwork.');
  process.exit(1);
}

const appRoot = path.join(androidRoot, 'app');
const resources = path.join(appRoot, 'src', 'main', 'res');
const drawableDirectory = path.join(resources, 'drawable-nodpi');
const drawableXmlDirectory = path.join(resources, 'drawable');
const gradlePath = path.join(appRoot, 'build.gradle');
const stylesPath = path.join(resources, 'values', 'styles.xml');
const nightStylesPath = path.join(resources, 'values-night', 'styles.xml');
const manifestPath = path.join(appRoot, 'src', 'main', 'AndroidManifest.xml');
const proguardPath = path.join(appRoot, 'proguard-rules.pro');
const javaDirectory = path.join(appRoot, 'src', 'main', 'java', 'com', 'actionanand', 'qurio', 'app');
const javaPath = path.join(javaDirectory, 'MainActivity.java');
const receiverPath = path.join(javaDirectory, 'QurioReminderReceiver.java');

await mkdir(drawableDirectory, { recursive: true });
await mkdir(drawableXmlDirectory, { recursive: true });
await copyFile(sourceIcon, path.join(drawableDirectory, 'qurio_splash_logo.png'));
for (const density of ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi']) {
  const directory = path.join(resources, density);
  await mkdir(directory, { recursive: true });
  await copyFile(sourceIcon, path.join(directory, 'ic_launcher.png'));
  await copyFile(sourceIcon, path.join(directory, 'ic_launcher_round.png'));
  await copyFile(sourceIcon, path.join(directory, 'ic_launcher_foreground.png'));
}
await writeFile(
  path.join(drawableXmlDirectory, 'qurio_splash_icon.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item
        android:width="168dp"
        android:height="168dp"
        android:gravity="center"
        android:drawable="@drawable/qurio_splash_logo" />
</layer-list>
`,
  'utf8',
);
await writeFile(
  path.join(drawableXmlDirectory, 'ic_stat_qurio.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF" android:pathData="M4,3h6c1.1,0 2,0.9 2,2v15c0,-1.1 -0.9,-2 -2,-2H4zM20,3h-6c-1.1,0 -2,0.9 -2,2v15c0,-1.1 0.9,-2 2,-2h6z" />
</vector>`,
  'utf8',
);

let manifest = await readFile(manifestPath, 'utf8');
for (const permission of ['android.permission.POST_NOTIFICATIONS', 'android.permission.RECEIVE_BOOT_COMPLETED']) {
  if (!manifest.includes(permission))
    manifest = manifest.replace(
      '<application',
      `    <uses-permission android:name="${permission}" />\n\n    <application`,
    );
}
if (!manifest.includes('QURIO_DEEP_LINK')) {
  const deepLink = `
            <!-- QURIO_DEEP_LINK -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="qurio" />
            </intent-filter>`;
  manifest = manifest.replace(/(\s*<\/activity>)/, `${deepLink}$1`);
}
if (!manifest.includes('QurioReminderReceiver')) {
  manifest = manifest.replace(
    '</application>',
    `        <receiver android:name=".QurioReminderReceiver" android:exported="false">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
            </intent-filter>
        </receiver>
    </application>`,
  );
}
await writeFile(manifestPath, manifest, 'utf8');

let gradle = await readFile(gradlePath, 'utf8');
gradle = gradle
  .replace(/minifyEnabled\s+false/, 'minifyEnabled true')
  .replace(
    /getDefaultProguardFile\(['"]proguard-android\.txt['"]\)/g,
    "getDefaultProguardFile('proguard-android-optimize.txt')",
  );
if (!gradle.includes('shrinkResources true')) {
  gradle = gradle.replace(/minifyEnabled\s+true/, 'minifyEnabled true\n            shrinkResources true');
}
if (!gradle.includes('androidx.biometric:biometric')) {
  gradle = gradle.replace(
    /dependencies\s*\{/,
    "dependencies {\n    implementation 'androidx.biometric:biometric:1.1.0'",
  );
}
await writeFile(gradlePath, gradle, 'utf8');

if (!/minifyEnabled\s+true/.test(gradle) || !gradle.includes('shrinkResources true')) {
  throw new Error(`Could not enable R8 release optimization in ${gradlePath}.`);
}
if (!/getDefaultProguardFile\(['"]proguard-android-optimize\.txt['"]\)/.test(gradle)) {
  throw new Error(`The optimized default ProGuard configuration is missing from ${gradlePath}.`);
}

const ensureThemes = async (filePath, dark) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  let styles = existsSync(filePath)
    ? await readFile(filePath, 'utf8')
    : '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n';
  const body = `    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="android:statusBarColor">${dark ? '#102c1e' : '#f3f7f1'}</item>
        <item name="android:navigationBarColor">${dark ? '#102c1e' : '#f3f7f1'}</item>
        <item name="android:windowLightStatusBar">${dark ? 'false' : 'true'}</item>
        <item name="android:windowLightNavigationBar">${dark ? 'false' : 'true'}</item>
    </style>
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">#f3f7f1</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/qurio_splash_icon</item>
        <item name="windowSplashScreenIconBackgroundColor">@android:color/transparent</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
        <item name="android:statusBarColor">#f3f7f1</item>
        <item name="android:navigationBarColor">#f3f7f1</item>
        <item name="android:windowLightStatusBar">true</item>
        <item name="android:windowLightNavigationBar">true</item>
    </style>`;
  styles = styles.replace(/\s*<style name="AppTheme\.NoActionBar"[\s\S]*?<\/style>/g, '');
  styles = styles.replace(/\s*<style name="AppTheme\.NoActionBarLaunch"[\s\S]*?<\/style>/g, '');
  styles = styles.replace('</resources>', `${body}\n</resources>`);
  await writeFile(filePath, styles, 'utf8');
};

await ensureThemes(stylesPath, false);
await ensureThemes(nightStylesPath, true);

let proguard = existsSync(proguardPath) ? await readFile(proguardPath, 'utf8') : '';
if (!proguard.includes('@android.webkit.JavascriptInterface <methods>'))
  proguard += `\n# Qurio native bridge methods called by the WebView.\n-keepclassmembers class * {\n    @android.webkit.JavascriptInterface <methods>;\n}\n`;
await writeFile(proguardPath, proguard, 'utf8');

await mkdir(javaDirectory, { recursive: true });
await writeFile(
  javaPath,
  `package com.actionanand.qurio.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.security.KeyStore;
import java.util.concurrent.Executor;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
  private static final int NOTIFICATION_PERMISSION_REQUEST = 7302;
  private static final String KEY_ALIAS = "qurio_biometric_key";
  private static final String SECURITY_PREFS = "qurio_security";
  private BiometricPrompt biometricPrompt;

  @Override protected void onCreate(Bundle state) {
    super.onCreate(state);
    getBridge().getWebView().addJavascriptInterface(new QurioNativeBridge(), "QurioNative");
  }

  @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
    if (requestCode == NOTIFICATION_PERMISSION_REQUEST) {
      boolean granted = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
      dispatch("notification-permission", true, granted ? "granted" : "denied", "");
      return;
    }
    super.onRequestPermissionsResult(requestCode, permissions, results);
  }

  private boolean notificationGranted() {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
  }

  private class QurioNativeBridge {
    @JavascriptInterface public boolean notificationPermissionGranted() { return notificationGranted(); }
    @JavascriptInterface public void requestNotificationPermission() {
      runOnUiThread(() -> {
        if (notificationGranted()) dispatch("notification-permission", true, "granted", "");
        else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
          requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
      });
    }
    @JavascriptInterface public void scheduleReminder(int hour, int minute, String days) {
      runOnUiThread(() -> {
        try {
          QurioReminderReceiver.scheduleAll(MainActivity.this, hour, minute, days);
          dispatch("reminder-schedule", true, "", "");
        } catch (Exception error) { dispatch("reminder-schedule", false, "", error.getMessage()); }
      });
    }
    @JavascriptInterface public void cancelReminder() {
      runOnUiThread(() -> QurioReminderReceiver.cancelAll(MainActivity.this));
    }
    @JavascriptInterface public boolean isBiometricAvailable() {
      return BiometricManager.from(MainActivity.this).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        == BiometricManager.BIOMETRIC_SUCCESS;
    }
    @JavascriptInterface public void disableBiometric() {
      getSharedPreferences(SECURITY_PREFS, MODE_PRIVATE).edit().clear().apply();
      try { KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null); store.deleteEntry(KEY_ALIAS); }
      catch (Exception ignored) { }
    }
    @JavascriptInterface public void enableBiometric(String secret) {
      runOnUiThread(() -> {
        try {
          disableBiometric();
          Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
          cipher.init(Cipher.ENCRYPT_MODE, createKey());
          showPrompt("Enable biometric unlock", cipher, () -> {
            try {
              byte[] encrypted = cipher.doFinal(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8));
              getSharedPreferences(SECURITY_PREFS, MODE_PRIVATE).edit()
                .putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .putString("secret", Base64.encodeToString(encrypted, Base64.NO_WRAP)).apply();
              dispatch("biometric-enabled", true, "", "");
            } catch (Exception error) { dispatch("biometric-enabled", false, "", error.getMessage()); }
          }, "biometric-enabled");
        } catch (Exception error) { dispatch("biometric-enabled", false, "", error.getMessage()); }
      });
    }
    @JavascriptInterface public void authenticateBiometric() {
      runOnUiThread(() -> {
        try {
          String iv = getSharedPreferences(SECURITY_PREFS, MODE_PRIVATE).getString("iv", "");
          String encrypted = getSharedPreferences(SECURITY_PREFS, MODE_PRIVATE).getString("secret", "");
          KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
          SecretKey key = (SecretKey) store.getKey(KEY_ALIAS, null);
          if (iv.isEmpty() || encrypted.isEmpty() || key == null) throw new IllegalStateException("Biometric unlock is unavailable.");
          Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
          cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
          showPrompt("Unlock Qurio", cipher, () -> {
            try {
              String secret = new String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)), java.nio.charset.StandardCharsets.UTF_8);
              dispatch("biometric-unlock", true, secret, "");
            } catch (Exception error) { dispatch("biometric-unlock", false, "", error.getMessage()); }
          }, "biometric-unlock");
        } catch (Exception error) { dispatch("biometric-unlock", false, "", error.getMessage()); }
      });
    }
  }

  private SecretKey createKey() throws Exception {
    KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(KEY_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setUserAuthenticationRequired(true).setInvalidatedByBiometricEnrollment(true);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
      builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
    else builder.setUserAuthenticationValidityDurationSeconds(-1);
    generator.init(builder.build());
    return generator.generateKey();
  }

  private void showPrompt(String title, Cipher cipher, Runnable success, String action) {
    if (biometricPrompt != null) { dispatch(action, false, "", "Authentication is already active."); return; }
    Executor executor = ContextCompat.getMainExecutor(this);
    biometricPrompt = new BiometricPrompt(this, executor, new BiometricPrompt.AuthenticationCallback() {
      @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
        biometricPrompt = null; success.run();
      }
      @Override public void onAuthenticationError(int code, CharSequence message) {
        biometricPrompt = null; dispatch(action, false, "", message.toString());
      }
    });
    BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder().setTitle(title)
      .setSubtitle("Confirm your identity on this device").setNegativeButtonText("Use PIN")
      .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG).build();
    biometricPrompt.authenticate(info, new BiometricPrompt.CryptoObject(cipher));
  }

  private void dispatch(String action, boolean success, String data, String message) {
    runOnUiThread(() -> getBridge().getWebView().evaluateJavascript(
      "window.dispatchEvent(new CustomEvent('qurio-native-result',{detail:{action:" + JSONObject.quote(action) +
      ",success:" + success + ",data:" + JSONObject.quote(data == null ? "" : data) +
      ",message:" + JSONObject.quote(message == null ? "" : message) + "}}));", null));
  }
}
`,
  'utf8',
);

await writeFile(
  receiverPath,
  `package com.actionanand.qurio.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.util.Calendar;

public class QurioReminderReceiver extends BroadcastReceiver {
  private static final String CHANNEL = "qurio-practice-reminders";
  private static final String ACTION = "com.actionanand.qurio.app.PRACTICE_REMINDER";
  private static final String PREFS = "qurio_reminders";
  private static final int BASE_ID = 7200;

  @Override public void onReceive(Context context, Intent intent) {
    if (intent == null || !ACTION.equals(intent.getAction())) { rebuild(context); return; }
    int day = intent.getIntExtra("day", 1), hour = intent.getIntExtra("hour", 18), minute = intent.getIntExtra("minute", 0);
    schedule(context, day, hour, minute);
    if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
    ensureChannel(context);
    Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    if (launch == null) launch = new Intent(context, MainActivity.class);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    PendingIntent content = PendingIntent.getActivity(context, BASE_ID + 20, launch, flags);
    NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(R.drawable.ic_stat_qurio).setColor(Color.parseColor("#176B4A"))
      .setContentTitle("Ready for a quick practice?")
      .setContentText("Open Qurio and keep your learning moving.")
      .setStyle(new NotificationCompat.BigTextStyle().bigText("Open Qurio and keep your learning moving."))
      .setContentIntent(content).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_DEFAULT);
    NotificationManagerCompat.from(context).notify(BASE_ID + day, notification.build());
  }

  static void scheduleAll(Context context, int hour, int minute, String days) {
    cancelAll(context);
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("enabled", true)
      .putInt("hour", hour).putInt("minute", minute).putString("days", days).apply();
    for (String raw : days.split(",")) try { schedule(context, Integer.parseInt(raw.trim()), hour, minute); }
    catch (NumberFormatException ignored) { }
  }

  static void cancelAll(Context context) {
    AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    for (int day = 1; day <= 7; day++) if (manager != null) manager.cancel(pending(context, day));
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("enabled", false).apply();
  }

  private static void rebuild(Context context) {
    android.content.SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    if (!prefs.getBoolean("enabled", false)) return;
    String days = prefs.getString("days", "");
    scheduleAll(context, prefs.getInt("hour", 18), prefs.getInt("minute", 0), days == null ? "" : days);
  }

  private static void schedule(Context context, int day, int hour, int minute) {
    if (day < 1 || day > 7) return;
    Calendar at = Calendar.getInstance();
    at.set(Calendar.DAY_OF_WEEK, day); at.set(Calendar.HOUR_OF_DAY, hour); at.set(Calendar.MINUTE, minute);
    at.set(Calendar.SECOND, 0); at.set(Calendar.MILLISECOND, 0);
    if (at.getTimeInMillis() <= System.currentTimeMillis()) at.add(Calendar.WEEK_OF_YEAR, 1);
    AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (manager != null) manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.getTimeInMillis(), pending(context, day));
  }

  private static PendingIntent pending(Context context, int day) {
    Intent intent = new Intent(context, QurioReminderReceiver.class).setAction(ACTION).putExtra("day", day);
    android.content.SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    intent.putExtra("hour", prefs.getInt("hour", 18)).putExtra("minute", prefs.getInt("minute", 0));
    return PendingIntent.getBroadcast(context, BASE_ID + day, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  private static void ensureChannel(Context context) {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager manager = context.getSystemService(NotificationManager.class);
    if (manager == null || manager.getNotificationChannel(CHANNEL) != null) return;
    NotificationChannel channel = new NotificationChannel(CHANNEL, "Practice reminders", NotificationManager.IMPORTANCE_DEFAULT);
    channel.setDescription("Reminders to practise with Qurio");
    manager.createNotificationChannel(channel);
  }
}
`,
  'utf8',
);

console.log('Applied Qurio splash, deep link, reminders, biometric bridge, system bars, and R8 optimization.');
