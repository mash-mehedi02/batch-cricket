# School Cricket Management & Live Scoring System

A comprehensive full-stack web application for managing school cricket tournaments, squads, players, and live match scoring. Built with React, Node.js, Express.js, and Firebase.

## 🏏 Features

### Public Features
- **Live Matches**: Real-time live match scores and ball-by-ball commentary
- **Match Schedule**: View upcoming and past matches
- **Squad Management**: Browse players organized by batch/year
- **Player Profiles**: Detailed player statistics and performance history
- **Champions**: View year-wise winning teams and their squads
- **Responsive Design**: Fully responsive for mobile, tablet, and desktop

### Admin Features
- **Tournament Management**: Create, update, and manage cricket tournaments
- **Squad Management**: Manage team squads by batch with player assignments
- **Player Management**: Add/edit player profiles with statistics tracking
- **Live Scoring**: Real-time score updates and commentary management
- **Admin Dashboard**: Centralized admin control panel

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router DOM** - Client-side routing
- **Firebase SDK** - Authentication and real-time database

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Firebase Admin SDK** - Server-side Firebase operations
- **Express Validator** - Request validation

### Database
- **Firebase Firestore** - NoSQL database with real-time updates

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Firebase project with Firestore enabled
- Firebase Authentication enabled

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "School Cricket"
```

### 2. Frontend Setup

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Update `.env` with your Firebase configuration:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_URL=http://localhost:5000/api
```

### 3. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Update `backend/.env`:
```env
PORT=5000
NODE_ENV=development
FIREBASE_PROJECT_ID=your_project_id
FRONTEND_URL=http://localhost:5173
```

### 4. Firebase Admin SDK Setup

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Download the JSON file
4. Save it as `backend/config/serviceAccountKey.json`

**Important**: Add `backend/config/serviceAccountKey.json` to `.gitignore`

### 5. Firestore Security Rules

Update your Firestore Security Rules in Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAdmin() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/admin/$(request.auth.uid));
    }
    
    match /matches/{matchId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
      
      match /commentary/{commentaryId} {
        allow read: if true;
        allow create, update, delete: if isAdmin();
      }
    }
    
    match /players/{playerId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }
    
    match /admin/{adminId} {
      allow read: if request.auth != null && request.auth.uid == adminId;
      allow create: if request.auth != null && request.auth.uid == adminId;
      allow update, delete: if request.auth != null && (
        request.auth.uid == adminId || 
        exists(/databases/$(database)/documents/admin/$(request.auth.uid))
      );
    }
    
    match /tournaments/{tournamentId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }
    
    match /squads/{squadId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }
    
    match /champions/{championId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }
  }
}
```

### 6. Create Admin User

1. Go to Firebase Console → Authentication → Users
2. Add a new user with email/password
3. Copy the User UID
4. Go to Firestore → Create collection `admin`
5. Create document with Document ID = User UID
6. Add fields:
   - `email`: (string) admin email
   - `name`: (string) admin name
   - `role`: (string) "admin"
   - `createdAt`: (timestamp) current time

## 🏃 Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

### Production Build

**Frontend:**
```bash
npm run build
npm run preview
```

**Backend:**
```bash
cd backend
npm start
```

## 📁 Project Structure

```
School Cricket/
├── backend/                 # Express.js backend
│   ├── config/             # Firebase Admin config
│   ├── middleware/         # Auth middleware
│   ├── routes/            # API routes
│   │   ├── tournaments.js
│   │   ├── squads.js
│   │   ├── players.js
│   │   └── matches.js
│   ├── server.js          # Express server
│   └── package.json
├── src/                    # React frontend
│   ├── components/        # Reusable components
│   ├── contexts/         # React contexts
│   ├── pages/            # Page components
│   │   ├── admin/        # Admin pages
│   │   ├── Home.jsx
│   │   ├── LiveMatch.jsx
│   │   └── ...
│   ├── services/         # API services
│   ├── config/           # Firebase config
│   └── App.jsx
├── public/                # Static assets
└── package.json
```

## 🔌 API Endpoints

### Tournaments
- `GET /api/tournaments` - Get all tournaments
- `GET /api/tournaments/:id` - Get single tournament
- `POST /api/tournaments` - Create tournament (Admin)
- `PUT /api/tournaments/:id` - Update tournament (Admin)
- `DELETE /api/tournaments/:id` - Delete tournament (Admin)

### Squads
- `GET /api/squads` - Get all squads
- `GET /api/squads/:id` - Get single squad
- `POST /api/squads` - Create squad (Admin)
- `PUT /api/squads/:id` - Update squad (Admin)
- `DELETE /api/squads/:id` - Delete squad (Admin)

### Players
- `GET /api/players` - Get all players
- `GET /api/players/:id` - Get single player
- `POST /api/players` - Create player (Admin)
- `PUT /api/players/:id` - Update player (Admin)
- `DELETE /api/players/:id` - Delete player (Admin)

### Matches
- `GET /api/matches` - Get all matches
- `GET /api/matches/live` - Get live matches
- `GET /api/matches/:id` - Get single match with commentary
- `POST /api/matches` - Create match (Admin)
- `PUT /api/matches/:id/score` - Update match score (Admin)
- `POST /api/matches/:id/commentary` - Add commentary (Admin)
- `DELETE /api/matches/:id` - Delete match (Admin)

## 🔐 Authentication

Admin authentication uses Firebase Authentication with email/password. The backend verifies admin status by checking if a document exists in the `admin` collection with the user's UID.

## 📱 Responsive Design

The application is fully responsive and optimized for:
- **Mobile**: 320px - 768px
- **Tablet**: 768px - 1024px
- **Desktop**: 1024px+

## 🚀 Deployment

### Frontend (Vercel)
1. Connect your GitHub repository
2. Set environment variables in Vercel dashboard
3. Deploy

### Backend (Railway/Render/Heroku)
1. Set environment variables
2. Upload `serviceAccountKey.json` as a secret
3. Deploy

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For support, email [your-email] or create an issue in the repository.

---

**Built with ❤️ for School Cricket Management**
