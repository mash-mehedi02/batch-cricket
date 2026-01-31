# Match Number Generation - Implementation Guide

## Overview
Automatic match number generation based on tournament name initials and serial count.

**Format:** `[Tournament Initials][Serial Number][Collision Suffix]`
- Example: `SFM01`, `SFM02`, `SMT01`, `SFM01B` (if collision)

## What's Been Implemented

### 1. Utility Functions (`src/utils/matchNumber.ts`)
- ✅ `getTournamentInitials(tournamentName)` - Extracts initials from tournament name
- ✅ `generateMatchNumber(tournamentId, tournamentName)` - Generates unique match number
- ✅ `isValidMatchNumber(matchNumber)` - Validates match number format

### 2. Type Definition
- ✅ Added `matchNo?: string` field to `Match` interface in `src/types/index.ts`

### 3. Display Component
- ✅ Updated `MatchInfo.tsx` to display match number below Time and Venue

## How to Integrate (For Match Creation)

### Option 1: In Tournament Fixture Generation
When generating fixtures in `AdminTournaments.tsx`, add match number generation:

```typescript
import { generateMatchNumber } from '@/utils/matchNumber'

// When creating fixtures
const fixtures = await generateGroupFixtures(config)

// For each fixture, generate match number
for (const fixture of fixtures.matches) {
  const matchNo = await generateMatchNumber(
    tournamentId,
    tournament.name
  )
  
  // Add to match document
  await setDoc(doc(db, 'matches', matchId), {
    ...matchData,
    matchNo: matchNo
  })
}
```

### Option 2: In Admin Match Creation Form
When manually creating a match in the admin panel:

```typescript
import { generateMatchNumber } from '@/utils/matchNumber'

const handleCreateMatch = async () => {
  // Get tournament data
  const tournament = await tournamentService.getById(formData.tournamentId)
  
  // Generate match number
  const matchNo = await generateMatchNumber(
    formData.tournamentId,
    tournament.name
  )
  
  // Create match with match number
  await setDoc(doc(db, 'matches', matchId), {
    ...formData,
    matchNo: matchNo,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  })
}
```

## Examples

### Tournament: "SMA Friendly Match"
- Initials: `SFM`
- Matches: `SFM01`, `SFM02`, `SFM03`, ...

### Tournament: "SMA T20 Tournament"
- Initials: `SMT`  
- Matches: `SMT01`, `SMT02`, `SMT03`, ...

### Collision Handling
If `SFM01` already exists from a different tournament:
- New match becomes: `SFM01B`
- If `SFM01B` also exists: `SFM01BB` (unlikely but handled)

## Display
The match number is displayed on the Match Info page:
- **Location:** Below Time and Venue
- **Style:** Emerald-colored badge with # icon
- **Format:** "Match Number: SFM01"

## Next Steps
1. Find where matches are created in your codebase (likely in `AdminTournaments.tsx` or a fixture generation function)
2. Import `generateMatchNumber` from `@/utils/matchNumber`
3. Call it before creating the match document
4. Add the returned `matchNo` to the match data

## Testing
1. Create a tournament named "SMA Friendly Match"
2. Create matches for that tournament
3. Verify match numbers are: SFM01, SFM02, SFM03, etc.
4. Create another tournament with same initials
5. Verify collision handling adds 'B' suffix
6. Check Match Info page displays the match number correctly
