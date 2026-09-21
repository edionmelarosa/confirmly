"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { UserPlus, Search } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";

interface PatientRow {
  id: string;
  name: string;
  phone: string;
  appointments: { startsAt: string }[];
  recurrenceRules: { status: string; ruleType: string }[];
}

export default function PatientsPage() {
  const toast = useToast();
  const [patients, setPatients] = useState<PatientRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const data = await apiClient.get<PatientRow[]>("/patients");
      setPatients(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load patients");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!patients) return [];
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) => p.name.toLowerCase().includes(q) || p.phone.toLowerCase().includes(q),
    );
  }, [patients, query]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post("/patients", { name, phone, mode: "create" });
      toast.success("Client added.");
      setAddOpen(false);
      setName("");
      setPhone("");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">Patients</h1>
        <Button type="button" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Add client
        </Button>
      </div>

      <label className="flex max-w-sm items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm">
        <Search className="h-4 w-4 text-neutral-400" />
        <input
          className="w-full outline-none"
          placeholder="Search name or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {patients === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No patients yet"
          description="Add a client to set up recurring visits, or book an appointment from the calendar."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Next appointment</th>
                <th className="px-3 py-2">Recurrence</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const next = p.appointments[0];
                const rule = p.recurrenceRules[0];
                return (
                  <tr key={p.id} className="border-b border-neutral-100 text-sm hover:bg-brand-50/40">
                    <td className="px-3 py-2 font-medium text-neutral-900">
                      <Link href={`/dashboard/patients/${p.id}`} className="text-brand-700 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-neutral-600">{p.phone}</td>
                    <td className="px-3 py-2 text-neutral-600">
                      {next
                        ? new Date(next.startsAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {rule ? (
                        <Badge status={rule.status === "active" ? "confirmed" : "scheduled"}>
                          {rule.status}
                        </Badge>
                      ) : (
                        <span className="text-neutral-400">None</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <Dialog open onClose={() => setAddOpen(false)}>
          <form onSubmit={handleAdd}>
            <DialogHeader>
              <DialogTitle>Add client</DialogTitle>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Name
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Phone
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+639171234567"
                  required
                />
              </label>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Add client"}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
    </div>
  );
}
