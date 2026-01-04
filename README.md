# BatchCrick BD - Intelligent School Cricket Platform

A complete, ICC-compliant real-time cricket scoring ecosystem for school cricket tournaments in Bangladesh.

## 🚀 Technology Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **Routing**: React Router v6
- **Backend**: Firebase (Firestore, Auth, Storage, Cloud Functions)
- **Hosting**: Vercel / Firebase Hosting

## 📦 Project Structure

```
batchcrick-bd/
├── src/
│   ├── components/        # Reusable UI components
│   ├── pages/            # Page components
│   ├── engine/           # Core calculation engines
│   ├── services/         # Firebase service layers
│   ├── store/            # Zustand stores
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions (ICC rules, formatters)
│   ├── types/            # TypeScript type definitions
│   └── config/           # Configuration files
├── functions/            # Firebase Cloud Functions
├── public/               # Static assets
└── tests/                # Test files
```

## 🎯 Core Features

### ✅ Tournament Management
- Create/Edit/Delete tournaments
- Year-based filtering
- Automatic season archiving

### ✅ Squad Management
- Create squads linked to tournaments
- Add/Remove players
- Squad gallery UI

### ✅ Player Management
- Player profiles with photos
- Career stats tracking
- Season-wise statistics

### ✅ Live Match Scoring
- ICC-compliant ball-by-ball scoring
- Real-time updates via Firestore
- Automatic statistics calculation

### ✅ Scoreboard & Scorecard
- CREX-style live scoreboard
- Full scorecard with batting/bowling tables
- Fall of wickets tracking

### ✅ AI Insights
- Win probability calculations
- Projected scores
- Recommended bowler suggestions

## 🔥 Setup Instructions

### Prerequisites
- Node.js 18+
- Firebase account
- Vercel account (for hosting)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Firebase config

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Environment Variables

Create `.env.local`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## 🏗️ Firebase Setup

### Firestore Structure

```
tournaments/{tournamentId}
squads/{squadId}
players/{playerId}
matches/{matchId}
matches/{matchId}/innings/{inningId}
matches/{matchId}/innings/{inningId}/balls/{ballId}
matches/{matchId}/commentary/{commentaryId}
```

### Cloud Functions

Deploy functions:
```bash
cd functions
npm install
npm run deploy
```

Functions:
- `onBallWrite` - Triggers innings recalculation
- `finalizeMatch` - Updates player and squad stats
- `updatePlayerStats` - Aggregates player career stats

## 📱 Features Overview

### Live Scoring (Admin)
- Real-time ball entry
- ICC-compliant rule enforcement
- Automatic over completion detection
- Free-hit tracking
- Partnership tracking

### Scoreboard Display
- Hero section with live score
- Quick stats (striker, bowler, partnership)
- Recent overs timeline
- Win probability
- Projected scores

### Player Profiles
- Full career statistics
- Season-wise breakdown
- Recent form analysis
- Match history

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## 📚 Documentation

- [ICC Rules Implementation](./docs/icc-rules.md)
- [API Documentation](./docs/api.md)
- [Database Schema](./docs/database-schema.md)
- [Component Guide](./docs/components.md)

## 🤝 Contributing

This is a proprietary platform. For development queries, contact the development team.

## 📄 License

Proprietary - All rights reserved

## 🆘 Support

For support, email: support@batchcrickbd.com

---

Built with ❤️ for School Cricket in Bangladesh
