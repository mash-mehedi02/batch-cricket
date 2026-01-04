# ✅ Permission Issue Verification & Fix

## 🔍 **Step 1: Debug Permissions (Browser Console)**

1. Browser Console খুলুন (`F12`)
2. `/admin/settings` page-এ যান
3. **"🔍 Debug Permissions"** button click করুন
4. Console-এ detailed info দেখবেন

**Console-এ যা দেখবেন:**
- ✅ User logged in
- ✅ Admin document exists/not exists
- ✅ Auth store role
- ✅ Admin document path

---

## 🔍 **Step 2: Verify Firestore Rules Are Deployed**

### **Check 1: Firebase Console Rules Tab**

1. Go to: https://console.firebase.google.com/project/sma-cricket-league/firestore/rules
2. Rules editor-এ এই function থাকতে হবে:

```javascript
function isAdmin() {
  return request.auth != null && 
         exists(/databases/$(database)/documents/admin/$(request.auth.uid));
}
```

3. **Last published** timestamp check করুন
4. যদি rules outdated হয়, `firestore.rules` content copy করে paste করুন এবং **Publish** করুন

---

## 🔍 **Step 3: Verify Admin Document**

1. Go to: https://console.firebase.google.com/project/sma-cricket-league/firestore/data
2. `admin` collection খুলুন
3. আপনার User UID দিয়ে document আছে কিনা check করুন
4. Document path: `admin/{your-user-uid}`

**⚠️ Important:** Document ID **exactly** আপনার Firebase Auth UID হতে হবে

---

## 🔍 **Step 4: Check Browser Console for Errors**

Match delete করার সময় console-এ দেখুন:

```
🔍 Admin Permission Debug: {
  userLoggedIn: true,
  userId: "...",
  hasAdminDoc: true/false,  // ← এটা true হতে হবে
  adminDocPath: "admin/...",
  ...
}
```

---

## 🔧 **Common Issues & Fixes**

### **Issue 1: Admin Doc Exists But Permission Denied**

**Cause:** Firestore rules not deployed or outdated

**Fix:**
1. Firebase Console → Firestore → Rules tab
2. Copy `firestore.rules` content
3. Paste and **Publish**
4. Wait 1-2 minutes
5. **Logout & Login** again

---

### **Issue 2: Admin Doc Doesn't Exist**

**Fix:**
1. Firebase Console → Firestore → Data
2. Create `admin` collection (if doesn't exist)
3. Create document with ID = your User UID
4. Save (can leave empty or add `email` field)

---

### **Issue 3: Rules Deployed But Still Error**

**Possible Causes:**
1. Auth token not refreshed → **Logout & Login**
2. Browser cache → **Hard refresh** (`Ctrl+Shift+R`)
3. Wrong User UID in admin doc → Verify UID matches

---

### **Issue 4: Permission Denied on Admin Doc Read**

**Cause:** Rules syntax issue

**Check:** `firestore.rules` line 44 should be:
```javascript
allow read: if request.auth != null && request.auth.uid == adminId;
```

---

## 🧪 **Quick Test**

Browser Console-এ run করুন:

```javascript
// Test 1: Check if admin doc exists
import { debugAdminPermissions } from '@/utils/debugAdmin'
await debugAdminPermissions()

// Test 2: Manual check
import { auth, db } from '@/config/firebase'
import { doc, getDoc } from 'firebase/firestore'

const user = auth.currentUser
const adminDoc = await getDoc(doc(db, 'admin', user.uid))
console.log('Admin doc exists:', adminDoc.exists())
console.log('Admin doc data:', adminDoc.data())
```

---

## 📋 **Checklist**

- [ ] Admin document exists at `admin/{your-uid}` in Firestore
- [ ] Firestore rules deployed (check last publish time)
- [ ] Rules contain `isAdmin()` function with correct path
- [ ] Logged out and logged back in after deploying rules
- [ ] Browser console shows `hasAdminDoc: true` in debug output
- [ ] No cached auth token (cleared cache or hard refresh)

---

## 🚨 **Still Not Working?**

1. **Check Console** - Debug button click করে console output check করুন
2. **Verify Rules** - Firebase Console Rules tab-এ last published time check করুন
3. **Verify Admin Doc** - Firestore Data tab-এ document exists check করুন
4. **Clear Everything:**
   - Logout
   - Clear browser cache
   - Hard refresh (`Ctrl+Shift+R`)
   - Login again

