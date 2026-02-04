---
description: Build and prepare Android app for release
---

# Android App Release Guide

This workflow will help you build a production-ready Android APK/AAB for BatchCrick BD.

## Prerequisites

1. **Android Studio** installed
2. **Java JDK 17+** installed
3. **Node.js** and dependencies installed
4. **Signing Key** (keystore file) - required for release builds

## Step 1: Build Web Assets

```bash
npm run build
```

This creates optimized production files in the `dist` folder.

## Step 2: Sync Capacitor

```bash
npx cap sync android
```

This copies web assets to the Android project and updates native dependencies.

## Step 3: Open in Android Studio

```bash
npx cap open android
```

This opens the project in Android Studio.

## Step 4: Generate Signing Key (First Time Only)

If you don't have a keystore file yet, create one:

```bash
keytool -genkey -v -keystore batchcrick-release.keystore -alias batchcrick -keyalg RSA -keysize 2048 -validity 10000
```

**IMPORTANT**: Save the keystore file and passwords securely! You'll need them for all future releases.

## Step 5: Configure Signing in Android Studio

1. In Android Studio, go to **Build** → **Generate Signed Bundle / APK**
2. Select **Android App Bundle** (recommended for Play Store) or **APK**
3. Click **Next**
4. Choose your keystore file or create a new one
5. Enter keystore password, key alias, and key password
6. Click **Next**
7. Select **release** build variant
8. Check **V1 (Jar Signature)** and **V2 (Full APK Signature)**
9. Click **Finish**

## Step 6: Build Release APK/AAB

### Option A: Build AAB (for Google Play Store)

In Android Studio:
- **Build** → **Generate Signed Bundle / APK** → **Android App Bundle**

Or via command line:
```bash
cd BatchCrickBD
./gradlew bundleRelease
```

Output: `BatchCrickBD/app/build/outputs/bundle/release/app-release.aab`

### Option B: Build APK (for direct distribution)

In Android Studio:
- **Build** → **Generate Signed Bundle / APK** → **APK**

Or via command line:
```bash
cd BatchCrickBD
./gradlew assembleRelease
```

Output: `BatchCrickBD/app/build/outputs/apk/release/app-release.apk`

## Step 7: Test Release Build

Before distributing:

1. **Install on a real device** (not emulator):
   ```bash
   adb install BatchCrickBD/app/build/outputs/apk/release/app-release.apk
   ```

2. **Test all critical features**:
   - Google Sign-In
   - Live scoring
   - Match viewing
   - Notifications
   - Navigation

3. **Check performance**:
   - App size
   - Load times
   - Memory usage

## Step 8: Prepare for Play Store

1. **Create app listing** on Google Play Console
2. **Upload AAB file**
3. **Fill in store listing**:
   - App name: BatchCrick
   - Short description
   - Full description
   - Screenshots (phone + tablet)
   - Feature graphic
   - App icon

4. **Set content rating**
5. **Add privacy policy URL**
6. **Submit for review**

## Version Management

Current version: **1.0.0** (versionCode: 1)

For future updates, increment in `BatchCrickBD/app/build.gradle`:
- `versionCode` - increment by 1 for each release (1, 2, 3, ...)
- `versionName` - semantic versioning (1.0.0, 1.0.1, 1.1.0, 2.0.0, etc.)

## Troubleshooting

### Build fails with "Duplicate class" error
- Run: `cd BatchCrickBD && ./gradlew clean`
- Then rebuild

### Google Sign-In not working
- Verify SHA-1 fingerprint is added to Firebase Console
- Check `google-services.json` is in `BatchCrickBD/app/`

### App crashes on startup
- Check ProGuard rules in `proguard-rules.pro`
- Review crash logs: `adb logcat`

## Quick Release Checklist

- [ ] Update version in `build.gradle`
- [ ] Run `npm run build`
- [ ] Run `npx cap sync android`
- [ ] Test on real device
- [ ] Generate signed APK/AAB
- [ ] Test signed build
- [ ] Upload to Play Store (if applicable)

## Notes

- **APK Size**: Optimized with minification and resource shrinking
- **Security**: Code obfuscated with ProGuard
- **Performance**: Production build is significantly faster than debug
- **Distribution**: AAB is recommended for Play Store, APK for direct distribution
