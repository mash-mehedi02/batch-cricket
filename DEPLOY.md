# Quick Deployment Guide - Vercel

## Prerequisites

1. **GitHub Account** (recommended) or GitLab/Bitbucket
2. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
3. **Firebase Project** - Set up at [firebase.google.com](https://firebase.google.com)

## Step 1: Push to GitHub

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit - School Cricket Live Scoring"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/yourusername/school-cricket.git
git push -u origin main
```

## Step 2: Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
5. Click **"Deploy"**

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# For production deployment
vercel --prod
```

## Step 3: Configure Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables (from your Firebase project):

```
VITE_FIREBASE_API_KEY=AIzaSyBBspPU6lQyxbuU0Bt8L2UKEThGlmYHiYc
VITE_FIREBASE_AUTH_DOMAIN=sma-cricket-league.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://sma-cricket-league-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=sma-cricket-league
VITE_FIREBASE_STORAGE_BUCKET=sma-cricket-league.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=899272110972
VITE_FIREBASE_APP_ID=1:899272110972:web:62fe0c9bddf2129f7e6af9
VITE_FIREBASE_MEASUREMENT_ID=G-W2G5TD37XE
```

**Note**: The app will work without these variables in Vercel since the Firebase config has fallback values, but it's recommended to set them for better security and flexibility.

4. **Important**: After adding variables, redeploy:
   - Go to **Deployments** tab
   - Click the **"..."** menu on latest deployment
   - Select **"Redeploy"**

## Step 4: Verify Deployment

1. Visit your Vercel URL (e.g., `https://your-project.vercel.app`)
2. Check that:
   - Home page loads correctly
   - Navigation works
   - Firebase connection is established (check browser console)
   - Admin panel is accessible

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Verify Node.js version (Vercel uses Node 18.x by default)
- Check build logs in Vercel dashboard

### Firebase Not Working
- Verify all environment variables are set correctly
- Check Firebase project settings
- Ensure Firestore rules allow read access
- Check browser console for errors

### Routing Issues
- Verify `vercel.json` exists with rewrite rules
- Check that `dist` is set as output directory
- Ensure React Router is configured correctly

## Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. Wait for SSL certificate (automatic)

## Continuous Deployment

Once connected to GitHub:
- Every push to `main` branch = automatic production deployment
- Every push to other branches = preview deployment
- Pull requests = preview deployment with unique URL

## Performance Tips

- ✅ Code splitting is already configured
- ✅ Assets are optimized and minified
- ✅ Firebase vendor chunk is separated
- ✅ React vendor chunk is separated
- ✅ Gzip compression enabled automatically

## Support

For issues:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify Firebase configuration
4. Review `README.md` for setup instructions
