# Firestore Rules & Indexes Deployment Guide

## 🔥 **Problems:**

1. **Missing or Insufficient Permissions** - Even though you've created the admin document, you're getting permission errors. This is because **Firestore Security Rules need to be deployed** to Firebase.

2. **Index Errors** - Squads query requires a composite index for `orderBy('year', 'desc'), orderBy('name')`.

## ✅ **Solution: Deploy Firestore Rules & Indexes**

### **Method 1: Firebase Console (Easiest)**

#### **Deploy Security Rules:**

1. Open [Firebase Console](https://console.firebase.google.com)
2. Select your project: **sma-cricket-league**
3. Go to **Firestore Database**
4. Click on the **"Rules"** tab (top navigation)
5. Copy the entire content from `firestore.rules` file
6. Paste it into the Rules editor
7. Click **"Publish"** button

#### **Create Composite Indexes:**

**Option A: Click the Error Link (Easiest)**
- When you see an index error in the browser console, click the link provided
- It will open Firebase Console with the index pre-configured
- Click "Create Index"

**Option B: Manual Setup**
1. Firebase Console → Firestore Database → **"Indexes"** tab
2. Click **"Create Index"**
3. For Squads index:
   - Collection ID: `squads`
   - Fields:
     - `year` - Descending
     - `name` - Ascending
   - Click **"Create"**

**Option C: Deploy indexes.json**
- Copy content from `firestore.indexes.json`
- Firebase Console → Firestore → Indexes → Import/Export → Import from file

### **Method 2: Firebase CLI (Recommended for Future)**

1. **Install Firebase CLI** (if not installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase** (if not already):
   ```bash
   firebase init firestore
   ```
   - Select your project
   - Use existing `firestore.rules` file
   - Use default `firestore.indexes.json`

4. **Deploy Rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

## 🔐 **Step 2: Refresh Auth Token**

After deploying rules, you need to refresh your authentication:

1. **Logout** from the app
2. **Login** again
3. This refreshes the auth token with the new permissions

## 🧪 **Test Permissions**

1. Go to `/admin/matches`
2. Try to delete a match
3. Should work without permission errors!

## 📝 **Verify Rules Are Deployed**

1. Firebase Console → Firestore Database → Rules tab
2. Check that the rules match `firestore.rules` file
3. Look for timestamp showing last publish time

## 🚨 **If Still Not Working**

1. Clear browser cache
2. Logout and login again
3. Check browser console for specific error messages
4. Verify admin document exists: `admin/{your-uid}`

