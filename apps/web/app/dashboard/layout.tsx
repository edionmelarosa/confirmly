import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { getApiUrl } from "@/lib/api-url";

async function getClinicName(): Promise<string> {
  const cookieStore = await cookies();
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/clinic-settings`, {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      redirect("/login");
    }
    return "Confirmly";
  }

  const data = (await response.json()) as { name: string };
  return data.name;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("confirmly_session");

  if (!sessionCookie) {
    redirect("/login");
  }

  const clinicName = await getClinicName();

  return (
    <div className="min-h-full">
      <DashboardNav clinicName={clinicName} />
      <main className="p-4 sm:p-6">{children}</main>
    </div>
  );
}
