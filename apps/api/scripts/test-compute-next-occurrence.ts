import { computeNextOccurrence } from "../src/services/recurrence";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const from = new Date("2026-09-21T02:00:00.000Z");
const nextWeeks = computeNextOccurrence(
  { ruleType: "every_n_weeks", intervalWeeks: 2, dayOfMonth: null },
  from,
);
assert(nextWeeks.toISOString() === "2026-10-05T02:00:00.000Z", `weeks got ${nextWeeks.toISOString()}`);

const fromJan = new Date("2026-01-31T02:00:00.000Z");
const nextMonth = computeNextOccurrence(
  { ruleType: "day_of_month", intervalWeeks: null, dayOfMonth: 31 },
  fromJan,
);
assert(nextMonth.getUTCMonth() === 1, "expected February");
assert(nextMonth.getUTCDate() === 28, `expected Feb 28 got ${nextMonth.getUTCDate()}`);

console.log("computeNextOccurrence ok");
