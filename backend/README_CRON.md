# Match Status Cron Job

This document describes the automated match status update system using Node.js cron jobs.

## Overview

The cron job automatically checks match times every minute and updates match statuses:
- **Upcoming → Live**: When match start time equals or passes current time
- **Manual Updates**: Admins can manually set matches to "Finished" or "Completed"

## How It Works

### Automatic Status Updates

1. **Cron Schedule**: Runs every minute (`* * * * *`)
2. **Checks**: All matches with status "Upcoming" or "Live"
3. **Updates**: Changes "Upcoming" to "Live" when match time arrives
4. **Skips**: Manually ended matches (won't auto-update)

### Manual Status Updates

Admins can manually update match status via API:
- `PUT /api/matches/:id/status` - Set status to "Finished", "Completed", etc.
- Manually ended matches are marked with `manuallyEnded: true`
- Cron job skips manually ended matches

## Installation

The cron job uses `node-cron` package:

```bash
cd backend
npm install node-cron
```

## Configuration

### Environment Variables

Add to `.env`:

```env
# Enable/disable cron job (default: enabled)
ENABLE_CRON=true

# Timezone for cron job (default: UTC)
CRON_TIMEZONE=UTC
```

### Starting the Cron Job

The cron job starts automatically when the server starts:

```bash
npm run dev
# or
npm start
```

You'll see:
```
🚀 Match status cron job started (runs every minute)
🔍 Checking match statuses at 2024-01-15T10:00:00.000Z
```

## API Endpoints

### Manual Status Update

```http
PUT /api/matches/:id/status
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "status": "Finished"
}
```

**Valid Statuses:**
- `Upcoming` - Match scheduled for future
- `Live` - Match currently in progress
- `Completed` - Match finished (auto or manual)
- `Finished` - Match manually ended by admin

### Auto-Update Status (Manual Trigger)

```http
POST /api/matches/auto-update-status
Authorization: Bearer <admin-token>
```

This endpoint manually triggers the status check (useful for testing).

## Cron Job Logic

```javascript
Every minute:
  1. Get all matches with status "Upcoming" or "Live"
  2. For each match:
     - Skip if manuallyEnded = true
     - Calculate matchDateTime from date + time
     - If status = "Upcoming" AND matchDateTime <= now:
       - Update status to "Live"
       - Update updatedAt timestamp
  3. Log updates
```

## Match Data Structure

Matches should have:
```javascript
{
  date: "2024-01-15",        // Required: YYYY-MM-DD
  time: "14:00",             // Required: HH:MM
  matchDateTime: Timestamp,  // Optional: Pre-calculated datetime
  status: "Upcoming",        // Current status
  manuallyEnded: false,      // Set to true when admin manually ends
  updatedAt: Timestamp,      // Last update time
}
```

## Logging

The cron job logs:
- ✅ Successful updates
- ⚠️ Warnings (missing data)
- ❌ Errors
- 🔍 Check timestamps

Example logs:
```
🔍 Checking match statuses at 2024-01-15T10:00:00.000Z
✅ Updated 2 match(es) to Live:
   - Match abc123: Upcoming → Live
   - Match def456: Upcoming → Live
```

## Testing

### Test Cron Job Manually

1. Create a match with past date/time:
```javascript
{
  date: "2024-01-01",
  time: "10:00",
  status: "Upcoming"
}
```

2. Wait for cron job to run (or trigger manually via API)
3. Check match status - should be "Live"

### Disable Cron for Testing

Set in `.env`:
```env
ENABLE_CRON=false
```

## Error Handling

- **Missing date/time**: Match skipped with warning
- **Firestore errors**: Logged, cron continues
- **Batch limit**: Automatically handles Firestore batch limits (500 docs)

## Performance

- **Efficiency**: Only queries matches that need checking
- **Batch updates**: Uses Firestore batch writes
- **Rate limiting**: Prevents concurrent runs
- **Memory**: Minimal memory footprint

## Graceful Shutdown

The cron job stops gracefully on:
- `SIGTERM` - Production shutdown
- `SIGINT` - Development shutdown (Ctrl+C)

## Monitoring

Check cron job status:
```javascript
import matchStatusCron from './services/matchStatusCron.js'

const status = matchStatusCron.getStatus()
console.log(status)
// { isRunning: true, isChecking: false }
```

## Troubleshooting

### Cron Job Not Running

1. Check `ENABLE_CRON` environment variable
2. Check server logs for startup messages
3. Verify `node-cron` is installed
4. Check server timezone settings

### Matches Not Updating

1. Verify match has `date` and `time` fields
2. Check `matchDateTime` is calculated correctly
3. Ensure match status is "Upcoming"
4. Verify `manuallyEnded` is not set to `true`
5. Check server logs for errors

### Timezone Issues

- Cron job uses UTC by default
- Match times should be stored in consistent timezone
- Adjust `CRON_TIMEZONE` if needed

## Future Enhancements

- [ ] Configurable cron schedule
- [ ] Email notifications on status changes
- [ ] Webhook support for status updates
- [ ] Status change history tracking
- [ ] Dashboard for cron job monitoring

