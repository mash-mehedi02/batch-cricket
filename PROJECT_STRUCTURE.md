# CrickSMA Live - Complete Project Structure

## 📁 Folder Architecture

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Basic UI components (Button, Card, Badge)
│   ├── skeletons/     # Loading skeleton components
│   ├── ErrorBoundary.jsx
│   ├── Navbar.jsx
│   ├── OverSummary.jsx
│   ├── PlayerPhotoUploader.jsx
│   └── RecentOvers.jsx
│
├── pages/            # Page components
│   ├── admin/        # Admin pages
│   │   ├── AdminDashboard.jsx
│   │   ├── MatchManagement.jsx
│   │   ├── PlayerManagement.jsx
│   │   ├── SquadManagement.jsx
│   │   └── TournamentManagement.jsx
│   ├── AdminPanel.jsx
│   ├── Champion.jsx
│   ├── Home.jsx
│   ├── LiveMatch.jsx
│   ├── MatchDetails.jsx
│   ├── PlayerProfile.jsx
│   ├── Schedule.jsx
│   └── Squad.jsx
│
├── hooks/            # Custom React hooks
│   ├── useAuth.js
│   └── useProtectedRoute.js
│
├── layouts/          # Layout components
│   ├── MainLayout.jsx
│   └── ProtectedRoute.jsx
│
├── services/         # Service layer
│   ├── firestore/    # Firestore services
│   │   ├── base.js
│   │   ├── tournamentsService.js
│   │   ├── squadsService.js
│   │   ├── playersService.js
│   │   └── matchesService.js
│   ├── cloudinary/   # Cloudinary services
│   │   └── uploader.js
│   ├── adminsService.js
│   ├── api.js
│   ├── matchesService.js
│   └── playersService.js
│
├── utils/            # Utility functions
│   ├── statsCalculator.js
│   └── cache.js
│
├── types/            # Type definitions & constants
│   └── index.js
│
├── config/           # Configuration
│   └── firebase.js
│
├── contexts/          # React contexts
│   └── FirebaseContext.jsx
│
├── App.jsx           # Main app component
└── main.jsx          # Entry point
```

## 🔥 Key Features Implemented

### ✅ Core Infrastructure
- [x] Complete folder structure
- [x] Centralized Firestore service layer
- [x] Stat calculator utilities
- [x] Cloudinary uploader module
- [x] Reusable UI components
- [x] Role-based route protection
- [x] SessionStorage caching

### ✅ Authentication & Authorization
- [x] Firebase Auth integration
- [x] Role-based access control (admin, scorer, viewer)
- [x] Protected routes component
- [x] useAuth hook

### ✅ Admin Dashboard
- [x] Summary statistics (players, matches, tournaments)
- [x] Live matches count
- [x] Completed/upcoming matches
- [x] Quick action cards

### ✅ Services Layer
- [x] Base Firestore CRUD operations
- [x] Tournaments service
- [x] Squads service
- [x] Players service
- [x] Matches service
- [x] Real-time subscriptions (onSnapshot)

### ✅ UI Components
- [x] Button component (variants, sizes, loading)
- [x] Card component (hover effects)
- [x] Badge component (variants, sizes)
- [x] Skeleton loaders (Card, Table)

## 🚀 Performance Optimizations

1. **Caching**: SessionStorage for schedule, squads, tournaments
2. **Real-time Updates**: onSnapshot for live data
3. **Lazy Loading**: Ready for React.lazy implementation
4. **Memoization**: Ready for React.memo on heavy components
5. **Indexed Queries**: All Firestore queries use indexed fields

## 📝 Environment Variables Required

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
VITE_API_URL=http://localhost:5050/api
```

## 🔐 Security

- Role-based route protection
- Firebase security rules (firestore.rules)
- Protected admin routes
- Token-based API authentication

## 📊 Statistics Calculation

All stats calculated using centralized utilities:
- Batting average, strike rate
- Bowling average, economy, strike rate
- Net Run Rate (NRR)
- Points table calculation
- Player career stats aggregation

## 🎨 Design System

- Tailwind CSS for styling
- Mobile-first responsive design
- Consistent color scheme
- Reusable components
- Loading states with skeletons

