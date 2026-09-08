"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { AppointmentDto } from "@confirmly/shared-types";
import { AppointmentForm } from "./AppointmentForm";
import { buildSlotsForDay, formatSlotTime, toDateInputValue } from "./slots";
import type { Slot } from "./types";

const POLL_INTERVAL_MS = 15_000;

export function DayCalendar() {
  const [day, setDay] = useState(() => new Date());
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      const data = await apiClient.get<AppointmentDto[]>("/appointments");
      setAppointments(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load appointments");
    }
  }, []);

  useEffect(() => {
    fetchAppointments();

    const interval = setInterval(fetchAppointments, POLL_INTERVAL_MS);
    const onFocus = () => fetchAppointments();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchAppointments]);

  const slots = buildSlotsForDay(day, appointments);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <label>
          Date
          <input
            type="date"
            value={toDateInputValue(day)}
            onChange={(e) => setDay(new Date(`${e.target.value}T00:00:00`))}
          />
        </label>
        <button onClick={fetchAppointments} type="button">
          Refresh
        </button>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 480 }}>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot.startsAt.toISOString()}>
              <td style={{ border: "1px solid #e5e5e5", padding: 8, width: 90 }}>
                {formatSlotTime(slot.startsAt)}
              </td>
              <td style={{ border: "1px solid #e5e5e5", padding: 8 }}>
                <button
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: slot.appointment ? "#fde8e8" : "#e8fdf0",
                  }}
                >
                  {slot.appointment ? `Booked (${slot.appointment.status})` : "Open"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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
