"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ClipboardList } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { WaitlistEntryDto } from "@confirmly/shared-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { useToast } from "@/components/ui/ToastProvider";

export default function WaitlistPage() {
  const toast = useToast();
  const [entries, setEntries] = useState<WaitlistEntryDto[] | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [desiredStart, setDesiredStart] = useState("");
  const [desiredEnd, setDesiredEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [offerTarget, setOfferTarget] = useState<WaitlistEntryDto | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const data = await apiClient.get<WaitlistEntryDto[]>("/waitlist");
      setEntries(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load waitlist");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable fetch, not re-created per toast identity
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    fetchEntries();
  }, [fetchEntries]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
      toast.success("Added to waitlist.");
      await fetchEntries();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendOfferNow(entry: WaitlistEntryDto) {
    setOfferingId(entry.id);
    try {
      await apiClient.post(`/waitlist/${entry.id}/send-offer`, {
        startsAt: entry.desiredStart,
        endsAt: entry.desiredEnd,
      });
      toast.success("Offer sent.");
      await fetchEntries();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setOfferingId(null);
    }
  }

  const loading = entries === null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add to waitlist</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              Patient name
              <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              Patient phone
              <Input
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="+639171234567"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              Desired start
              <Input
                type="datetime-local"
                value={desiredStart}
                onChange={(e) => setDesiredStart(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              Desired end
              <Input
                type="datetime-local"
                value={desiredEnd}
                onChange={(e) => setDesiredEnd(e.target.value)}
                required
              />
            </label>
            <Button type="submit" disabled={submitting} className="mt-1 self-start">
              {submitting ? "Adding..." : "Add to waitlist"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Waitlist entries</CardTitle>
        </CardHeader>
        {loading ? (
          <CardContent className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        ) : entries.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<ClipboardList className="h-8 w-8" />}
              title="No one on the waitlist"
              description="Patients added here will be offered a slot automatically when one frees up."
            />
          </CardContent>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Patient name</TableHeaderCell>
                <TableHeaderCell>Phone</TableHeaderCell>
                <TableHeaderCell>Desired range</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Added</TableHeaderCell>
                <TableHeaderCell></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.patientName}</TableCell>
                  <TableCell>{entry.patientPhone}</TableCell>
                  <TableCell>
                    {new Date(entry.desiredStart).toLocaleString()} –{" "}
                    {new Date(entry.desiredEnd).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge status={entry.status}>{entry.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(entry.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {entry.status === "waiting" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setOfferTarget(entry)}
                        disabled={offeringId === entry.id}
                      >
                        {offeringId === entry.id ? "Sending..." : "Send offer now"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={offerTarget !== null}
        title="Send offer now?"
        message="This immediately sends the patient an SMS offering this slot. They'll have first claim on it."
        confirmLabel="Send offer"
        cancelLabel="Not yet"
        destructive={false}
        onCancel={() => setOfferTarget(null)}
        onConfirm={() => {
          if (offerTarget) handleSendOfferNow(offerTarget);
          setOfferTarget(null);
        }}
      />
    </div>
  );
}
