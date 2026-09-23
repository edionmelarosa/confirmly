# Manual Test: Calendar Timezone Bug Fix

## Bug Description
Staff dashboard shows 3 appointments for "today" (e.g., Sept 23 in Manila), but clicking to the appointments calendar page shows "No appointments booked for this day."

## Root Cause
`toDateInputValue()` used `toISOString().slice(0, 10)` which returns UTC date instead of local date. In Manila (UTC+8), this caused:
- When it's 3 AM on Sept 23 Manila (Sept 22 19:00 UTC), the date input showed "2026-09-22"
- If user interacted with the date input, appointments for Sept 23 wouldn't match the filtered slots for Sept 22

## Fix
Changed `toDateInputValue()` to use local date components: `getFullYear()`, `getMonth()`, `getDate()`

## Test Cases

### Test 1: Early Morning (Before 8 AM UTC)
**Scenario**: Manila 3:00 AM on Sept 23, 2026 (= Sept 22 19:00 UTC)
- **Before fix**: Date input shows "2026-09-22" ❌
- **After fix**: Date input shows "2026-09-23" ✓

### Test 2: Normal Hours
**Scenario**: Manila 2:00 PM on Sept 23, 2026 (= Sept 23 06:00 UTC)  
- **Before fix**: Date input shows "2026-09-23" ✓
- **After fix**: Date input shows "2026-09-23" ✓

### Test 3: End of Day
**Scenario**: Manila 11:59 PM on Sept 23, 2026 (= Sept 23 15:59 UTC)
- **Before fix**: Date input shows "2026-09-23" ✓
- **After fix**: Date input shows "2026-09-23" ✓

## Verification Steps

1. Access production: https://web-production-e10f3.up.railway.app
2. Login with: clinic1 / dev@confirmly.test / devpassword123
3. Create 3 appointments for today (e.g., 9 AM, 2 PM, 4 PM Manila time)
4. Check dashboard shows "Today's appointments: 3"
5. Click "View full calendar" or navigate to /dashboard/appointments
6. Verify the date input shows today's date in Manila timezone
7. Verify appointments appear in the slot list (not "No appointments booked for this day")

## Edge Cases Covered

1. **Timezone boundaries**: Works correctly across all hours in UTC+8
2. **Date rollover**: Correctly handles dates near midnight
3. **SessionCapacityView**: Also fixed since it uses the same `toDateInputValue()` function
4. **Round-trip**: Parsing the date value back creates the same day

## Files Changed
- `apps/web/components/calendar/slots.ts`: Fixed `toDateInputValue()` function
