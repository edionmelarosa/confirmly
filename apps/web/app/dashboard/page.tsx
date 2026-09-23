"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import type { AppointmentDto } from "@confirmly/shared-types";
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


export default function DashboardPage() {
  const toast = useToast();
  const [appointments, setAppointments] = useState<AppointmentDto[] | null>(null);
  const [patients, setPatients] = useState<Patient[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [appts, patientList] = await Promise.all([
          apiClient.get<AppointmentDto[]>("/appointments"),
          apiClient.get<Patient[]>("/patients"),
        ]);
        if (cancelled) return;
        setAppointments(appts);
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

  const loading = appointments === null || patients === null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-20 w-full" />
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Today's appointments"
          value={todaysAppointments.length}
          icon={CalendarCheck}
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
