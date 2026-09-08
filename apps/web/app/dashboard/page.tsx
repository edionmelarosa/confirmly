import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getCurrentStaffUser() {
  const cookieStore = await cookies();
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<{ email: string; role: string; clinicId: string }>;
}

export default async function DashboardPage() {
  const user = await getCurrentStaffUser();

  return (
    <div>
      <h1>Dashboard</h1>
      {user ? (
        <p>
          Signed in as {user.email} ({user.role}) at clinic {user.clinicId}
        </p>
      ) : (
        <p>Not signed in.</p>
      )}
    </div>
  );
}
