# 📱 Phone এ Test করার সহজ উপায়

## Option 1: Web Version Test (সবচেয়ে সহজ - এখনই করতে পারবেন!)

আপনার development server ইতিমধ্যে চলছে। আপনার phone এ test করতে:

### Step 1: আপনার Computer এর IP Address বের করা হয়েছে

আপনার IPv4 Address: **192.168.0.106**

### Step 2: Phone এ Browser খুলুন

আপনার phone এবং computer **same WiFi** তে থাকতে হবে।

Browser এ যান:
```
http://192.168.0.106:5173
```

✅ এখনই test করতে পারবেন - কোন build লাগবে না!

---

## Option 2: Android Studio দিয়ে APK Build (Recommended)

### Step 1: Android Studio খুলুন
```bash
npx cap open android
```

### Step 2: Debug APK Build করুন

Android Studio তে:
1. **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Wait for build to complete (2-3 minutes)
3. Click **locate** যখন notification আসবে

অথবা bottom right এ দেখুন:
```
Build → Build Output
```

### Step 3: APK Location

Build হলে পাবেন:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Step 4: Phone এ Transfer করুন

**Method A - USB Cable**:
1. Phone USB দিয়ে connect করুন
2. File transfer mode enable করুন
3. APK file copy করুন phone এ
4. File manager দিয়ে খুলে install করুন

**Method B - Email/WhatsApp**:
1. APK file নিজেকে email/WhatsApp করুন
2. Phone এ download করুন
3. Install করুন

**Method C - ADB (Direct Install)**:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Step 5: Install করুন

Phone এ:
1. Settings → Security → Unknown Sources enable করুন
2. APK file tap করুন
3. Install করুন

---

## Option 3: Expo/Capacitor Live Reload (Advanced)

আপনার phone এ live changes দেখতে চাইলে:

### Step 1: capacitor.config.ts Update করুন

```typescript
server: {
  url: 'http://YOUR_IP:5173',
  cleartext: true
}
```

### Step 2: Sync করুন
```bash
npx cap sync android
```

### Step 3: Android Studio থেকে Run করুন
- Phone USB দিয়ে connect করুন
- USB Debugging enable করুন
- Android Studio তে **Run** button click করুন

---

## 🎯 আমার Recommendation

**এখনই test করতে চাইলে**: Option 1 (Web Version)
- সবচেয়ে দ্রুত
- কোন build লাগবে না
- Same WiFi তে থাকলেই হবে

**Native features test করতে চাইলে**: Option 2 (Android Studio APK)
- Google Sign-In test করতে পারবেন
- Notifications test করতে পারবেন
- Full app experience

---

## 📝 Quick Commands

### Get your IP:
```bash
ipconfig
```

### Open Android Studio:
```bash
npx cap open android
```

### Install via ADB:
```bash
adb devices
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## ⚡ সবচেয়ে দ্রুত উপায়

1. PowerShell এ run করুন: `ipconfig`
2. IPv4 Address copy করুন
3. Phone এর browser এ যান: `http://YOUR_IP:5173`
4. Test করুন! 🎉

কোন WiFi তে আছেন সেটা নিশ্চিত করুন - computer এবং phone same network এ থাকতে হবে।
