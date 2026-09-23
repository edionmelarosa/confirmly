"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { AvailableSlotDto, PatientSessionClinicDto, PatientSessionResponse } from "@confirmly/shared-types";
import { describeSlot } from "./format";
import { RescheduleView } from "./RescheduleView";
import { WaitlistClaimView } from "./WaitlistClaimView";

interface PatientSessionViewProps {
  token: string;
}

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; session: PatientSessionResponse }
  | { status: "done"; kind: "booked" | "rescheduled"; slot: AvailableSlotDto; clinic: PatientSessionClinicDto }
  | { status: "cancelled" }
  | { status: "claimed" };

function SlotSummary({ slot, clinic }: { slot: AvailableSlotDto; clinic: PatientSessionClinicDto }) {
  const { date, time } = describeSlot(slot, clinic.timezone, clinic.sessionHours);
  return (
    <div className="w-full rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-lg font-semibold text-neutral-900">{date}</p>
      <p className="text-neutral-700">{time}</p>
    </div>
  );
}

export function PatientSessionView({ token }: PatientSessionViewProps) {
  const [state, setState] = useState<ViewState>({ status: "loading" });

  useEffect(() => {
    apiClient
      .get<PatientSessionResponse>(`/api/patient/session/${token}`)
      .then((session) => setState({ status: "ready", session }))
      .catch((err) => {
        const message =
          err instanceof ApiError && err.code === "already_booked"
            ? "You already have an upcoming appointment. Please contact the clinic to change it."
            : err instanceof ApiError && err.status === 410
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

  if (state.status === "done") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 className="h-12 w-12 text-status-confirmed" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {state.kind === "booked" ? "You're booked!" : "Appointment rescheduled"}
          </h1>
          <p className="mt-1 text-neutral-600">
            Your appointment with {state.clinic.name} is {state.kind === "booked" ? "scheduled" : "now"} for:
          </p>
        </div>
        <SlotSummary slot={state.slot} clinic={state.clinic} />
        <p className="text-sm text-neutral-600">
          Please arrive a few minutes early. If you need to change your appointment, please contact the clinic.
        </p>
      </div>
    );
  }

  if (state.status === "cancelled") {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">Appointment cancelled</h1>
        <p className="mt-2 text-neutral-600">Please contact the clinic if you&apos;d like to book again.</p>
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

  const session = state.session;

  if (session.purpose === "waitlist_claim") {
    return <WaitlistClaimView token={token} session={session} onClaimed={() => setState({ status: "claimed" })} />;
  }

  return (
    <RescheduleView
      token={token}
      session={session}
      onRescheduled={(_newTime, slot) =>
        setState(
          slot
            ? {
                status: "done",
                kind: session.purpose === "invite_to_book" ? "booked" : "rescheduled",
                slot,
                clinic: session.clinic,
              }
            : { status: "cancelled" },
        )
      }
    />
  );
}
