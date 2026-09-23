"use client";

import { useEffect, useState } from "react";
import { MessageSquare, RefreshCw } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { SmsLogListResponse, SmsLogDto } from "@confirmly/shared-types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatPhone(phone: string): string {
  if (phone.startsWith("+63")) {
    return phone.slice(3);
  }
  return phone;
}

function truncateBody(body: string, maxLength = 60): string {
  if (body.length <= maxLength) return body;
  return body.slice(0, maxLength) + "...";
}

export default function SmsLogsPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<SmsLogDto[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchLogs() {
    try {
      const data = await apiClient.get<SmsLogListResponse>("/sms-logs");
      setLogs(data.logs);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load SMS logs");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRefresh() {
    setRefreshing(true);
    fetchLogs();
  }

  const loading = logs === null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Messages</h1>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-8 w-8" />}
          title="No messages yet"
          description="SMS reminders and replies will appear here."
        />
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge status="neutral">
                      {log.direction === "out" ? "Sent" : "Received"}
                    </Badge>
                    <span className="text-sm font-medium text-neutral-900">
                      {formatPhone(log.phone)}
                    </span>
                    {log.appointment && (
                      <span className="text-sm text-neutral-600">
                        • {log.appointment.patient.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-700">{truncateBody(log.body)}</p>
                  {log.providerStatus !== "logged" && log.providerStatus !== "sent" && (
                    <p className="text-xs text-neutral-500">Status: {log.providerStatus}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="whitespace-nowrap text-xs text-neutral-500">
                    {formatTimestamp(log.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
