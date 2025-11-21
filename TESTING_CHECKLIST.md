# CrickSMA Live - Testing Checklist

## 🧪 Comprehensive Testing Guide

### ✅ Pre-Testing Setup

1. **Backend Server**
   - [ ] Backend server is running (`npm run dev` in backend folder)
   - [ ] Firebase is configured correctly
   - [ ] Environment variables are set

2. **Frontend Server**
   - [ ] Frontend dev server is running (`npm run dev`)
   - [ ] No build errors
   - [ ] No console errors on page load

### 🎯 Core Features Testing

#### 1. Admin Panel (Live Scoring)
- [ ] **Login/Authentication**
  - [ ] Can log in with admin credentials
  - [ ] Role-based access works
  - [ ] Logout works

- [ ] **Match Selection**
  - [ ] Can select a match
  - [ ] Match data loads correctly
  - [ ] Team lineups display

- [ ] **Toss Management**
  - [ ] Can set toss winner
  - [ ] Can set toss decision
  - [ ] Toss locks after match starts

- [ ] **Playing XI Setup**
  - [ ] Can set Team A Playing XI
  - [ ] Can set Team B Playing XI
  - [ ] Player selection works

- [ ] **Live Scoring**
  - [ ] ScoreButton components work (0, 1, 2, 3, 4, 6)
  - [ ] Wicket button opens modal
  - [ ] Wide button works
  - [ ] No-ball button opens modal
  - [ ] Free hit indicator shows correctly
  - [ ] Strike rotation works (odd runs, boundaries)
  - [ ] Over completion works (6 valid balls)
  - [ ] Score updates in real-time

- [ ] **Quick Edit Toolbar**
  - [ ] Undo Last Ball works
  - [ ] Edit Over modal opens
  - [ ] Manual Adjust modal opens

- [ ] **Summary Cards**
  - [ ] Batting card shows striker/non-striker
  - [ ] Bowling card shows bowler stats
  - [ ] Strike rate and economy display correctly

#### 2. Live Match Viewer
- [ ] **Match Display**
  - [ ] Match info loads correctly
  - [ ] Current score displays
  - [ ] Over count displays
  - [ ] Partnership shows

- [ ] **Graphs**
  - [ ] Manhattan graph displays (runs per over)
  - [ ] Worm graph displays (cumulative runs)
  - [ ] Graphs update in real-time

- [ ] **Commentary**
  - [ ] Commentary feed displays
  - [ ] Recent balls show correctly
  - [ ] Auto-scroll works

- [ ] **Scorecards**
  - [ ] Batting scorecard displays
  - [ ] Bowling scorecard displays
  - [ ] Player names are clickable
  - [ ] Dismissal text shows first names only

#### 3. Player Profile
- [ ] **Profile Display**
  - [ ] Player photo displays
  - [ ] Player info loads
  - [ ] Team and tournament info shows

- [ ] **Statistics**
  - [ ] Career stats calculate correctly
  - [ ] Batting summary displays
  - [ ] Bowling summary displays
  - [ ] Season-wise stats show

- [ ] **Performance Graphs**
  - [ ] Runs over matches graph displays
  - [ ] Wickets over matches graph displays
  - [ ] Graphs show cumulative and per-match data

- [ ] **Recent Matches**
  - [ ] Match list displays
  - [ ] Match links work
  - [ ] Performance data shows

#### 4. Home Page
- [ ] **Hero Section**
  - [ ] Hero displays correctly
  - [ ] Links work

- [ ] **Match Tabs**
  - [ ] Live matches tab works
  - [ ] Upcoming matches tab works
  - [ ] Finished matches tab works

- [ ] **Featured Sections**
  - [ ] Top performers display
  - [ ] Teams showcase displays
  - [ ] Recent highlights show

#### 5. Schedule Page
- [ ] **Match List**
  - [ ] Matches display correctly
  - [ ] Filter tabs work
  - [ ] Date-wise grouping works
  - [ ] Match cards are clickable

### 🔍 ICC Rule Engine Testing

#### Strike Rotation
- [ ] Odd runs rotate strike
- [ ] Even runs don't rotate strike
- [ ] Boundaries rotate strike
- [ ] Wickets rotate strike
- [ ] Byes/leg-byes follow run count

#### Over Completion
- [ ] Over completes after 6 valid balls
- [ ] Wides don't count as balls
- [ ] No-balls don't count as balls
- [ ] Byes/leg-byes count as balls

#### Free Hit Logic
- [ ] Free hit activates after no-ball
- [ ] Only run out, stumped, hit wicket allowed on free hit
- [ ] Other dismissals not allowed on free hit
- [ ] Free hit indicator shows correctly

#### Partnership Tracking
- [ ] Partnership runs track correctly
- [ ] Partnership balls track correctly
- [ ] Partnership resets on wicket

### 🎨 UI/UX Testing

#### Responsiveness
- [ ] Mobile view works (< 640px)
- [ ] Tablet view works (640px - 1024px)
- [ ] Desktop view works (> 1024px)
- [ ] Touch targets are large enough

#### Visual Design
- [ ] Premium design elements display
- [ ] Gradients render correctly
- [ ] Animations work smoothly
- [ ] Colors are consistent
- [ ] Icons display correctly

#### Performance
- [ ] Page loads quickly
- [ ] No lag on interactions
- [ ] Graphs render smoothly
- [ ] Real-time updates don't cause lag

### 🐛 Error Handling

- [ ] **Error Boundary**
  - [ ] Catches React errors
  - [ ] Shows error message
  - [ ] Allows recovery

- [ ] **API Errors**
  - [ ] Handles network errors
  - [ ] Shows user-friendly messages
  - [ ] Doesn't crash app

- [ ] **Data Errors**
  - [ ] Handles missing data
  - [ ] Handles invalid data
  - [ ] Shows fallback values

### 🔐 Security Testing

- [ ] **Authentication**
  - [ ] Protected routes require login
  - [ ] Role-based access works
  - [ ] Unauthorized access blocked

- [ ] **Data Validation**
  - [ ] Input validation works
  - [ ] Prevents invalid data entry
  - [ ] Sanitizes user input

### 📱 Browser Compatibility

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers

### 🚀 Performance Testing

- [ ] **Load Times**
  - [ ] Initial load < 3 seconds
  - [ ] Page transitions < 1 second
  - [ ] Graph rendering < 2 seconds

- [ ] **Memory**
  - [ ] No memory leaks
  - [ ] Cleanup on unmount
  - [ ] Efficient re-renders

### 📝 Test Results

**Date**: _______________
**Tester**: _______________
**Environment**: Development / Production

**Issues Found**:
1. 
2. 
3. 

**Status**: ✅ Pass / ❌ Fail / ⚠️ Needs Fix

---

## Quick Test Commands

```bash
# Start frontend
npm run dev

# Start backend (in backend folder)
cd backend && npm run dev

# Run linter
npm run lint

# Build for production
npm run build
```

## Test Data Requirements

- At least 1 live match
- At least 1 completed match
- At least 1 player with stats
- At least 1 squad with players
- Admin credentials for testing

