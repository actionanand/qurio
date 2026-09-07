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
console.log('Applied Qurio Android splash, system-bar themes, and R8 release optimization.');
