/**
 * Returns the appropriate API base URL for the current execution context.
 *
 * Browser (client-side):
 *   - Uses NEXT_PUBLIC_API_URL (typically "/backend" in production)
 *   - Falls back to "http://localhost:4000" for local dev
 *
 * Server (Next.js server components, API routes):
 *   - Uses API_UPSTREAM_URL (absolute URL to API service in production)
 *   - Falls back to "http://localhost:4000" for local dev
 *
 * Why this matters:
 *   - Browser fetch() can use relative URLs like "/backend/clinic-settings"
 *   - Node.js fetch() requires absolute URLs like "https://api.example.com/clinic-settings"
 *   - In production, browser calls same-origin /backend/* which Next.js rewrites
 *     to the API service, preserving cookies/sessions
 */
export function getApiUrl(): string {
  // Server-side: use absolute API_UPSTREAM_URL or localhost
  if (typeof window === "undefined") {
    return process.env.API_UPSTREAM_URL ?? "http://localhost:4000";
  }

  // Client-side: use NEXT_PUBLIC_API_URL (can be relative) or localhost
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}
