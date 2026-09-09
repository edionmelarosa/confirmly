"use client";

import { useEffect, useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { PatientSessionResponse } from "@confirmly/shared-types";
import { RescheduleView } from "./RescheduleView";
import { WaitlistClaimView } from "./WaitlistClaimView";

interface PatientSessionViewProps {
  token: string;
}

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; session: PatientSessionResponse }
  | { status: "rescheduled" }
  | { status: "claimed" };

export function PatientSessionView({ token }: PatientSessionViewProps) {
  const [state, setState] = useState<ViewState>({ status: "loading" });

  useEffect(() => {
    apiClient
      .get<PatientSessionResponse>(`/api/patient/session/${token}`)
      .then((session) => setState({ status: "ready", session }))
      .catch((err) => {
        const message =
          err instanceof ApiError && err.status === 410
            ? "This link has expired or was already used."
            : "Something went wrong loading your appointment.";
        setState({ status: "error", message });
      });
  }, [token]);

  if (state.status === "loading") {
    return <p className="text-center text-neutral-500">Loading…</p>;
  }

  if (state.status === "error") {
    return <p className="text-center text-status-cancelled">{state.message}</p>;
  }

  if (state.status === "rescheduled") {
    return (
      <div className="text-center">
        <p className="text-lg font-medium text-status-confirmed">Your appointment has been rescheduled.</p>
        <p className="mt-2 text-neutral-600">A confirmation SMS has been sent to your phone.</p>
      </div>
    );
  }

  if (state.status === "claimed") {
    return (
      <div className="text-center">
        <p className="text-lg font-medium text-status-confirmed">You&apos;re booked!</p>
        <p className="mt-2 text-neutral-600">A confirmation SMS has been sent to your phone.</p>
      </div>
    );
  }

  if (state.session.purpose === "waitlist_claim") {
    return (
      <WaitlistClaimView token={token} session={state.session} onClaimed={() => setState({ status: "claimed" })} />
    );
  }

  return (
    <RescheduleView token={token} session={state.session} onRescheduled={() => setState({ status: "rescheduled" })} />
  );
}
