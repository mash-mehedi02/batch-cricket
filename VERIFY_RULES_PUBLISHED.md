# ✅ Verify Rules Are Actually Published

## 🔍 **Check If Rules Are Active:**

### **Step 1: Verify Rules Are Published (Not Just Displayed)**

In Firebase Console Rules page, check:

1. **"Last published" timestamp** should show recent time (like "Today • 3:52 am")
2. Click on that version → Should show "ACTIVE" badge
3. If it shows "DRAFT" or no active badge → Rules are NOT published!

### **Step 2: Publish Rules (If Not Already Published)**

1. In Rules editor, make sure you're viewing the latest version
2. Click **"Publish"** button (top right, red/blue button)
3. Wait for confirmation: **"Rules published successfully"**
4. You should see the timestamp update

### **Step 3: Verify Active Version**

After publishing:
- The version should show **"ACTIVE"** badge
- Timestamp should be recent (just now)
- Status should be "Published" not "Draft"

---

## ⚠️ **Important: Check Database Selection**

Firebase projects can have multiple databases:
- `(default)` - Main database
- Other named databases

Make sure you're deploying rules to the **correct database**:
1. In Firebase Console → Firestore Database
2. Check which database you're using (usually `(default)`)
3. Deploy rules to that database

---

## 🔄 **After Publishing Rules:**

1. **Wait 30-60 seconds** (Firebase needs time to propagate)
2. **Logout** from your app completely
3. **Clear browser cache** (Ctrl+Shift+Delete)
4. **Login** again to app
5. **Test** deleting a match

---

## 🧪 **Test If Rules Are Working:**

After logout/login, in browser console run:

```javascript
// Check if you can read admin doc (should work)
import { auth, db } from '@/config/firebase'
import { doc, getDoc, deleteDoc } from 'firebase/firestore'

const user = auth.currentUser
console.log('User UID:', user.uid)

// Try to read admin doc (should work)
const adminDoc = await getDoc(doc(db, 'admin', user.uid))
console.log('Can read admin doc:', adminDoc.exists())

// Try to read a match (should work - public read)
const matchesRef = collection(db, 'matches')
const matches = await getDocs(matchesRef)
console.log('Can read matches:', matches.size > 0)

// Try to delete a match (should work if admin)
// Only test this on a test match!
```

---

## 🚨 **If Rules Are Published But Still Not Working:**

1. **Check Database Name:**
   - App might be using a different database
   - Verify in `src/config/firebase.ts` - which database ID is used?

2. **Check Rules Syntax:**
   - Rules editor should show NO syntax errors
   - Red underlines = syntax errors

3. **Check Project ID:**
   - Make sure Firebase Console project = app project
   - Verify in `.env` file: `VITE_FIREBASE_PROJECT_ID`

4. **Hard Refresh:**
   - Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Clear all cache

5. **Check Auth Token:**
   - Logout completely
   - Close all browser tabs
   - Open fresh tab
   - Login again

---

## 📋 **Quick Checklist:**

- [ ] Rules show "ACTIVE" badge (not "DRAFT")
- [ ] "Last published" timestamp is recent
- [ ] Clicked "Publish" button and saw success message
- [ ] Waited 30-60 seconds after publishing
- [ ] Logged out completely from app
- [ ] Cleared browser cache
- [ ] Logged in again
- [ ] Tested deleting a match

