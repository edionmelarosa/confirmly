# SMS Staff Visibility & Manual Send - Verification Guide

## What was implemented

### 1. SMS Log Viewing (`/dashboard/messages`)
- **Route**: `GET /sms-logs` - Returns paginated SMS logs for the authenticated clinic
- **UI**: New "Messages" page in the staff dashboard
- **Features**:
  - View all outbound and inbound SMS messages
  - See phone number, direction (sent/received), status, and message preview
  - Link to related appointment and patient when available
  - Auto-refresh and manual refresh button
  - Mobile-friendly design

### 2. Manual Send Reminder
- **Existing Route**: `POST /appointments/:id/resend-reminder` (was already implemented)
- **UI Updates**:
  - "Resend reminder now" button in fixed-time appointment detail dialog
  - "Send reminder" button in session capacity view for each appointment
- **Behavior**: Uses the same reminder template and SMS service as the automated cron job

### 3. Navigation
- Added "Messages" link to dashboard nav (between Waitlist and Settings)

## How to verify the reminder cron still works

The reminder dispatch job is configured in:
- **Job definition**: `apps/api/src/jobs/reminder-dispatch.ts`
- **Cron schedule**: `0 * * * *` (runs every hour on the hour)
- **Initialization**: `apps/api/src/server.ts` (line 15)

### Verification steps in a running environment:

1. **Check the cron is running**:
   - After the API server starts, you should see a log indicating the job started
   - The job runs hourly, so check logs around each hour mark

2. **Test reminder dispatch**:
   ```bash
   # Create an appointment 23-25 hours in the future (within default 24h lead time)
   # Wait for the next hour boundary
   # Check the database:
   SELECT * FROM sms_logs 
   WHERE appointment_id = '<your-appointment-id>' 
   ORDER BY created_at DESC 
   LIMIT 1;
   
   # Check the appointment:
   SELECT id, reminder_sent_at 
   FROM appointments 
   WHERE id = '<your-appointment-id>';
   ```

3. **Expected behavior**:
   - `appointments.reminder_sent_at` should be set to the current timestamp
   - A new row should appear in `sms_logs` with:
     - `direction = 'out'`
     - `appointment_id` set
     - `provider_status = 'logged'` (if in log mode) or `'sent'` (if in live mode)

4. **Manual test of the dispatch logic**:
   ```typescript
   // In apps/api, create a test script or use the Node REPL:
   import { dispatchDueReminders } from './src/jobs/reminder-dispatch';
   import { createSmsService } from './src/services/sms';
   import { loadEnv } from './src/env';
   
   const env = loadEnv();
   const smsService = createSmsService(env);
   const result = await dispatchDueReminders(smsService);
   console.log(`Dispatched ${result.dispatched} reminders`);
   ```

### What the cron does:
1. Queries appointments where:
   - `startsAt` is within the next `clinic.reminderLeadHours` (default 24 hours)
   - `reminderSentAt` is null
   - `status` is not 'cancelled'
2. For each matching appointment:
   - Renders the reminder SMS using `renderReminderSms()`
   - Calls `smsService.send()` (which writes to `sms_logs`)
   - Updates `appointment.reminderSentAt`

## SMS_MODE behavior

- **log mode** (SMS_MODE=log or default in non-production):
  - All sends write to console: `[sms:log] to=+639... body=...`
  - SmsLog records have `provider_status = 'logged'`
  - No actual SMS is sent to Semaphore

- **live mode** (SMS_MODE=live):
  - Sends to real Semaphore API
  - SmsLog records have `provider_status` from Semaphore response

## Files changed

- `apps/api/src/routes/sms-logs.ts` - New API route
- `apps/api/src/app.ts` - Register SMS logs route
- `packages/shared-types/src/sms-log.ts` - New types
- `packages/shared-types/src/index.ts` - Export SMS log types
- `apps/web/app/dashboard/messages/page.tsx` - New Messages page
- `apps/web/components/dashboard/DashboardNav.tsx` - Add Messages link
- `apps/web/components/calendar/SessionCapacityView.tsx` - Add Send reminder button

## Pre-existing features leveraged

- `POST /appointments/:id/resend-reminder` was already implemented and working
- `SmsLog` table and `smsService.send()` already write all outbound messages
- `renderReminderSms()` template already exists
- Reminder cron job already exists and runs hourly

## Testing done

- ✅ Shared types typecheck passes
- ✅ API typecheck passes
- ✅ SMS log route follows existing auth patterns
- ✅ UI components follow existing patterns (Toast, Badge, Button, etc.)
- ⚠️ Web typecheck has pre-existing Next.js PageProps/LayoutProps errors (not related to this PR)

The implementation is MVP-focused and builds directly on the existing SMS infrastructure with minimal new code.
