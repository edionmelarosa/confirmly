"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiClient, ApiError } from "@/lib/api-client";

interface ClinicSettings {
  name: string;
  timezone: string;
  smsSenderName: string;
  reminderLeadHours: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [smsSenderName, setSmsSenderName] = useState("");
  const [reminderLeadHours, setReminderLeadHours] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient
      .get<ClinicSettings>("/clinic-settings")
      .then((data) => {
        setSettings(data);
        setSmsSenderName(data.smsSenderName);
        setReminderLeadHours(String(data.reminderLeadHours));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load settings"));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);

    try {
      const updated = await apiClient.patch<ClinicSettings>("/clinic-settings", {
        smsSenderName,
        reminderLeadHours: Number(reminderLeadHours),
      });
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!settings) {
    return <p>{error ?? "Loading..."}</p>;
  }

  return (
    <div>
      <h1>Settings</h1>
      <p style={{ color: "#666" }}>
        {settings.name} ({settings.timezone})
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
        <label>
          SMS sender name
          <input value={smsSenderName} onChange={(e) => setSmsSenderName(e.target.value)} required />
        </label>
        <label>
          Reminder lead time (hours before appointment)
          <input
            type="number"
            min={1}
            value={reminderLeadHours}
            onChange={(e) => setReminderLeadHours(e.target.value)}
            required
          />
        </label>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        {saved && <p style={{ color: "green" }}>Saved.</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save settings"}
        </button>
      </form>
    </div>
  );
}
