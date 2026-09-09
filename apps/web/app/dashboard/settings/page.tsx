"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";

interface ClinicSettings {
  name: string;
  timezone: string;
  smsSenderName: string;
  reminderLeadHours: number;
}

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [smsSenderName, setSmsSenderName] = useState("");
  const [reminderLeadHours, setReminderLeadHours] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient
      .get<ClinicSettings>("/clinic-settings")
      .then((data) => {
        setSettings(data);
        setSmsSenderName(data.smsSenderName);
        setReminderLeadHours(String(data.reminderLeadHours));
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Failed to load settings");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount, not on toast identity
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const updated = await apiClient.patch<ClinicSettings>("/clinic-settings", {
        smsSenderName,
        reminderLeadHours: Number(reminderLeadHours),
      });
      setSettings(updated);
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!settings) {
    return (
      <div className="max-w-md space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            {settings.name} ({settings.timezone})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              SMS sender name
              <Input value={smsSenderName} onChange={(e) => setSmsSenderName(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              Reminder lead time (hours before appointment)
              <Input
                type="number"
                min={1}
                value={reminderLeadHours}
                onChange={(e) => setReminderLeadHours(e.target.value)}
                required
              />
            </label>
            <Button type="submit" disabled={submitting} className="mt-1 self-start">
              {submitting ? "Saving..." : "Save settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
