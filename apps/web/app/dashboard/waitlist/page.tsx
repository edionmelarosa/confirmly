"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { WaitlistEntryDto } from "@confirmly/shared-types";

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntryDto[]>([]);
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [desiredStart, setDesiredStart] = useState("");
  const [desiredEnd, setDesiredEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [offeringId, setOfferingId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const data = await apiClient.get<WaitlistEntryDto[]>("/waitlist");
      setEntries(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load waitlist");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    fetchEntries();
  }, [fetchEntries]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const patient = await apiClient.post<{ id: string }>("/patients", {
        name: patientName,
        phone: patientPhone,
      });

      await apiClient.post("/waitlist", {
        patientId: patient.id,
        desiredStart: new Date(desiredStart).toISOString(),
        desiredEnd: new Date(desiredEnd).toISOString(),
      });

      setPatientName("");
      setPatientPhone("");
      setDesiredStart("");
      setDesiredEnd("");
      await fetchEntries();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendOfferNow(entry: WaitlistEntryDto) {
    setOfferingId(entry.id);
    setError(null);
    try {
      await apiClient.post(`/waitlist/${entry.id}/send-offer`, {
        startsAt: entry.desiredStart,
        endsAt: entry.desiredEnd,
      });
      await fetchEntries();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setOfferingId(null);
    }
  }

  return (
    <div>
      <h1>Waitlist</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360, marginBottom: 24 }}>
        <label>
          Patient name
          <input value={patientName} onChange={(e) => setPatientName(e.target.value)} required />
        </label>
        <label>
          Patient phone
          <input
            value={patientPhone}
            onChange={(e) => setPatientPhone(e.target.value)}
            placeholder="+639171234567"
            required
          />
        </label>
        <label>
          Desired start
          <input
            type="datetime-local"
            value={desiredStart}
            onChange={(e) => setDesiredStart(e.target.value)}
            required
          />
        </label>
        <label>
          Desired end
          <input
            type="datetime-local"
            value={desiredEnd}
            onChange={(e) => setDesiredEnd(e.target.value)}
            required
          />
        </label>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Adding..." : "Add to waitlist"}
        </button>
      </form>

      <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 640 }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #e5e5e5", padding: 8, textAlign: "left" }}>Desired range</th>
            <th style={{ border: "1px solid #e5e5e5", padding: 8, textAlign: "left" }}>Status</th>
            <th style={{ border: "1px solid #e5e5e5", padding: 8, textAlign: "left" }}>Added</th>
            <th style={{ border: "1px solid #e5e5e5", padding: 8, textAlign: "left" }}></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td style={{ border: "1px solid #e5e5e5", padding: 8 }}>
                {new Date(entry.desiredStart).toLocaleString()} – {new Date(entry.desiredEnd).toLocaleString()}
              </td>
              <td style={{ border: "1px solid #e5e5e5", padding: 8 }}>{entry.status}</td>
              <td style={{ border: "1px solid #e5e5e5", padding: 8 }}>
                {new Date(entry.createdAt).toLocaleDateString()}
              </td>
              <td style={{ border: "1px solid #e5e5e5", padding: 8 }}>
                {entry.status === "waiting" && (
                  <button onClick={() => handleSendOfferNow(entry)} disabled={offeringId === entry.id}>
                    {offeringId === entry.id ? "Sending..." : "Send offer now"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
