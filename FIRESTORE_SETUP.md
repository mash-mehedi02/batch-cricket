# Firestore Database Setup Guide (বাংলা/English)

## Step 1: Firestore Security Rules সেটআপ করুন

1. Firebase Console এ যান: https://console.firebase.google.com/
2. আপনার project "sma-cricket-league" select করুন
3. **Firestore Database** → **Rules** tab এ যান
4. `firestore.rules` file এর content copy করে paste করুন
5. **Publish** button click করুন

### Security Rules কি করে:
- ✅ সবাই matches, players, commentary পড়তে পারবে (public read)
- ✅ শুধু admins write করতে পারবে
- ✅ Admin authentication check করবে

---

## Step 2: Authentication Enable করুন

1. Firebase Console → **Authentication** → **Get started**
2. **Sign-in method** tab এ যান
3. **Email/Password** enable করুন
4. **Save** করুন

---

## Step 3: Collections Structure

Collections automatically create হবে যখন app use করবেন, কিন্তু manually create করতে পারেন:

### Collection 1: `matches`
```
matches/{matchId}
├── team1: "Batch 2024"
├── team2: "Batch 2023"
├── score1: "145/3"
├── score2: "120/5"
├── overs1: "18.2"
├── overs2: "15.0"
├── wickets1: 3
├── wickets2: 5
├── status: "Live" | "Upcoming" | "Completed"
├── venue: "Main Ground"
├── date: "2024-01-14"
├── batch: "2024"
├── format: "T20"
├── createdAt: timestamp
└── updatedAt: timestamp
```

**Subcollection:** `matches/{matchId}/commentary/{commentaryId}`
```
├── text: "Single taken. Good running."
├── batsman: "Player 1"
├── bowler: "Player X"
├── over: 18.2
├── ball: 2
├── runs: 1
├── isBoundary: false
├── isWicket: false
├── timestamp: timestamp
└── createdAt: timestamp
```

### Collection 2: `players`
```
players/{playerId}
├── name: "Ahmed Rahman"
├── role: "Batsman"
├── batch: "2025"
├── class: "Class 10-A"
├── image: "url" (optional)
├── stats: {
│     matches: 15,
│     innings: 15,
│     runs: 450,
│     highest: 78,
│     average: 30.0,
│     strikeRate: 125.5,
│     wickets: 0,
│     hundreds: 0,
│     fifties: 4,
│     fours: 45,
│     sixes: 12
│   }
├── pastMatches: [
│     {
│       date: "2024-01-10",
│       opponent: "Batch 2024",
│       runs: 45,
│       balls: 32,
│       fours: 4,
│       sixes: 1,
│       wickets: 0,
│       result: "Won",
│       venue: "Main Ground"
│     }
│   ]
├── createdAt: timestamp
└── updatedAt: timestamp
```

### Collection 3: `admins`
```
admins/{adminId}  (adminId = Firebase Auth UID)
├── email: "admin@school.com"
├── name: "Admin Name"
├── role: "admin" | "super-admin"
├── createdAt: timestamp
└── updatedAt: timestamp
```

---

## Step 4: প্রথম Admin User তৈরি করুন

### Method 1: Firebase Console থেকে (Recommended)

1. **Authentication** → **Users** → **Add user**
2. Email: `admin@school.com` (বা আপনার email)
3. Password: একটি strong password দিন
4. **Add** করুন
5. User এর **UID** copy করুন

6. **Firestore Database** → **Start collection**
7. Collection ID: `admins`
8. Document ID: paste করুন UID (যে UID copy করেছিলেন)
9. Fields add করুন:
   - `email` (string): `admin@school.com`
   - `name` (string): `Admin Name`
   - `role` (string): `admin`
   - `createdAt` (timestamp): current timestamp
   - `updatedAt` (timestamp): current timestamp
10. **Save** করুন

### Method 2: Admin Panel থেকে (App running থাকলে)

1. App run করুন: `npm run dev`
2. `/admin` page এ যান
3. Sign up করুন (যদি signup option থাকে)

---

## Step 5: Indexes তৈরি করুন (Important!)

Firebase Console → **Firestore Database** → **Indexes** → **Create Index**

### Index 1: Live Matches Query
- Collection: `matches`
- Fields:
  - `status` (Ascending)
  - `date` (Descending)
- Query scope: Collection

### Index 2: Past Matches Query
- Collection: `matches`
- Fields:
  - `status` (Ascending)
  - `date` (Descending)
- Query scope: Collection

### Index 3: Players by Batch
- Collection: `players`
- Fields:
  - `batch` (Ascending)
  - `name` (Ascending)
- Query scope: Collection

### Index 4: Commentary by Timestamp
- Collection: `matches/{matchId}/commentary`
- Fields:
  - `timestamp` (Descending)
- Query scope: Collection

**Note:** Firebase automatically prompt করবে index create করার জন্য যখন প্রথম query run করবেন।

---

## Step 6: Test করুন

1. App run করুন: `npm run dev`
2. Browser console open করুন (F12)
3. Check করুন Firebase connection:
   - কোনো error আছে কিনা
   - Firebase initialized হয়েছে কিনা

4. Admin Panel test করুন:
   - `/admin` page এ যান
   - Login করুন
   - একটি match create করুন
   - Score update করুন
   - Commentary add করুন

5. Home page check করুন:
   - Live matches দেখাচ্ছে কিনা
   - Real-time updates কাজ করছে কিনা

---

## Troubleshooting

### Error: "Missing or insufficient permissions"
- ✅ Security Rules properly set up হয়েছে কিনা check করুন
- ✅ Admin user properly create হয়েছে কিনা verify করুন
- ✅ Authentication enable হয়েছে কিনা check করুন

### Error: "Index not found"
- ✅ Firebase Console → Indexes → Create missing index
- ✅ Index create হতে 2-5 minute লাগতে পারে

### Real-time updates কাজ করছে না
- ✅ Browser console check করুন
- ✅ Firebase connection verify করুন
- ✅ Network tab check করুন

### Admin login কাজ করছে না
- ✅ Authentication enable হয়েছে কিনা check করুন
- ✅ Admin document Firestore এ আছে কিনা verify করুন
- ✅ UID match করছে কিনা check করুন

---

## Quick Checklist

- [ ] Firestore Database created
- [ ] Security Rules published
- [ ] Authentication enabled (Email/Password)
- [ ] First admin user created
- [ ] Admin document in Firestore created
- [ ] Indexes created (or auto-created)
- [ ] App tested locally
- [ ] Real-time updates working

---

## Support

যদি কোনো সমস্যা হয়:
1. Browser console check করুন
2. Firebase Console → Firestore → Usage check করুন
3. Security Rules verify করুন
4. Authentication users list check করুন

