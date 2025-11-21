# Cloudinary Setup Guide

## Step 1: Create Cloudinary Account

1. Go to [https://cloudinary.com](https://cloudinary.com)
2. Sign up for a free account
3. Verify your email

## Step 2: Get Your Cloud Name

1. After logging in, you'll see your **Cloud Name** in the dashboard
2. Copy it (e.g., `dxyz123abc`)

## Step 3: Create Unsigned Upload Preset

1. Go to **Settings** → **Upload** → **Upload presets**
2. Click **Add upload preset**
3. Configure:
   - **Preset name**: `player-photos-unsigned` (or any name)
   - **Signing mode**: **Unsigned** (important!)
   - **Folder**: `players` (optional, for organization)
   - **Allowed formats**: `jpg, png, gif, webp`
   - **Max file size**: `5MB` (or your preference)
   - **Transformation**: Optional (e.g., auto-crop, quality optimization)
4. Click **Save**

## Step 4: Add Environment Variables

Create a `.env` file in the root of your project:

```env
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
VITE_CLOUDINARY_UPLOAD_PRESET=player-photos-unsigned
```

**Important**: 
- Replace `your_cloud_name_here` with your actual Cloudinary cloud name
- Replace `player-photos-unsigned` with your preset name
- Never commit `.env` file to git (add it to `.gitignore`)

## Step 5: Restart Development Server

After adding environment variables, restart your dev server:

```bash
npm run dev
# or
yarn dev
```

## Step 6: Test the Upload

1. Go to Player Management page
2. Click "Create Player" or edit an existing player
3. Click "Choose Photo" in the PlayerPhotoUploader component
4. Select an image from device or take a photo
5. The image should upload and show a preview

## Troubleshooting

### Upload fails with 401/403 error
- Check that your upload preset is set to **Unsigned**
- Verify the preset name matches your `.env` file

### Upload fails with "Invalid preset"
- Double-check the preset name in `.env`
- Make sure the preset exists in your Cloudinary dashboard

### Image not showing after upload
- Check browser console for errors
- Verify the `secure_url` is being returned from Cloudinary
- Check Firestore to see if `photo` or `photoURL` field is saved

### CORS errors
- Cloudinary handles CORS automatically
- If you see CORS errors, check your Cloudinary settings

## Security Notes

- **Never** expose your Cloudinary API Secret in frontend code
- Use **Unsigned** upload presets for public uploads
- Set upload limits (file size, formats) in the preset
- Consider adding folder restrictions in the preset

## Example Cloudinary Preset Settings

```
Preset Name: player-photos-unsigned
Signing Mode: Unsigned
Folder: players
Allowed Formats: jpg, png, gif, webp
Max File Size: 5MB
Auto-folder: Enabled
Use filename: Enabled
Unique filename: Enabled
Eager transformations: 
  - w_400,h_400,c_fill,g_face (thumbnail)
  - w_800,h_800,c_limit (medium)
```

