# Qurio Android build guide

Qurio uses Capacitor 8 and GitHub Actions to package the Angular/Ionic client as Android APK and AAB files. The generated `android/` directory is intentionally ignored because local builds and CI recreate it from the web client and the idempotent Android patch.

## Hosted authentication challenge

Android authentication loads `${environment.appUrl}/auth/challenge`; the production Turnstile widget therefore runs under the official hosted Qurio hostname, rather than the Capacitor WebView origin. `environment.androidApp.webViewOrigin` defines the expected Android parent origin for the message handshake only. It is not a Cloudflare Turnstile hostname allowlist entry.

The parent generates one random request ID, includes it in the hosted request, and sends an initialization message to the exact origin derived from `environment.appUrl`. The hosted page accepts initialization only from the configured WebView origin. It returns only the request ID and short-lived CAPTCHA token. The parent validates the hosted origin, iframe window, message type, request ID, and non-empty token; it removes its listener and two-minute timeout after completion, reset, timeout, or destruction. Email, passwords, Supabase session tokens, and the Turnstile secret never cross this channel.

Turnstile does not prove that the native client is a Play Store-signed Qurio APK. APK identity attestation would need a separate technology such as Play Integrity and is outside this integration.

## Build files

| File                                  | Purpose                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `capacitor.config.ts`                 | Qurio application ID, app name, web output, Android background, and splash behavior |
| `android-version.json`                | Monotonic Android `versionCode` and public `versionName`                            |
| `scripts/bump-android-version.js`     | Increments the version code and optionally the semantic version                     |
| `scripts/patch-android.mjs`           | Applies splash, deep links, biometric bridge, themes, and R8 optimization           |
| `scripts/generate-keystore.mjs`       | Creates the long-lived Qurio PKCS12 release keystore                                |
| `scripts/detect-keystore-format.mjs`  | Displays the format of a local keystore                                             |
| `.github/workflows/android-build.yml` | Builds, signs, verifies, stores, and uploads the APK and AAB                        |
| `src/assets/qurio.png`                | Canonical brand, launcher, splash, browser, and Play Store artwork                  |

## Required packages

Install dependencies from WSL2 before the first local Android build:

```bash
npm install
```

Qurio requires `@capacitor/android`, `@capacitor/splash-screen`, and the Capacitor 8 `@capacitor/local-notifications` plugin. The committed lockfile contains these dependencies so GitHub Actions can use `npm ci`.

## Local WSL2 workflow

Generate the native Android project once:

```bash
npm run android:add
```

After changing Angular code, Capacitor configuration, or the Android patch, rebuild and synchronize it:

```bash
npm run android:sync
```

Open the generated project from an environment with Android Studio:

```bash
npm run android:open
```

The `android:sync` command builds the web application, runs Capacitor sync, and reapplies the idempotent native patch. If `android/` is missing, run `android:add` first.

## App artwork

`src/assets/qurio.png` is the single source for Qurio branding. CI scales it inside each launcher canvas to preserve safe space for Android icon masks. It also creates the native splash image and `releases/playstore-icon.png`. Replace that source file when the brand artwork changes; do not manually maintain generated Android image files.

## Practice reminders and notification permission

On the first native Android launch, Qurio shows its own explanation once and requests the system notification permission only when the user chooses **Allow notifications**. Selecting **Not now** does not cause repeated prompts; Settings remains available for retrying later.

Users enable a weekly reminder and select a local time and weekdays in Settings. Qurio uses the application convention `1=Monday` through `7=Sunday`; `ReminderService` translates those values to the notification plugin's weekday enum. Preferences sync through `public.user_settings`, while permission and scheduled notifications stay on that Android device. The plugin schedules one recurring notification per selected day with deterministic IDs 7401–7407, cancelling that range before every reschedule.

The Android bridge checks and requests notification permission after Qurio's explanatory popup, avoiding a release-only Capacitor permission-reflection crash. The official Local Notifications plugin continues to own scheduling, persistence, delivery, and reboot handling. The Android patch supplies the monochrome `ic_stat_qurio` asset and does not generate a competing alarm receiver. Run `npm run android:sync` after changing notification configuration.

## Theme and saved credentials

Qurio sends the effective light or dark appearance to the native bridge whenever the user preference or system colour scheme changes. Android then updates status-bar and navigation-bar backgrounds and icon contrast together.

On Android, a successful sign-in offers the email and password to Google Password Manager through AndroidX Credential Manager. **Use saved credentials** opens the system credential selector and fills the login form; the user still completes CAPTCHA and explicitly submits the form. Qurio does not store the retrieved password in local storage, IndexedDB, Supabase, or its native preferences.

The Android Credential Manager bridge and its Gradle dependencies are generated by `scripts/patch-android-credentials.mjs`, which is run automatically by the main Android patch script.

## PIN, biometric unlock, and app links

The optional PIN lock stores a salted PBKDF2 verifier in browser IndexedDB, scoped to the signed-in Qurio user. A fresh browser launch locks the web client. The Android app also locks after it enters the background.

Android biometric unlock generates a random local unlock secret. Only its SHA-256 verifier is saved with the per-user browser record; the secret itself is encrypted with an authenticated AES key in Android Keystore. The bridge releases that secret after a successful `BiometricPrompt`, and Angular compares its verifier. The raw PIN is never sent to native storage or Supabase. A PIN remains the fallback if biometric authentication is unavailable or cancelled.

Android browsers receive a small Open Qurio prompt. Its package name, Play Store URL, and `qurio://` deep-link base are defined in both environment files. `scripts/patch-android.mjs` registers the `qurio` scheme in the generated Android manifest. Chrome uses an `intent://` URL so an installed app opens directly and otherwise falls back to:

`https://play.google.com/store/apps/details?id=com.actionanand.qurio.app`

## Versioning

```bash
npm run android:version
npm run android:version:patch
npm run android:version:minor
npm run android:version:major
```

The plain command increments only `versionCode`. The other commands increment `versionCode` and update the selected part of `versionName`. Google Play requires every uploaded build to have a greater `versionCode`.

The `main-android` workflow increments `versionCode`, commits `android-version.json` with `[skip ci]`, and builds with the checked-in `versionName`. Change `versionName` manually with one of the semantic-version commands before pushing when preparing a new public version.

## GitHub Actions and release files

Android builds run only from the `main-android` branch:

- A push to `main-android` starts a build.
- Manual workflow dispatch works only when the selected ref is `main-android`.
- CI runs `npm ci` and lint, then builds the production Angular client.
- CI recreates and patches `android/`, applies minimum SDK 24 and target SDK 36, and builds an APK and AAB.
- Release files include both version name and version code, such as `releases/Qurio-1-0-0-3.apk` and `releases/Qurio-1-0-0-3.aab`.
- Missing or invalid signing secrets produce `-unsigned.apk` and `-unsigned.aab` fallbacks.
- R8/resource shrinking is enabled and `Qurio-<version>-mapping.txt` is retained for Play Console deobfuscation.
- `playstore-icon.png`, APK, AAB, and mapping files are committed under `releases/` and uploaded as a 30-day Actions artifact.

CI uses Node 24.16, Java 21, minimum SDK 24, and target SDK 36.

## Release signing

Create the Qurio keystore once on a trusted WSL/Linux machine. The requested non-interactive command is supported:

```bash
npm run generate-keystore -- --password 'KEYSTORE_PASSWORD'
```

You can instead omit `--password` for a hidden prompt or set the `KEYSTORE_PASSWORD` environment variable. The generator creates `release-keystore.jks` with alias `qurio` and PKCS12 format.

Verify and encode it:

```bash
test -s release-keystore.jks
npm run keystore:type
base64 -w 0 release-keystore.jks > keystore.b64.txt
```

Configure these values in **GitHub repository → Settings → Secrets and variables → Actions**:

| Secret              | Value                                           |
| ------------------- | ----------------------------------------------- |
| `KEYSTORE_BASE64`   | Complete contents of `keystore.b64.txt`         |
| `KEYSTORE_PASSWORD` | Password used to generate the keystore          |
| `KEY_ALIAS`         | `qurio`                                         |
| `KEY_PASSWORD`      | Same password for the generated PKCS12 keystore |

Never commit the keystore, Base64 text, or passwords. The repository ignores `.jks`, `.keystore`, and `keystore.b64.txt`. Keep an offline backup of the keystore and password because losing the signing key can prevent future Play Store updates.

## Supabase authentication links

The Android package contains the production Angular environment. Email verification and password-recovery links therefore use the production `appUrl` configured in `src/environments/environment.prod.ts` and open through that allowed Supabase redirect. Keep the production Qurio URL in **Supabase Dashboard → Authentication → URL Configuration**. Native app links require a separate Android App Links setup and are not required for producing or installing the APK/AAB.

## Troubleshooting

- **`npm ci` reports a lock mismatch:** run `npm install` in WSL2 and commit the resulting lockfile.
- **Android platform is missing:** run `npm run android:add` before `npm run android:sync`.
- **Brand changes are absent:** rerun `npm run android:sync`; CI always regenerates all published icon files.
- **Unsigned output:** verify all four signing secrets, especially the `qurio` alias.
- **AAB version rejected:** increment the Android version before the next upload.
- **R8 mapping missing:** inspect the `android:patch` step and the release Gradle output; CI deliberately fails rather than publish an optimized build without its mapping file.
