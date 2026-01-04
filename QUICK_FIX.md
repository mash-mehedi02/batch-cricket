# 🚀 Quick Fix Guide

## ⚡ **3-Step Solution**

### **Step 1: Deploy Firestore Rules**

1. Open: https://console.firebase.google.com/project/sma-cricket-league/firestore/rules
2. Copy entire content from `firestore.rules` file
3. Paste into Rules editor
4. Click **"Publish"**

### **Step 2: Create Index (Click Error Link)**

When you see this error in browser console:
```
The query requires an index. You can create it here: https://console.firebase.google.com/...
```

1. **Click the link** in the error message
2. It will open Firebase Console with index pre-configured
3. Click **"Create Index"**
4. Wait 2-5 minutes for index to build

### **Step 3: Refresh Auth**

1. **Logout** from app
2. **Login** again
3. This refreshes your auth token

### **Step 4: Test**

1. Go to `/admin/matches`
2. Try deleting a match
3. ✅ Should work now!

---

## 🔍 **If Still Not Working:**

1. Check browser console for specific errors
2. Verify admin document exists: `admin/{your-uid}` in Firestore
3. Clear browser cache
4. Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)

---

## 📋 **What to Check:**

- ✅ Admin document exists in `admin` collection
- ✅ Firestore rules are deployed (check Rules tab)
- ✅ Indexes are created (check Indexes tab)
- ✅ You're logged in after deploying rules

