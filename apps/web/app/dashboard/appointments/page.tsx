import { DayCalendar } from "@/components/calendar/DayCalendar";

export default function AppointmentsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Appointments</h1>
      <DayCalendar />
    </div>
  );
}
