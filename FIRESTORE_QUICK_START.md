# Firestore Quick Start (5 Minutes Setup)

## ✅ Step 1: Security Rules (2 minutes)

1. Go to: https://console.firebase.google.com/project/sma-cricket-league/firestore/rules
2. Copy content from `firestore.rules` file
3. Paste and click **Publish**

## ✅ Step 2: Enable Authentication (1 minute)

1. Go to: https://console.firebase.google.com/project/sma-cricket-league/authentication
2. Click **Get started**
3. Enable **Email/Password**
4. Click **Save**

## ✅ Step 3: Create First Admin (2 minutes)

### Option A: Via Firebase Console

1. **Authentication** → **Users** → **Add user**
   - Email: `admin@school.com`
   - Password: `Admin123!` (or your password)
   - **Add**

2. Copy the **UID** (e.g., `abc123xyz...`)

3. **Firestore Database** → **Start collection**
   - Collection ID: `admins`
   - Document ID: Paste the UID
   - Add fields:
     ```
     email: "admin@school.com" (string)
     name: "Admin" (string)
     role: "admin" (string)
     createdAt: [current timestamp]
     updatedAt: [current timestamp]
     ```
   - **Save**

### Option B: Via App (if signup available)

1. Run app: `npm run dev`
2. Go to `/admin`
3. Sign up with email/password
4. Admin document will be created automatically

## ✅ Step 4: Test (1 minute)

1. Open app: http://localhost:3000
2. Go to `/admin`
3. Login with admin credentials
4. Create a test match
5. Check if it appears on Home page

## 🎉 Done!

Your Firestore is now ready. Collections will be created automatically when you use the app.

---

## Collections Created Automatically:

- `matches` - When you create a match
- `matches/{id}/commentary` - When you add commentary
- `players` - When you add players
- `admins` - Already created manually

## Next Steps:

1. Create some test matches via Admin Panel
2. Add players to `players` collection
3. Test real-time updates
4. Deploy to Vercel

