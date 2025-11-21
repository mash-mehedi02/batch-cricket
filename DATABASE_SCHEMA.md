# Database Collections Schema

This document describes the Firestore database collections and their schemas for the School Cricket Management System.

## Collections Overview

1. **tournaments** - Tournament/competition information
2. **squads** - Team squads linked to tournaments
3. **players** - Player profiles and statistics
4. **matches** - Match details and scores
5. **admin** - Admin user metadata (passwords handled by Firebase Auth)

---

## 1. Tournaments Collection

**Collection:** `tournaments`

**Schema:**
```javascript
{
  name: string,           // Tournament name (required)
  year: number,           // Tournament year (required)
  school: string,         // School name (required) - stored as 'schoolName' in code
  createdAt: timestamp,   // Creation timestamp (auto-generated)
  // Optional fields:
  startDate: string,      // Start date (YYYY-MM-DD)
  format: string,         // 'T20', 'ODI', 'Test' (default: 'T20')
  status: string,         // 'upcoming', 'ongoing', 'completed'
  description: string,   // Tournament description
  updatedAt: timestamp,   // Last update timestamp
  createdBy: string,      // Admin email who created it
}
```

**Relations:**
- `squads.tournamentId` → `tournaments.id` (one-to-many)
- `matches.tournamentId` → `tournaments.id` (one-to-many)
- `players.tournamentId` → `tournaments.id` (one-to-many)

**Example:**
```javascript
{
  name: "Inter-Batch Cricket Championship",
  year: 2024,
  school: "SMA High School",
  createdAt: Timestamp(2024-01-15T10:00:00Z),
  startDate: "2024-02-01",
  format: "T20",
  status: "ongoing"
}
```

---

## 2. Squads Collection

**Collection:** `squads`

**Schema:**
```javascript
{
  name: string,           // Squad/Team name (required) - stored as 'teamName' in code
  year: number,           // Year/Batch (required)
  tournamentId: string,   // Reference to tournament (required)
  // Optional fields:
  players: array,         // Array of player objects (legacy, use players collection)
  captain: string,        // Captain name
  viceCaptain: string,    // Vice captain name
  batch: string,          // Batch string (for backward compatibility)
  createdAt: timestamp,   // Creation timestamp
  updatedAt: timestamp,   // Last update timestamp
  createdBy: string,      // Admin email who created it
}
```

**Relations:**
- `squads.tournamentId` → `tournaments.id` (many-to-one)
- `players.squadId` → `squads.id` (one-to-many)
- `matches.teamASquadId` → `squads.id` (many-to-one)
- `matches.teamBSquadId` → `squads.id` (many-to-one)

**Example:**
```javascript
{
  name: "Rangers 19",
  year: 2024,
  tournamentId: "tournament123",
  captain: "Ahmed Rahman",
  viceCaptain: "Sakib Hasan",
  createdAt: Timestamp(2024-01-20T10:00:00Z)
}
```

---

## 3. Players Collection

**Collection:** `players`

**Schema:**
```javascript
{
  name: string,           // Player name (required)
  role: string,           // 'Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper' (required)
  class: string,          // Class/Grade (optional)
  tournamentId: string,   // Reference to tournament (required)
  squadId: string,        // Reference to squad (required)
  stats: {                // Player statistics (required)
    runs: number,         // Total runs scored
    wickets: number,      // Total wickets taken
    matches: number,      // Total matches played
    strikeRate: number,   // Strike rate
    average: number,      // Batting average
  },
  // Optional fields:
  photo: string,          // Player photo URL
  batch: string,          // Batch string (for backward compatibility)
  year: number,           // Year/Batch number
  matchStats: object,     // Current match statistics
  pastMatches: array,     // Array of past match performances
  createdAt: timestamp,   // Creation timestamp
  updatedAt: timestamp,   // Last update timestamp
  createdBy: string,      // Admin email who created it
}
```

**Relations:**
- `players.tournamentId` → `tournaments.id` (many-to-one)
- `players.squadId` → `squads.id` (many-to-one)

**Example:**
```javascript
{
  name: "Ahmed Rahman",
  role: "Batsman",
  class: "Class 10-A",
  tournamentId: "tournament123",
  squadId: "squad456",
  stats: {
    runs: 450,
    wickets: 0,
    matches: 15,
    strikeRate: 125.5,
    average: 30.0
  },
  year: 2024,
  createdAt: Timestamp(2024-01-25T10:00:00Z)
}
```

---

## 4. Matches Collection

**Collection:** `matches`

**Schema:**
```javascript
{
  teamA: string,          // Team A name (required)
  teamB: string,          // Team B name (required)
  tournamentId: string,   // Reference to tournament (required)
  date: string,           // Match date (YYYY-MM-DD) (required)
  time: string,           // Match time (HH:MM) (required)
  venue: string,          // Venue name (required)
  status: string,         // 'Upcoming', 'Live', 'Completed' (required)
  score: {                // Match scores (required)
    teamA: {
      runs: number,
      wickets: number,
      overs: string       // Format: "18.2"
    },
    teamB: {
      runs: number,
      wickets: number,
      overs: string
    }
  },
  commentary: array,     // Array of commentary objects (subcollection)
  // Optional fields:
  teamASquadId: string,   // Reference to Team A squad
  teamBSquadId: string,   // Reference to Team B squad
  format: string,         // Match format ('T20', 'ODI', 'Test')
  currentBatting: string, // Currently batting team
  matchDateTime: timestamp, // Combined date and time
  isFinal: boolean,       // Whether this is a final match
  createdAt: timestamp,   // Creation timestamp
  updatedAt: timestamp,   // Last update timestamp
  createdBy: string,      // Admin email who created it
}
```

**Commentary Subcollection:** `matches/{matchId}/commentary`

**Commentary Schema:**
```javascript
{
  text: string,           // Commentary text (required)
  batsman: string,        // Batsman name
  bowler: string,         // Bowler name
  over: string,           // Over number (e.g., "18.2")
  ball: number,           // Ball number (1-6)
  runs: number,           // Runs scored on this ball
  isWicket: boolean,      // Whether wicket was taken
  isBoundary: boolean,    // Whether it was a boundary
  timestamp: timestamp,   // When commentary was added
  createdAt: timestamp,   // Creation timestamp
}
```

**Relations:**
- `matches.tournamentId` → `tournaments.id` (many-to-one)
- `matches.teamASquadId` → `squads.id` (many-to-one)
- `matches.teamBSquadId` → `squads.id` (many-to-one)

**Example:**
```javascript
{
  teamA: "Rangers 19",
  teamB: "Demons 20",
  tournamentId: "tournament123",
  date: "2024-02-15",
  time: "14:00",
  venue: "Main Ground",
  status: "Live",
  score: {
    teamA: {
      runs: 145,
      wickets: 3,
      overs: "18.2"
    },
    teamB: {
      runs: 0,
      wickets: 0,
      overs: "0.0"
    }
  },
  teamASquadId: "squad456",
  teamBSquadId: "squad789",
  currentBatting: "Rangers 19",
  createdAt: Timestamp(2024-02-10T10:00:00Z)
}
```

---

## 5. Admin Collection

**Collection:** `admin`

**Note:** Passwords are NOT stored in Firestore. They are handled by Firebase Authentication. This collection only stores admin metadata.

**Schema:**
```javascript
{
  email: string,          // Admin email (required) - matches Firebase Auth UID
  name: string,           // Admin name (required)
  role: string,           // Admin role (default: "admin")
  createdAt: timestamp,   // Creation timestamp
  updatedAt: timestamp,   // Last update timestamp
}
```

**Document ID:** The document ID should match the Firebase Auth User UID.

**Example:**
```javascript
{
  email: "admin@school.com",
  name: "Admin User",
  role: "admin",
  createdAt: Timestamp(2024-01-01T10:00:00Z)
}
```

---

## Data Relations Diagram

```
tournaments (1)
    ├── squads (many) [tournamentId]
    │       └── players (many) [squadId]
    │
    ├── matches (many) [tournamentId]
    │       └── commentary (subcollection)
    │
    └── players (many) [tournamentId]
```

---

## Field Naming Conventions

- **IDs**: Use camelCase (e.g., `tournamentId`, `squadId`)
- **Timestamps**: Use camelCase (e.g., `createdAt`, `updatedAt`)
- **Names**: Use camelCase (e.g., `teamName`, `schoolName`)
- **Status**: Use PascalCase for match status (e.g., `Live`, `Upcoming`, `Completed`)

---

## Indexes Required

For optimal query performance, create these composite indexes in Firestore:

1. **squads**: `tournamentId` + `year` (ascending)
2. **players**: `tournamentId` + `squadId` (ascending)
3. **players**: `squadId` + `name` (ascending)
4. **matches**: `tournamentId` + `status` + `date` (descending)
5. **matches**: `status` + `date` (descending)

---

## Validation Rules

### Tournaments
- `name`: Required, non-empty string
- `year`: Required, integer between 2020-2100
- `school`: Required, non-empty string

### Squads
- `name`: Required, non-empty string
- `year`: Required, integer between 2020-2100
- `tournamentId`: Required, must reference existing tournament

### Players
- `name`: Required, non-empty string
- `role`: Required, must be one of: 'Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper'
- `tournamentId`: Required, must reference existing tournament
- `squadId`: Required, must reference existing squad that belongs to the tournament
- `stats.runs`: Required, number >= 0
- `stats.wickets`: Required, number >= 0

### Matches
- `teamA`: Required, non-empty string
- `teamB`: Required, non-empty string
- `tournamentId`: Required, must reference existing tournament
- `date`: Required, valid date string (YYYY-MM-DD)
- `time`: Required, valid time string (HH:MM)
- `venue`: Required, non-empty string
- `status`: Required, must be one of: 'Upcoming', 'Live', 'Completed'
- `teamASquadId`: Required, must reference existing squad
- `teamBSquadId`: Required, must reference existing squad

---

## API Endpoints

All collections have standard CRUD endpoints:

- `GET /api/tournaments` - Get all tournaments
- `GET /api/tournaments/:id` - Get single tournament
- `POST /api/tournaments` - Create tournament (Admin only)
- `PUT /api/tournaments/:id` - Update tournament (Admin only)
- `DELETE /api/tournaments/:id` - Delete tournament (Admin only)

Same pattern for: `/api/squads`, `/api/players`, `/api/matches`

---

## Security Rules

See `firestore.rules` for detailed security rules. General principles:

- **Read**: All collections are publicly readable
- **Write**: Only authenticated admins can create/update/delete
- **Admin**: Users can read their own admin document

