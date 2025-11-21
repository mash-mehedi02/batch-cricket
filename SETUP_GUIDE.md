# Complete Setup Guide

## Step-by-Step Setup Instructions

### 1. Frontend Setup

```bash
# Install frontend dependencies
npm install

# Create .env file (if not exists)
# Add these variables:
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_URL=http://localhost:5000/api
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install backend dependencies
npm install

# Create .env file
# Add these variables:
PORT=5000
NODE_ENV=development
FIREBASE_PROJECT_ID=your_project_id
FRONTEND_URL=http://localhost:5173
```

### 3. Firebase Admin SDK Setup

1. Open Firebase Console: https://console.firebase.google.com
2. Select your project
3. Go to **Project Settings** (gear icon)
4. Click **Service Accounts** tab
5. Click **Generate New Private Key**
6. Download the JSON file
7. Save it as: `backend/config/serviceAccountKey.json`

**⚠️ Important**: Never commit this file to Git!

### 4. Firestore Security Rules

1. Go to Firebase Console → Firestore Database
2. Click **Rules** tab
3. Copy the rules from `firestore.rules` file
4. Paste and click **Publish**

### 5. Create Admin User

1. Go to Firebase Console → Authentication
2. Click **Add user** or **Sign-in method** → Enable Email/Password
3. Add a new user with email and password
4. Copy the **User UID** (click on the user to see UID)
5. Go to Firestore → Create collection named `admin`
6. Create a document with:
   - **Document ID**: Paste the User UID (exact match required!)
   - **Fields**:
     ```
     email: "your-admin@email.com" (string)
     name: "Admin Name" (string)
     role: "admin" (string)
     createdAt: [timestamp] (current time)
     ```

### 6. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### 7. Access the Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- API Health Check: http://localhost:5000/health

### 8. Login as Admin

1. Go to http://localhost:5173/admin
2. Enter your admin email and password
3. You should now have access to:
   - Admin Dashboard: `/admin/dashboard`
   - Tournament Management: `/admin/tournaments`
   - Squad Management: `/admin/squads`
   - Player Management: `/admin/players`
   - Live Scoring: `/admin`

## Troubleshooting

### Backend won't start
- Check if `serviceAccountKey.json` exists in `backend/config/`
- Verify `.env` file has correct `FIREBASE_PROJECT_ID`
- Check if port 5000 is available

### Frontend can't connect to backend
- Verify backend is running on port 5000
- Check `VITE_API_URL` in frontend `.env`
- Check CORS settings in `backend/server.js`

### Admin login fails
- Verify admin document exists in Firestore `admin` collection
- Check Document ID matches User UID exactly
- Verify Firestore Security Rules are published
- Check browser console for errors

### "Missing or insufficient permissions" error
- Verify Firestore Security Rules are published
- Check admin document exists with correct UID
- Ensure user is authenticated (check Firebase Auth)

## Next Steps

1. Create your first tournament
2. Add squads for different batches
3. Add players to squads
4. Create matches
5. Start live scoring!

## Support

If you encounter issues, check:
- Browser console for errors
- Backend terminal for API errors
- Firebase Console for authentication/database issues

