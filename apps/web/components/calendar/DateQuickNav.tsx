"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toDateInputValue } from "./slots";

interface DateQuickNavProps {
  day: Date;
  onChange: (day: Date) => void;
}

function offsetFromToday(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

export function DateQuickNav({ day, onChange }: DateQuickNavProps) {
  const selected = toDateInputValue(day);
  const shortcuts = [
    { label: "Today", date: offsetFromToday(0) },
    { label: "Tomorrow", date: offsetFromToday(1) },
  ];

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Date
        <Input
          type="date"
          value={selected}
          onChange={(e) => e.target.value && onChange(new Date(`${e.target.value}T00:00:00`))}
        />
      </label>
      {shortcuts.map(({ label, date }) => {
        const active = toDateInputValue(date) === selected;
        return (
          <Button
            key={label}
            type="button"
            variant={active ? "primary" : "secondary"}
            aria-pressed={active}
            onClick={() => onChange(date)}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
