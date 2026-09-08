export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav style={{ padding: 16, borderBottom: "1px solid #e5e5e5" }}>
        <strong>Confirmly</strong>
        <span style={{ marginLeft: 16 }}>Dashboard</span>
      </nav>
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}
