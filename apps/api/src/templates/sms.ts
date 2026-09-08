export interface ReminderTemplateParams {
  clinicName: string;
  clinicTimezone: string;
  startsAt: Date;
}

export function renderReminderSms(params: ReminderTemplateParams): string {
  const formatted = new Intl.DateTimeFormat("en-PH", {
    timeZone: params.clinicTimezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(params.startsAt);

  return (
    `${params.clinicName}: You have an appointment on ${formatted}. ` +
    `Reply C to confirm, R to reschedule, or X to cancel.`
  );
}
