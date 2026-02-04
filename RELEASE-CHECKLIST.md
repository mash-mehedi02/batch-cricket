# 🚀 BatchCrick BD - Android Release Checklist

## ✅ Pre-Release Preparation (COMPLETED)

- [x] App version updated to 1.0.0
- [x] Build configuration optimized for release
- [x] ProGuard rules configured for Firebase & Capacitor
- [x] Code minification enabled
- [x] Resource shrinking enabled
- [x] App name set to "BatchCrick"
- [x] App ID: com.batchcrickbd

## 📦 Build Steps

### 1. Build Web Assets
```bash
npm run build
```
**Status**: ⏳ Running...

### 2. Sync to Android
```bash
npx cap sync android
```

### 3. Open in Android Studio
```bash
npx cap open android
```

### 4. Generate Signed APK/AAB

**For Play Store (Recommended)**:
- Build → Generate Signed Bundle / APK → Android App Bundle
- Select release variant
- Sign with your keystore

**For Direct Distribution**:
- Build → Generate Signed Bundle / APK → APK
- Select release variant  
- Sign with your keystore

## 🔑 Signing Key (First Time)

If you don't have a keystore yet:

```bash
keytool -genkey -v -keystore batchcrick-release.keystore -alias batchcrick -keyalg RSA -keysize 2048 -validity 10000
```

**IMPORTANT**: 
- Save keystore file securely
- Remember all passwords
- Backup the keystore file - you CANNOT publish updates without it!

## 🧪 Testing Checklist

Before releasing, test on a real device:

- [ ] App installs successfully
- [ ] Google Sign-In works
- [ ] Live scoring functions properly
- [ ] Match viewing works
- [ ] Notifications work
- [ ] Navigation is smooth
- [ ] No crashes or errors
- [ ] Performance is good

## 📱 Play Store Submission

1. Create app listing on Google Play Console
2. Upload AAB file
3. Add screenshots (phone + tablet)
4. Write app description
5. Set content rating
6. Add privacy policy
7. Submit for review

## 📊 Current Configuration

- **App Name**: BatchCrick
- **Package**: com.batchcrickbd
- **Version**: 1.0.0 (versionCode: 1)
- **Min SDK**: 22 (Android 5.1)
- **Target SDK**: Latest
- **Build Type**: Release (Optimized)

## 🎯 Next Steps

1. Wait for `npm run build` to complete
2. Run `npx cap sync android`
3. Open Android Studio
4. Generate signed APK/AAB
5. Test on device
6. Upload to Play Store (optional)

## 📝 Notes

- APK size will be optimized (~5-10 MB)
- First build may take 2-3 minutes
- Subsequent builds will be faster
- Always test signed builds before distribution
