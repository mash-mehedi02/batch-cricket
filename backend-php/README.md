# PHP Backend Deployment Guide

This backend system is designed to poll cricket scores and send push notifications via Firebase FCM HTTP v1 API.

## 1. Prerequisites
- PHP 7.4+
- MySQL/MariaDB
- PHP cURL extension enabled
- PHP OpenSSL extension enabled

## 2. Setup Instructions
1. **Database**: Import the `schema.sql` file into your MySQL database.
2. **Environment**: Rename `.env.example` to `.env` and fill in your database and FCM details.
3. **FCM Service Account**: 
   - Go to Google Cloud Console -> IAM & Admin -> Service Accounts.
   - Create a service account with "Firebase Cloud Messaging API (V1)" permissions.
   - Generate a JSON key and save it as `backend-php/config/service-account.json`.

## 3. Cron Job Setup
To run the script every 30 seconds, add the following to your crontab (`crontab -e`):

```cron
* * * * * php /path/to/backend-php/check_score.php >> /path/to/backend-php/cron.log 2>&1
* * * * * ( sleep 30; php /path/to/backend-php/check_score.php >> /path/to/backend-php/cron.log 2>&1 )
```

## 4. Hosting Compatibility
### Shared Hosting
- Most shared hosts support PHP/MySQL.
- Check if `cURL` and `OpenSSL` are enabled.
- Cron jobs might be limited to 1-minute intervals. If so, use the "sleep 30" trick in the same cron command to achieve 30-second polling.

### VPS (Recommended)
- Better performance for high traffic.
- Full control over cron intervals and environment variables.

## 5. Security Notes
- Ensure `.env` and `service-account.json` are NOT accessible directly via the web.
- Recommended structure: Place the entire `backend-php` folder outside the public web root (`public_html` or `www`).
