import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav style={{ padding: 16, borderBottom: "1px solid #e5e5e5", display: "flex", gap: 16 }}>
        <strong>Confirmly</strong>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/dashboard/appointments">Appointments</Link>
      </nav>
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}
