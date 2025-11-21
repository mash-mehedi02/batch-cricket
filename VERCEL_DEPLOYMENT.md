# Vercel Deployment Guide

This guide will help you deploy the School Cricket Live website to Vercel and connect it to Firebase.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. A Firebase project set up (see `FIREBASE_SETUP.md`)
3. Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Prepare Your Project

1. **Ensure all files are committed to Git:**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   ```

2. **Push to your Git repository:**
   ```bash
   git push origin main
   ```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your Git repository
4. Vercel will auto-detect Vite configuration
5. Configure project settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **For production deployment:**
   ```bash
   vercel --prod
   ```

## Step 3: Configure Environment Variables

### In Vercel Dashboard:

1. Go to your project settings
2. Navigate to **"Environment Variables"**
3. Add the following variables:

```
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id
```

4. **Important**: Add these for all environments:
   - Production
   - Preview
   - Development

5. **Redeploy** after adding environment variables

### Via Vercel CLI:

```bash
vercel env add VITE_FIREBASE_API_KEY
vercel env add VITE_FIREBASE_AUTH_DOMAIN
vercel env add VITE_FIREBASE_PROJECT_ID
vercel env add VITE_FIREBASE_STORAGE_BUCKET
vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID
vercel env add VITE_FIREBASE_APP_ID
```

## Step 4: Configure Firebase for Production

### 1. Update Authorized Domains

1. Go to Firebase Console → Authentication → Settings
2. Add your Vercel domain to **Authorized domains**:
   - `your-project.vercel.app`
   - `your-custom-domain.com` (if you have one)

### 2. Update Firestore Security Rules

Ensure your Firestore rules allow public read access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Matches - readable by all, writable by admins only
    match /matches/{matchId} {
      allow read: if true;
      allow write: if request.auth != null && 
                      exists(/databases/$(database)/documents/admins/$(request.auth.uid));
      
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

## Step 5: Optimize for Production

The project is already optimized with:

- ✅ Code splitting (React and Firebase vendors)
- ✅ Minification and tree-shaking
- ✅ Mobile-responsive design
- ✅ Optimized build output
- ✅ Cache headers for static assets
- ✅ Meta tags for mobile optimization

## Step 6: Test Your Deployment

1. **Visit your Vercel URL**: `https://your-project.vercel.app`
2. **Test real-time updates**:
   - Open admin panel in one tab
   - Open home page in another tab
   - Update a score and verify it updates instantly
3. **Test mobile responsiveness**:
   - Use browser dev tools (mobile view)
   - Test on actual mobile device
   - Verify touch interactions work

## Step 7: Custom Domain (Optional)

1. Go to Vercel project settings → Domains
2. Add your custom domain
3. Update Firebase authorized domains
4. Update DNS records as instructed by Vercel

## Mobile Optimization Features

The site includes:

- ✅ Responsive design (mobile-first)
- ✅ Touch-friendly buttons (min 44x44px)
- ✅ Optimized font sizes for mobile
- ✅ Smooth scrolling
- ✅ Mobile meta tags
- ✅ PWA-ready (can be extended)

## Performance Optimizations

- **Code Splitting**: React and Firebase loaded separately
- **Lazy Loading**: Components load on demand
- **Asset Optimization**: Images and fonts optimized
- **Caching**: Static assets cached for 1 year
- **Minification**: Production builds are minified

## Monitoring

1. **Vercel Analytics**: Enable in project settings
2. **Firebase Analytics**: Already integrated
3. **Error Tracking**: Check Vercel logs for errors

## Troubleshooting

### Build Fails

1. Check build logs in Vercel dashboard
2. Ensure all dependencies are in `package.json`
3. Verify Node.js version (Vercel uses Node 18+ by default)

### Environment Variables Not Working

1. Ensure variables start with `VITE_`
2. Redeploy after adding variables
3. Check variable names match exactly

### Firebase Connection Issues

1. Verify environment variables are set correctly
2. Check Firebase authorized domains
3. Verify Firestore security rules
4. Check browser console for errors

### Mobile Issues

1. Test in browser dev tools mobile view
2. Check viewport meta tag
3. Verify touch targets are large enough
4. Test on actual devices

## Continuous Deployment

Vercel automatically deploys on every push to your main branch:

1. Push to GitHub/GitLab/Bitbucket
2. Vercel detects changes
3. Builds and deploys automatically
4. Preview deployments for pull requests

## Production Checklist

- [ ] Environment variables configured
- [ ] Firebase authorized domains updated
- [ ] Firestore security rules set
- [ ] Custom domain configured (if applicable)
- [ ] Mobile responsiveness tested
- [ ] Real-time updates tested
- [ ] Admin panel tested
- [ ] Error handling verified
- [ ] Performance optimized
- [ ] Analytics enabled

## Support

- Vercel Docs: https://vercel.com/docs
- Firebase Docs: https://firebase.google.com/docs
- Project Issues: Check GitHub repository

Your School Cricket Live website is now deployed and ready! 🚀

