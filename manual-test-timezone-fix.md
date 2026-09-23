# Manual Test: Calendar Timezone Bug Fix

## Bug Description
Staff dashboard shows 3 appointments for "today" (e.g., Sept 23 in Manila), but clicking to the appointments calendar page shows "No appointments booked for this day."

## Root Cause (Verified Against Codebase)
Product Owner hypothesis confirmed:

1. **Dashboard (home page)** uses `isSameDay()` which compares **local date components** → correctly shows appointments for Sept 23 Manila ✓
2. **Calendar date input** (BROKEN) used `toISOString().slice(0, 10)` which returns **UTC date** → showed "2026-09-22" instead of "2026-09-23" when before 8 AM UTC ❌
3. **Slot matching** uses exact `getTime()` comparison → works correctly when day state is correct ✓

The bug manifests **before 8 AM UTC** (= before 4 PM Manila previous day, but really between midnight and ~8 AM Manila):
- At 3 AM Sept 23 Manila = 7:30 PM Sept 22 UTC
- Dashboard shows "Today's appointments: 3" using local Sept 23 ✓
- Calendar date input shows "2026-09-22" using UTC date ❌
- Slots built for Sept 22 don't match appointments for Sept 23 ❌
- Result: "No appointments booked for this day"

## Fix
Changed `toDateInputValue()` to use **local date components** instead of UTC:
- Now uses: `getFullYear()`, `getMonth()`, `getDate()`
- Ensures date input and slot building both use browser's local timezone (Manila for clinic staff)
- Slot matching logic already correct (uses `getTime()` millisecond comparison)

## Test Cases

### Test 1: Early Morning (Before 8 AM UTC) - **PRIMARY BUG SCENARIO**
**Scenario**: Manila 3:00 AM on Sept 23, 2026 (= Sept 22 19:30 UTC)
- **Before fix**: 
  - Dashboard shows "Today's appointments: 3" ✓
  - Date input shows "2026-09-22" ❌
  - Slots built for Sept 22, appointments on Sept 23 don't match ❌
  - Shows "No appointments booked for this day" ❌
- **After fix**: 
  - Dashboard shows "Today's appointments: 3" ✓
  - Date input shows "2026-09-23" ✓
  - Slots built for Sept 23, appointments match ✓
  - Shows appointments correctly ✓

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
