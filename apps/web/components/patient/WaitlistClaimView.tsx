"use client";

import { useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { WaitlistClaimSessionResponse } from "@confirmly/shared-types";
import { formatInClinicTz } from "./format";

interface WaitlistClaimViewProps {
  token: string;
  session: WaitlistClaimSessionResponse;
  onClaimed: () => void;
}

export function WaitlistClaimView({ token, session, onClaimed }: WaitlistClaimViewProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim() {
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/api/patient/session/${token}/claim`);
      onClaimed();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("Sorry, this slot was just taken by someone else.");
      } else if (err instanceof ApiError && err.status === 410) {
        setError("This offer has expired or was already claimed.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{session.clinic.name}</h1>
        <p className="mt-1 text-neutral-700">
          A slot opened up matching your requested time (
          {formatInClinicTz(session.desiredStart, session.clinic.timezone)} –{" "}
          {formatInClinicTz(session.desiredEnd, session.clinic.timezone)}).
        </p>
        <p className="mt-1 text-sm text-amber-600">First come, first served — claim it now before it's gone.</p>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <button
        onClick={handleClaim}
        disabled={submitting}
        className="rounded-lg bg-neutral-900 px-4 py-3 text-white active:bg-neutral-700"
      >
        {submitting ? "Claiming…" : "Claim this slot"}
      </button>
    </div>
  );
}
