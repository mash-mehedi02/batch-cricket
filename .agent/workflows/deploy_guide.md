---
description: Deployment Guide for Vercel (Frontent) and Firebase (Backend)
---

# Deployment Guide

This project is a hybrid application:
1. **Frontend**: React (Vite) - Hosted on **Vercel**
2. **Backend**: Cloud Functions & Database - Hosted on **Firebase**

## Part 1: Deploy Backend (Firebase)

Since we have Cloud Functions for notifications and match logic, these **must** be deployed to Firebase separately. Vercel only hosts the website interface.

1.  **Login to Firebase** (if not managed):
    ```powershell
    firebase login
    ```

2.  **Initialize/Check Configuration**:
    Make sure you are pointing to the correct project:
    ```powershell
    firebase use sma-cricket-league
    ```
    *(Or whatever your production project ID is)*

3.  **Deploy Functions & Rules**:
    This command deploys the `functions` folder and `firestore.rules`.
    ```powershell
    firebase deploy --only functions,firestore,storage
    ```
    *Note: This might take a few minutes.*

## Part 2: Deploy Frontend (Vercel)

### Step 1: Connect to GitHub
Ensure your latest code is pushed to GitHub (you already did this).

### Step 2: Create Project in Vercel
1.  Go to [Vercel Dashboard](https://vercel.com/dashboard).
2.  Click **"Add New..."** -> **"Project"**.
3.  Import your GitHub repository (`batch-cricket`).

### Step 3: Configure Build Settings
Vercel should auto-detect "Vite", but double-check:
*   **Framework Preset**: `Vite`
*   **Root Directory**: `./` (default)
*   **Build Command**: `npm run build`
*   **Output Directory**: `dist`

### Step 4: Add Environment Variables
**CRITICAL**: You must add these variables in Vercel under **Settings > Environment Variables**. Copy the values from your local `.env` or `src/config/firebase.ts`.

| Variable Name | Description |
| :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Firebase API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | e.g. `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | e.g. `your-project-id` |
| `VITE_FIREBASE_STORAGE_BUCKET` | e.g. `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID for Notifications |
| `VITE_FIREBASE_APP_ID` | App ID |
| `VITE_FIREBASE_VAPID_KEY` | **Required** for Web Push Notifications |

*If you don't add these, the live site will show a blank white screen.*

### Step 5: Deploy
Click **"Deploy"**. Vercel will build your site and give you a live URL.

## Troubleshooting

*   **White Screen on Load?**
    *   Check the browser console (F12). If you see firebase connection errors, you likely missed an Environment Variable in Vercel.
*   **Notifications Not Working?**
    *   Ensure `functions` were successfully deployed to Firebase (Part 1).
    *   Ensure `VITE_FIREBASE_VAPID_KEY` is set in Vercel.
