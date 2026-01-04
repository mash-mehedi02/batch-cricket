### BatchCrick BD — Tournament Management Engine (Config-Driven)

This document describes the **professional, reusable, configuration-driven** tournament engine design used by BatchCrick BD.  
The engine supports **standard tournaments** and **custom/hybrid** formats (e.g. Senior/Junior mixed).

---

## Core principle

- **UI edits config**
- **Engine validates & derives**
- **Derived data is system-generated** (standings/qualification/bracket/fixtures)
- Admin can **configure**, but cannot **manually alter computed rankings**

---

## Firestore model (recommended)

### `tournaments/{tournamentId}`

Stores base info + tournament config:

- `name`, `year`, `season`, `format`, `status`
- `tournamentType`: `"standard" | "custom"`
- `config`: **TournamentConfig v1** (see `src/engine/tournament/types.ts`)
- `participantSquadIds`: `string[]`
- `participantSquadMeta`: `{ [squadId]: { name, batch? } }` (display reliability)

### `tournaments/{tournamentId}/derived/standings`

System-generated:
- `byGroup`: `{ [groupId]: StandingRow[] }`
- `generatedAt`
- `sourceMatchCount`

### `tournaments/{tournamentId}/derived/qualification`

System-generated:
- `slots`: QualificationSlot[]
- `generatedAt`

### `tournaments/{tournamentId}/derived/bracket`

System-generated:
- `bracket`: Bracket
- `generatedAt`

### `matches/{matchId}`

Stores match base fields:
- `tournamentId`
- `teamAId`, `teamBId` (squad IDs)
- `teamAName`, `teamBName` (optional legacy display)
- scheduling fields
- `status` (`upcoming`/`live`/`finished`)

### `matches/{matchId}/innings/{teamA|teamB}`

System-generated innings stats (already implemented in the project).

---

## Server-side computation (required)

Engine functions are **pure** and can run:
- in Firebase Cloud Functions / Cloud Run
- or a protected admin backend

Recommended triggers:
- On match status change → recompute standings/qualification/bracket
- On tournament config change (only if not locked) → validate + regen fixtures preview

---

## Engine modules

Located in `src/engine/tournament/`:

- `types.ts`: Config schema (groups, points, ranking, knockout modes)
- `validation.ts`: Enforces safe configuration rules + warnings
- `standings.ts`: Points + NRR + tie-breakers (points→NRR→H2H→wins)
- `qualification.ts`: Per-group qualification + wildcards
- `fixtures.ts`: Round-robin generator (base) + warnings for custom
- `knockout.ts`: Auto bracket + custom mapping validation

---

## Safety & locking

The config includes:
- `locks.groupsLocked`
- `locks.fixturesLocked`
- `locks.knockoutLocked`

Once group stage starts, group composition should be locked.  
Once knockout starts, bracket configuration should be locked.


