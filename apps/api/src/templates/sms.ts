import type { SchedulingMode, SessionOfDay } from "@confirmly/db";

export interface ReminderTemplateParams {
  clinicName: string;
  clinicTimezone: string;
  startsAt: Date;
  schedulingMode: SchedulingMode;
  sessionOfDay?: SessionOfDay | null;
  sessionAmStartHour?: number;
  sessionAmEndHour?: number;
  sessionPmStartHour?: number;
  sessionPmEndHour?: number;
  manageLink: string;
}

export function renderReminderSms(params: ReminderTemplateParams): string {
  let timeDescription: string;

  if (params.schedulingMode === "session_capacity" && params.sessionOfDay) {
    const dateFormatted = new Intl.DateTimeFormat("en-PH", {
      timeZone: params.clinicTimezone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(params.startsAt);

    const sessionLabel = params.sessionOfDay === "am" ? "Morning" : "Afternoon";
    const startHour = params.sessionOfDay === "am" ? params.sessionAmStartHour ?? 8 : params.sessionPmStartHour ?? 13;
    const endHour = params.sessionOfDay === "am" ? params.sessionAmEndHour ?? 12 : params.sessionPmEndHour ?? 18;
    
    timeDescription = `${dateFormatted}, ${sessionLabel} (${startHour}:00 - ${endHour}:00)`;
  } else {
    timeDescription = new Intl.DateTimeFormat("en-PH", {
      timeZone: params.clinicTimezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(params.startsAt);
  }

  return (
    `${params.clinicName}: You have an appointment on ${timeDescription}. ` +
    `Reply C to confirm or X to cancel. Manage: ${params.manageLink}`
  );
}

export interface InviteToBookTemplateParams {
  clinicName: string;
  patientName: string;
  bookingLink: string;
}

export function renderInviteToBookSms(params: InviteToBookTemplateParams): string {
  return (
    `${params.clinicName}: Hi ${params.patientName}, please book your appointment: ${params.bookingLink} (link valid for 24 hours)`
  );
}
