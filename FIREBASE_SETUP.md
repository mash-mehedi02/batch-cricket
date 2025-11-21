# Firebase Setup Guide

This guide will help you set up Firebase Firestore for the School Cricket Live project.

## Prerequisites

1. A Firebase account (sign up at https://firebase.google.com/)
2. Node.js and npm installed

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard
4. Enable Firestore Database:
   - Go to "Firestore Database" in the left sidebar
   - Click "Create database"
   - Choose "Start in test mode" (for development)
   - Select a location for your database

## Step 2: Enable Authentication

1. Go to "Authentication" in the left sidebar
2. Click "Get started"
3. Enable "Email/Password" sign-in method

## Step 3: Get Firebase Configuration

1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click the web icon (`</>`) to add a web app
4. Register your app with a nickname
5. Copy the Firebase configuration object

## Step 4: Configure Environment Variables

1. Create a `.env` file in the root directory:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id
```

2. Replace the values with your actual Firebase config

## Step 5: Install Dependencies

```bash
npm install
```

## Step 6: Set Up Firestore Collections

The following collections will be created automatically when you start using the app:

### Collections Structure:

1. **matches** - Live and past matches
   ```
   matches/{matchId}
   - team1: string
   - team2: string
   - score1: string (e.g., "145/3")
   - score2: string
   - overs1: string (e.g., "18.2")
   - overs2: string
   - wickets1: number
   - wickets2: number
   - status: "Live" | "Upcoming" | "Completed"
   - venue: string
   - date: string
   - createdAt: timestamp
   - updatedAt: timestamp
   ```

2. **commentary** (subcollection under matches)
   ```
   matches/{matchId}/commentary/{commentaryId}
   - text: string
   - batsman: string
   - bowler: string
   - over: string
   - ball: number
   - runs: number
   - timestamp: timestamp
   ```

3. **players** - Player profiles and stats
   ```
   players/{playerId}
   - name: string
   - role: string
   - batch: string
   - class: string
   - stats: object
     - matches: number
     - runs: number
     - wickets: number
     - strikeRate: number
     - etc.
   - pastMatches: array
   - createdAt: timestamp
   - updatedAt: timestamp
   ```

4. **admins** - Admin login info
   ```
   admins/{adminId}
   - email: string
   - name: string
   - role: string
   - createdAt: timestamp
   - updatedAt: timestamp
   ```

## Step 7: Set Up Firestore Security Rules

Go to Firestore Database > Rules and add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Matches - readable by all, writable by admins only
    match /matches/{matchId} {
      allow read: if true;
      allow write: if request.auth != null && 
                      exists(/databases/$(database)/documents/admins/$(request.auth.uid));
      
      // Commentary subcollection
      match /commentary/{commentaryId} {
        allow read: if true;
        allow write: if request.auth != null && 
                        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
      }
    }
    
    // Players - readable by all, writable by admins only
    match /players/{playerId} {
      allow read: if true;
      allow write: if request.auth != null && 
                      exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    
    // Admins - readable/writable by admins only
    match /admins/{adminId} {
      allow read, write: if request.auth != null && 
                            (request.auth.uid == adminId || 
                             exists(/databases/$(database)/documents/admins/$(request.auth.uid)));
    }
  }
}
```

## Step 8: Create First Admin User

You can create the first admin user through the Firebase Console or programmatically:

1. Go to Authentication > Users
2. Add a user with email and password
3. Go to Firestore Database
4. Create a document in the `admins` collection with the user's UID as the document ID
5. Add fields: `email`, `name`, `role: "admin"`

## Step 9: Test the Integration

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/admin` page
3. Try updating a match score
4. Check Firestore to see if data is being saved

## Real-time Updates

The app uses Firestore's `onSnapshot` for real-time updates:
- Live matches automatically refresh when scores change
- Commentary updates in real-time
- Player stats update automatically

## Troubleshooting

1. **"Firebase: Error (auth/unauthorized-domain)"**
   - Go to Authentication > Settings > Authorized domains
   - Add your domain (localhost for development)

2. **"Missing or insufficient permissions"**
   - Check your Firestore security rules
   - Ensure you're logged in as an admin

3. **Environment variables not loading**
   - Make sure `.env` file is in the root directory
   - Restart the dev server after creating `.env`
   - Variables must start with `VITE_` for Vite

## Production Deployment

Before deploying to production:

1. Update Firestore security rules for production
2. Set up proper authentication flow
3. Configure authorized domains
4. Set up Firebase Hosting (optional)
5. Enable Firebase Analytics (optional)

## Support

For Firebase documentation, visit: https://firebase.google.com/docs

