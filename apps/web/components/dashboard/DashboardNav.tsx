"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, ClipboardList, Menu, Settings, LogOut, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "@/components/ui/Dialog";

const NAV_LINKS = [
  { href: "/dashboard/appointments", label: "Appointments", icon: Calendar },
  { href: "/dashboard/patients", label: "Patients", icon: Users },
  { href: "/dashboard/waitlist", label: "Waitlist", icon: ClipboardList },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardNav({ clinicName }: { clinicName: string }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleLogout() {
    await apiClient.post("/auth/logout");
    window.location.href = "/login";
  }

  return (
    <nav className="border-b border-neutral-200 bg-white">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-lg font-semibold text-brand-700">Confirmly</span>
            <span className="text-neutral-300">|</span>
            <span className="text-sm font-semibold text-neutral-900">{clinicName}</span>
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} {...link} active={pathname.startsWith(link.href)} />
            ))}
          </div>
        </div>

        <div className="hidden md:block">
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <Dialog open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
        <DialogHeader>
          <DialogTitle>Menu</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.href}
                {...link}
                active={pathname.startsWith(link.href)}
                onClick={() => setMobileMenuOpen(false)}
                block
              />
            ))}
            <Button
              variant="ghost"
              className="mt-2 justify-start"
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        </DialogBody>
      </Dialog>
    </nav>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
  block,
}: {
  href: string;
  label: string;
  icon: typeof Calendar;
  active: boolean;
  onClick?: () => void;
  block?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        block ? "w-full" : "",
        active
          ? "bg-brand-50 text-brand-700"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
