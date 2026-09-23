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
  | { status: "rescheduled"; newTime: string; timezone: string }
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
    const newTimeDate = new Date(state.newTime);
    const formattedTime = newTimeDate.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: state.timezone,
    });

    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div>
          <p className="text-lg font-medium text-status-confirmed">Your appointment has been rescheduled.</p>
          <p className="mt-2 text-neutral-700">New time: {formattedTime}</p>
          <p className="mt-1 text-sm text-neutral-600">A confirmation SMS has been sent to your phone.</p>
        </div>
        <button
          onClick={() => window.close()}
          className="rounded-lg bg-brand-600 px-6 py-2 font-medium text-white hover:bg-brand-700"
        >
          Done
        </button>
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

  if (state.session.purpose === "manage" || state.session.purpose === "reschedule") {
    return (
      <RescheduleView
        token={token}
        session={state.session}
        onRescheduled={(newTime: string) =>
          setState({ status: "rescheduled", newTime, timezone: state.session.clinic.timezone })
        }
      />
    );
  }

  if (state.session.purpose === "invite_to_book") {
    return (
      <RescheduleView
        token={token}
        session={state.session}
        onRescheduled={(newTime: string) =>
          setState({ status: "rescheduled", newTime, timezone: state.session.clinic.timezone })
        }
      />
    );
  }

  return null;
}
