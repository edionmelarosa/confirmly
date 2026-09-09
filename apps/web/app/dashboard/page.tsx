"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, ClipboardList, UserX, AlarmClock } from "lucide-react";
import type { AppointmentDto, WaitlistEntryDto } from "@confirmly/shared-types";
import { apiClient, ApiError } from "@/lib/api-client";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { useToast } from "@/components/ui/ToastProvider";

interface Patient {
  id: string;
  name: string;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

export default function DashboardPage() {
  const toast = useToast();
  const [appointments, setAppointments] = useState<AppointmentDto[] | null>(null);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntryDto[] | null>(null);
  const [patients, setPatients] = useState<Patient[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [appts, waitlist, patientList] = await Promise.all([
          apiClient.get<AppointmentDto[]>("/appointments"),
          apiClient.get<WaitlistEntryDto[]>("/waitlist"),
          apiClient.get<Patient[]>("/patients"),
        ]);
        if (cancelled) return;
        setAppointments(appts);
        setWaitlistEntries(waitlist);
        setPatients(patientList);
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof ApiError ? err.message : "Failed to load dashboard data");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount, not on toast identity
  }, []);

  const loading = appointments === null || waitlistEntries === null || patients === null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const now = new Date();
  const patientById = new Map(patients.map((p) => [p.id, p]));

  const todaysAppointments = appointments
    .filter((appt) => appt.status !== "cancelled" && isSameDay(new Date(appt.startsAt), now))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const weekStart = startOfWeek(now);
  const noShowsThisWeek = appointments.filter(
    (appt) => appt.status === "no_show" && new Date(appt.startsAt) >= weekStart,
  ).length;

  const pendingWaitlistOffers = waitlistEntries.filter((entry) => entry.status === "offered").length;

  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const unconfirmedNext24h = appointments.filter(
    (appt) =>
      appt.status === "scheduled" &&
      new Date(appt.startsAt) >= now &&
      new Date(appt.startsAt) <= next24h,
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's appointments"
          value={todaysAppointments.length}
          icon={CalendarCheck}
          href="/dashboard/appointments"
        />
        <StatCard
          label="No-shows this week"
          value={noShowsThisWeek}
          icon={UserX}
          tone="danger"
          href="/dashboard/appointments"
        />
        <StatCard
          label="Pending waitlist offers"
          value={pendingWaitlistOffers}
          icon={ClipboardList}
          tone="warning"
          href="/dashboard/waitlist"
        />
        <StatCard
          label="Unconfirmed (next 24h)"
          value={unconfirmedNext24h}
          icon={AlarmClock}
          tone="warning"
          href="/dashboard/appointments"
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>Today&apos;s schedule</CardTitle>
          <Link href="/dashboard/appointments" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            View full calendar
          </Link>
        </CardHeader>
        {todaysAppointments.length === 0 ? (
          <div className="px-4 pb-6 sm:px-6">
            <EmptyState
              icon={<CalendarCheck className="h-8 w-8" />}
              title="No appointments today"
              description="Nothing on the books for today. New bookings will show up here."
            />
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Time</TableHeaderCell>
                <TableHeaderCell>Patient</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {todaysAppointments.map((appt) => (
                <TableRow key={appt.id}>
                  <TableCell>
                    {new Date(appt.startsAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>{patientById.get(appt.patientId)?.name ?? "Unknown patient"}</TableCell>
                  <TableCell>
                    <Badge status={appt.status}>{appt.status.replace("_", " ")}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
