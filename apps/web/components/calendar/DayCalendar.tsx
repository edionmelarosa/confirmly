"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, CalendarX2 } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { AppointmentDto } from "@confirmly/shared-types";
import { AppointmentForm } from "./AppointmentForm";
import { buildSlotsForDay, formatSlotTime, toDateInputValue } from "./slots";
import type { Slot } from "./types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";

const POLL_INTERVAL_MS = 15_000;

export function DayCalendar() {
  const toast = useToast();
  const [day, setDay] = useState(() => new Date());
  const [appointments, setAppointments] = useState<AppointmentDto[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAppointments = useCallback(async () => {
    try {
      const data = await apiClient.get<AppointmentDto[]>("/appointments");
      setAppointments(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load appointments");
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable fetch, not re-created per toast identity
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    fetchAppointments();

    const interval = setInterval(fetchAppointments, POLL_INTERVAL_MS);
    const onFocus = () => fetchAppointments();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchAppointments]);

  function handleRefresh() {
    setRefreshing(true);
    fetchAppointments();
  }

  const loading = appointments === null;
  const slots = loading ? [] : buildSlotsForDay(day, appointments);
  const bookedCount = slots.filter((slot) => slot.appointment !== null).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Date
          <Input
            type="date"
            value={toDateInputValue(day)}
            onChange={(e) => setDay(new Date(`${e.target.value}T00:00:00`))}
          />
        </label>
        <Button type="button" variant="secondary" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex max-w-md flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
          {bookedCount === 0 && (
            <div className="mb-4 max-w-md">
              <EmptyState
                icon={<CalendarX2 className="h-8 w-8" />}
                title="No appointments booked for this day"
                description="Pick an open slot below to book one."
              />
            </div>
          )}

          <div className="flex max-w-md flex-col gap-1">
            {slots.map((slot) => (
              <button
                key={slot.startsAt.toISOString()}
                type="button"
                onClick={() => setSelectedSlot(slot)}
                className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 text-left text-sm hover:border-brand-300 hover:bg-brand-50"
              >
                <span className="font-medium text-neutral-700">{formatSlotTime(slot.startsAt)}</span>
                {slot.appointment ? (
                  <Badge status={slot.appointment.status}>{slot.appointment.status.replace("_", " ")}</Badge>
                ) : (
                  <span className="text-neutral-400">Open</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {selectedSlot && (
        <AppointmentForm
          startsAt={selectedSlot.startsAt}
          endsAt={selectedSlot.endsAt}
          existing={selectedSlot.appointment}
          onClose={() => setSelectedSlot(null)}
          onSaved={() => {
            setSelectedSlot(null);
            fetchAppointments();
          }}
        />
      )}
    </div>
  );
}
