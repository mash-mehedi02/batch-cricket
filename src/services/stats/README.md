# ICC-Compliant Statistics Engine

This module provides a complete, ICC-compliant statistics calculation system for cricket matches.

## Modules

### Core Definitions (`iccDefinitions.ts`)
- ICC rule definitions and constants
- Match counting logic
- Innings counting logic
- Batting average calculation
- Strike rate calculation
- Bowling statistics calculation
- Utility functions (balls ↔ overs conversion)

### Validation (`validateBallEvent.ts`)
- Ball event validation
- ICC rule compliance checking
- Error detection for impossible combinations

### Not-Out Detection (`notOutDetector.ts`)
- Determines if a player's innings ended with "not out" status
- Handles edge cases (target reached, overs complete, retired hurt, etc.)

### Match Counter (`matchCounter.ts`)
- ICC-compliant match counting
- Checks if player was in Playing XI
- Validates match status

### Batting Calculator (`battingCalculator.ts`)
- Calculates batting statistics from match summaries
- Handles innings counting, not-outs, dismissals
- Calculates average, strike rate, milestones (50s, 100s)
- Tracks highest score with not-out indicator

### Bowling Calculator (`bowlingCalculator.ts`)
- Calculates bowling statistics from match summaries
- Handles overs calculation (only legal balls count)
- Calculates economy, average, strike rate
- Determines best bowling figures

### Season Aggregator (`seasonAggregator.ts`)
- Groups statistics by year/season
- Calculates season-wise batting and bowling stats
- Maintains ICC compliance per season

### Career Aggregator (`careerAggregator.ts`)
- Calculates overall career statistics
- Combines all matches into career totals
- Calculates win percentage

### Test Utilities (`testUtils.ts`)
- Automated test functions
- Validates all calculation logic
- Ensures ICC rule compliance

## ICC Rules Implemented

### Match Counting
- Match counts if: status is "live" or "finished" AND player is in Playing XI
- 12th man / benched substitutes DO NOT count

### Innings Counting
- Innings counts if: player faces ≥1 ball OR is dismissed (even on 0 balls)
- Run-out on 0 balls = innings counted

### Batting Average
- Average = Total Runs / Times Out
- Times Out = Innings - Not Outs
- If Times Out = 0, display "—" (not Infinity)

### Strike Rate
- Strike Rate = (Runs / Balls Faced) × 100
- Balls Faced includes: Legal balls, No-balls (without bat)
- Excludes: Wides, Penalty balls

### Bowling Statistics
- Balls Bowled = Legal balls only (excludes wides and no-balls)
- Economy = Runs Conceded / Overs
- Bowling Average = Runs Conceded / Wickets (null if no wickets)
- Strike Rate = Balls Bowled / Wickets

### Not Out Detection
- Player is NOT OUT if:
  - Target reached
  - Overs completed
  - Partner got out (all out)
  - Retired hurt
  - Match abandoned

## Usage

```typescript
import { 
  calculateCareerStats,
  aggregateBySeason,
  calculateBattingStats,
  calculateBowlingStats 
} from '../services/stats'

// Calculate career stats
const careerStats = calculateCareerStats(matchesWithSummaries, playerId)

// Calculate season stats
const seasonMap = aggregateBySeason(matchesWithSummaries, playerId)

// Calculate batting stats
const battingStats = calculateBattingStats(battingSummaries, matchContexts)

// Calculate bowling stats
const bowlingStats = calculateBowlingStats(bowlingSummaries)
```

## Testing

Run automated tests to verify ICC compliance:

```typescript
import { runAllTests } from '../services/stats/testUtils'

const testResults = runAllTests()
console.log('All tests passed:', testResults.allPassed)
```

## Integration

The statistics engine is integrated into:
- `src/pages/PlayerProfile.jsx` - Player profile display
- Future: Backend stats recalculation on match completion
- Future: Real-time stats updates during matches

