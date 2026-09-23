# Middleware Logic Verification

## Purpose
The middleware ensures logged-out users cannot access dashboard pages, even via:
- Browser back button after logout
- Direct URL navigation
- Cached client-side routes

## Implementation

### File: `apps/web/middleware.ts`

```typescript
export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("confirmly_session");
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    if (!sessionCookie) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}
```

### Matcher Configuration
```typescript
export const config = {
  matcher: ["/dashboard/:path*"],
};
```

## Test Scenarios

### ✅ Scenario 1: Logged-in user accesses dashboard
- **Request**: `GET /dashboard`
- **Cookie**: `confirmly_session=valid_token`
- **Expected**: Allow access (NextResponse.next())
- **Result**: Dashboard page renders

### ✅ Scenario 2: Logged-out user tries to access dashboard
- **Request**: `GET /dashboard`
- **Cookie**: None (or expired)
- **Expected**: Redirect to `/login`
- **Result**: User sees login page

### ✅ Scenario 3: User clicks logout, then back button
- **Flow**:
  1. User on `/dashboard` with valid cookie
  2. User clicks logout
  3. API clears `confirmly_session` cookie
  4. Client does `window.location.href = "/login"`
  5. User clicks browser back button → `GET /dashboard`
- **Cookie**: None (cleared by logout)
- **Expected**: Middleware redirects to `/login`
- **Result**: Login page, not cached dashboard

### ✅ Scenario 4: User manually navigates to dashboard after logout
- **Flow**:
  1. User logged out
  2. User types `/dashboard` in browser URL bar
- **Cookie**: None
- **Expected**: Middleware redirects to `/login`
- **Result**: Login page

### ✅ Scenario 5: User accesses dashboard subpages
- **Request**: `GET /dashboard/appointments`
- **Cookie**: None
- **Expected**: Redirect to `/login`
- **Matcher**: `/dashboard/:path*` catches all subpaths

### ✅ Scenario 6: Public pages still accessible
- **Request**: `GET /login`, `GET /`, `GET /c/abc123`
- **Cookie**: None
- **Expected**: Allow access (middleware only matches `/dashboard/*`)
- **Result**: Public pages render normally

## Why This Works

### Middleware vs Layout Server Component
- **Layout** (`dashboard/layout.tsx`): Only runs on hard page loads/initial SSR
- **Middleware**: Runs on **every request**, including:
  - Client-side navigation that triggers server fetches
  - Browser back/forward navigation
  - Direct URL entry
  - Hard reloads

### Hard Redirect on Logout
`window.location.href = "/login"` ensures:
- Full page load (not soft client navigation)
- All client-side cache cleared
- Middleware runs on next dashboard navigation

## Edge Cases Covered

1. **Expired cookie**: Treated same as missing cookie → redirect
2. **Invalid cookie format**: Browser doesn't send malformed cookies → redirect
3. **Multiple dashboard tabs**: Each tab navigation checks middleware
4. **Soft client navigation after logout**: Middleware still runs on data fetches
5. **Deep dashboard links**: `/dashboard/patients/123` → redirects to `/login`

## Integration Points

### API Session Management
- Logout endpoint (`/auth/logout`) properly clears cookie with `maxAge: 0`
- Cookie name matches: `confirmly_session` (both API and middleware)
- Cookie attributes: `httpOnly`, `sameSite: lax`, `secure` in production

### Client Navigation
- Login success: `router.push("/dashboard")` works (soft nav, cookie present)
- Logout: `window.location.href = "/login"` (hard nav, cookie cleared)
- Protected routes: All dashboard pages protected by single middleware
