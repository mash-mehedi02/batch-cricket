# Quick Test Guide

## 🚀 Quick Start Testing

### 1. Start Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
npm run dev
```

### 2. Test Routes (Open in Browser)

#### Public Routes
- ✅ `http://localhost:5173/` - Home page
- ✅ `http://localhost:5173/schedule` - Schedule page
- ✅ `http://localhost:5173/squad` - Squad page
- ✅ `http://localhost:5173/champions` - Champions page
- ✅ `http://localhost:5173/live/:matchId` - Live match (replace :matchId)
- ✅ `http://localhost:5173/match/:matchId` - Match details (replace :matchId)
- ✅ `http://localhost:5173/player/:playerId` - Player profile (replace :playerId)

#### Admin Routes
- ✅ `http://localhost:5173/admin` - Admin Panel (login)
- ✅ `http://localhost:5173/admin/dashboard` - Admin Dashboard
- ✅ `http://localhost:5173/admin/tournaments` - Tournament Management
- ✅ `http://localhost:5173/admin/squads` - Squad Management
- ✅ `http://localhost:5173/admin/players` - Player Management
- ✅ `http://localhost:5173/admin/matches` - Match Management

### 3. Key Features to Test

#### Admin Panel
1. **Login** - Use admin credentials
2. **Select Match** - Choose a live match
3. **Set Toss** - Set toss winner and decision
4. **Set Playing XI** - Set both team lineups
5. **Score a Ball** - Click scoring buttons (0, 1, 2, 3, 4, 6)
6. **Record Wicket** - Click W button, select wicket type
7. **Record Wide** - Click wd button
8. **Record No-ball** - Click nb button
9. **Check Free Hit** - After no-ball, verify free hit indicator
10. **Undo Last Ball** - Click undo button
11. **View Summary** - Check batting/bowling cards

#### Live Match Viewer
1. **View Match** - Open live match page
2. **Check Graphs** - Verify Manhattan and Worm graphs display
3. **Check Commentary** - Verify ball-by-ball commentary
4. **Check Scorecards** - Verify batting and bowling scorecards
5. **Click Player** - Click player name to go to profile

#### Player Profile
1. **View Profile** - Open player profile
2. **Check Stats** - Verify career stats display
3. **Check Graphs** - Verify performance graphs (runs & wickets)
4. **Check Seasons** - Verify season-wise stats
5. **Check Matches** - Verify recent matches list

### 4. Common Issues & Fixes

#### Issue: "Failed to fetch"
- **Fix**: Ensure backend server is running
- **Check**: Backend URL in API config

#### Issue: "Cannot read property of undefined"
- **Fix**: Check if data exists before accessing
- **Check**: Console for specific error

#### Issue: Graphs not displaying
- **Fix**: Check if match has ball events
- **Check**: Browser console for errors

#### Issue: Free hit not showing
- **Fix**: Record a no-ball first
- **Check**: Match status is "Live"

### 5. Browser Console Checks

Open browser DevTools (F12) and check:
- ✅ No red errors
- ✅ No warnings about missing dependencies
- ✅ Network requests succeed (200 status)
- ✅ Firebase connection works

### 6. Performance Checks

- ✅ Page loads in < 3 seconds
- ✅ No lag when clicking buttons
- ✅ Graphs render smoothly
- ✅ Real-time updates don't freeze UI

### 7. Mobile Testing

Test on mobile device or browser DevTools mobile view:
- ✅ Touch targets are large enough
- ✅ Layout is responsive
- ✅ Buttons are easy to tap
- ✅ Text is readable

## 🐛 Report Issues

If you find any issues:
1. Note the page/feature
2. Note the steps to reproduce
3. Check browser console for errors
4. Check network tab for failed requests
5. Take screenshot if possible

## ✅ Success Criteria

All tests pass if:
- ✅ All routes load without errors
- ✅ Admin panel can score matches
- ✅ Live viewer shows real-time updates
- ✅ Player profiles display correctly
- ✅ Graphs render properly
- ✅ No console errors
- ✅ Mobile responsive

---

**Happy Testing!** 🎉

