# SMS Log Mode Documentation

## Overview
SMS log mode allows running Confirmly in production without sending live SMS messages through Semaphore. This is useful when:
- Semaphore sender name is pending approval
- Testing production deployment without affecting real users
- Debugging SMS workflows without incurring costs

## Configuration

### Environment Variable: `SMS_MODE`

**Values:**
- `log` - Dry-run mode: no live SMS sends, logs to stdout
- `live` - Production mode: real Semaphore API calls

**Default behavior:**
- If `NODE_ENV=production` and `SMS_MODE` not set → defaults to `live`
- If `NODE_ENV=development` or `test` and `SMS_MODE` not set → defaults to `log`
- Explicit `SMS_MODE` always overrides the default

### API Key Requirements

| SMS_MODE | SEMAPHORE_API_KEY | Behavior |
|----------|-------------------|----------|
| `log` | Optional | Logs to stdout, no API calls |
| `live` | **Required** | Sends via Semaphore API |

## Railway Deployment Setup

### Enabling Log Mode (Recommended for Pilot)

1. Open your Railway project
2. Navigate to the API service environment variables
3. Add: `SMS_MODE=log`
4. Keep `NODE_ENV=production` (needed for secure session cookies)
5. `SEMAPHORE_API_KEY` can be unset or left empty

**Result:** API runs in production mode with secure cookies, but SMS sends only log to stdout.

### Switching to Live Mode (After Semaphore Approval)

1. Update environment variables:
   - Set `SMS_MODE=live`
   - Set `SEMAPHORE_API_KEY=<your-approved-api-key>`
   - Set `SEMAPHORE_SENDER_NAME=<your-approved-sender-name>`
2. Redeploy or restart the service

## Log Format

In log mode, each SMS outputs a greppable log line to stdout:

```
[sms:log] to=+639171234567 body=TestClinic: You have an appointment on Thu, Jan 15, 9:00 AM. Reply C to confirm, R to reschedule, or X to cancel.
```

### Viewing Logs on Railway

1. Navigate to your API service in Railway
2. Click on the "Logs" tab
3. Search for `[sms:log]` to find all dry-run SMS messages
4. The full message body is included, including tokenized links

## Database Behavior

Both modes write to the `sms_logs` table:

### Log Mode
```sql
direction: 'out'
provider_status: 'logged'
provider_message_id: NULL
body: <full message text>
```

### Live Mode
```sql
direction: 'out'
provider_status: <Semaphore status, e.g. 'queued'>
provider_message_id: <Semaphore message ID>
body: <full message text>
```

## Testing

Test scripts are available in `apps/api/scripts/`:

### Run Environment Validation Test
```bash
cd apps/api
pnpm tsx scripts/test-env-validation.ts
```

Validates:
- API key requirements in different modes
- Default mode behavior
- Production override scenarios

### Run Log Output Demo
```bash
cd apps/api
SMS_MODE=log pnpm tsx scripts/demo-sms-log-output.ts
```

Shows the actual log format and explains Railway configuration.

### Run Feature Test
```bash
cd apps/api
pnpm tsx scripts/test-sms-log-mode.ts
```

Documents expected behavior in both modes.

## Implementation Details

### Code Location
All mode branching logic is in `apps/api/src/services/sms.ts`:

```typescript
async function send(params: SendClinicSmsParams) {
  let result: Awaited<ReturnType<SmsSender["sendSms"]>>;

  if (env.SMS_MODE === "log") {
    console.log(`[sms:log] to=${params.to} body=${params.body}`);
    result = {
      success: true,
      providerStatus: "logged",
      providerMessageId: null,
      errorMessage: null,
    };
  } else {
    result = await sender.sendSms(params.to, params.body);
  }

  await prisma.smsLog.create({
    data: { /* ... */ }
  });

  return result;
}
```

### Design Principles
- **Single point of control**: All SMS sends go through `createSmsService.send()`
- **No adapter changes**: `packages/sms` Semaphore adapter unchanged
- **Type safety**: `SMS_MODE` type is `"log" | "live"`, never undefined at runtime
- **Validation**: Zod schema enforces API key requirement based on mode

## Troubleshooting

### Error: "SEMAPHORE_API_KEY is required when SMS_MODE is live"

**Cause:** `SMS_MODE=live` (or production default) but API key is missing.

**Solutions:**
1. Set `SMS_MODE=log` to use dry-run mode
2. Set `SEMAPHORE_API_KEY` with a valid key for live mode
3. Change `NODE_ENV` to development (will default to log mode)

### SMS not appearing in logs

**Check:**
1. Confirm `SMS_MODE=log` is set
2. Search Railway logs for `[sms:log]` (case-sensitive)
3. Verify appointment reminders are actually due (check `reminder_lead_hours`)
4. Check cron job is running (runs hourly at minute 0)

### SMS not sending in live mode

**Check:**
1. Confirm `SMS_MODE=live` is set
2. Verify `SEMAPHORE_API_KEY` is set and valid
3. Check `sms_logs` table for `provider_status` error codes
4. Review Railway logs for Semaphore API errors

## Migration Path

### Phase 1: Pilot with Log Mode (Current)
- Deploy with `SMS_MODE=log`
- Verify appointment creation, reminder scheduling, patient links
- Monitor logs for SMS content accuracy
- Test reschedule/cancel flows (manually trigger via links)

### Phase 2: Business Permit & Sender Name Approval
- Submit business permit to Semaphore
- Await sender name approval (typically 2-5 business days)

### Phase 3: Switch to Live Mode
- Update Railway env: `SMS_MODE=live`
- Add approved `SEMAPHORE_API_KEY` and `SEMAPHORE_SENDER_NAME`
- Redeploy
- Send test reminder to founder's number
- Monitor first batch of real reminders closely

### Phase 4: Full Production
- Remove or keep `SMS_MODE=live` (explicit is clearer)
- Monitor `sms_logs` table for delivery status
- Set up alerts for `provider_status` errors if needed

## FAQ

**Q: Can I test log mode locally?**  
A: Yes. Log mode is the default in development. Just run the API and trigger reminder dispatch.

**Q: Does log mode affect inbound SMS handling?**  
A: No. Log mode only affects outbound sends. Inbound SMS webhook handling is unaffected.

**Q: Can I have different modes for different clinics?**  
A: No. `SMS_MODE` is environment-wide. All clinics in the deployment use the same mode.

**Q: What happens to scheduled reminders when switching modes?**  
A: Nothing. Reminders are scheduled by `reminder_sent_at` field. Switching modes only affects whether they actually send or log.

**Q: Is there a cost to log mode?**  
A: No Semaphore costs in log mode. Only database writes for `sms_logs` entries.

**Q: Can I switch modes without redeploying?**  
A: Railway restarts the service when you change environment variables. No code deployment needed, but the process restarts.

## Related Files
- `apps/api/src/env.ts` - Environment variable validation
- `apps/api/src/services/sms.ts` - SMS service implementation
- `apps/api/src/jobs/reminder-dispatch.ts` - Cron job that sends reminders
- `apps/api/src/templates/sms.ts` - SMS message templates
- `packages/sms/src/adapters/semaphore.ts` - Semaphore API adapter
- `.env.example` - Root environment template
- `apps/api/.env.example` - API environment template
