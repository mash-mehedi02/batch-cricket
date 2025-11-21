# School Cricket Backend API

Express.js backend API for School Cricket Management & Live Scoring System.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Firebase configuration

# Download Firebase Admin SDK service account key
# Save as: config/serviceAccountKey.json

# Run in development mode
npm run dev

# Run in production mode
npm start
```

## 📋 Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=5000
NODE_ENV=development
FIREBASE_PROJECT_ID=your-project-id
FRONTEND_URL=http://localhost:5173
```

## 🔑 Firebase Admin SDK Setup

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Download the JSON file
4. Save it as `config/serviceAccountKey.json`

**Important**: Never commit `serviceAccountKey.json` to version control!

## 📡 API Endpoints

See main README.md for complete API documentation.

## 🔐 Authentication

All admin endpoints require authentication via Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase-id-token>
```

## 🛠️ Development

```bash
# Watch mode (auto-restart on file changes)
npm run dev

# Production mode
npm start
```

## 📦 Dependencies

- **express**: Web framework
- **cors**: CORS middleware
- **dotenv**: Environment variables
- **firebase-admin**: Firebase Admin SDK
- **express-validator**: Request validation

## 📝 License

MIT

