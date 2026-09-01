export type RepeatFrequency = "none" | "daily" | "weekly" | "monthly" | "yearly";
export type RecurrenceDraft = {
  frequency: RepeatFrequency;
  interval: number;
  weekdays: number[];
  endMode: "count" | "until";
  count: number;
  until: string;
};
export type MaterializedOccurrence = { recurrence_key: string; start_ns: string; end_ns: string };
export type WireRecurrence = {
  frequency: Record<string, null>;
  interval: number;
  weekdays_mask: number;
  month_day: number | null;
  end: Record<string, number | string>;
};
export type MaterializationResult = { occurrences: MaterializedOccurrence[]; recurrence: WireRecurrence | null; warnings: string[]; error: string | null };

const DAY_MS = 86_400_000;
const MAX_OCCURRENCES = 730;
const toNs = (date: Date) => String(BigInt(date.getTime()) * 1_000_000n);
const pad = (value: number) => String(value).padStart(2, "0");
const keyFor = (date: Date, allDay: boolean) => `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${allDay ? "" : `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`}`;
const validDate = (date: Date) => !Number.isNaN(date.getTime());
const detectedTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function parseEditorDate(value: string, allDay: boolean, timeZone = detectedTimeZone()): Date {
  return resolveZonedEditorValue(value, timeZone, allDay).date;
}

function wallDate(value: string, allDay: boolean): Date | null {
  const parts = parseEditorParts(value, allDay);
  return parts ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)) : null;
}

function wallValue(date: Date, allDay: boolean): string {
  return formatWallParts({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(), millisecond: date.getUTCMilliseconds() }, allDay);
}

function wallTimeWarnings(label: string, input: string, timeZone: string, allDay: boolean): string[] {
  if (allDay) return [];
  const warnings: string[] = [];
  const resolved = resolveZonedEditorValue(input, timeZone, false);
  if (resolved.gap) warnings.push(`${label} falls in a daylight-saving gap and resolves to ${resolved.normalizedValue}.`);
  if (resolved.fold) warnings.push(`${label} is ambiguous at the daylight-saving fold; the earlier occurrence is used.`);
  return warnings;
}

export function materializeRecurrence(startValue: string, endValue: string, allDay: boolean, draft: RecurrenceDraft, timeZone = detectedTimeZone()): MaterializationResult {
  const start = wallDate(startValue, allDay); const end = wallDate(endValue, allDay);
  let warnings: string[] = [];
  try { warnings = [...wallTimeWarnings("Start", startValue, timeZone, allDay), ...wallTimeWarnings("End", endValue, timeZone, allDay)]; }
  catch (error) { return { occurrences: [], recurrence: null, warnings, error: error instanceof Error ? error.message : String(error) }; }
  if (!start || !end || !validDate(start) || !validDate(end) || end <= start) return { occurrences: [], recurrence: null, warnings, error: "The event end must be after its start." };
  const duration = end.getTime() - start.getTime();
  if (draft.frequency === "none") {
    const resolvedStart = resolveZonedEditorValue(startValue, timeZone, allDay).date;
    const resolvedEnd = resolveZonedEditorValue(endValue, timeZone, allDay).date;
    if (resolvedEnd <= resolvedStart) return { occurrences: [], recurrence: null, warnings, error: "The event end must be after its start." };
    return { occurrences: [{ recurrence_key: keyFor(start, allDay), start_ns: toNs(resolvedStart), end_ns: toNs(resolvedEnd) }], recurrence: null, warnings, error: null };
  }

  if (!Number.isInteger(draft.interval) || draft.interval < 1 || draft.interval > 99) return { occurrences: [], recurrence: null, warnings, error: "Repeat interval must be from 1 to 99." };
  if (draft.endMode === "count" && (!Number.isInteger(draft.count) || draft.count < 1 || draft.count > MAX_OCCURRENCES)) return { occurrences: [], recurrence: null, warnings, error: `A series must contain 1–${MAX_OCCURRENCES} occurrences.` };
  const interval = draft.interval;
  const countLimit = draft.endMode === "count" ? draft.count : MAX_OCCURRENCES + 1;
  const until = draft.endMode === "until" ? wallDate(`${draft.until}T23:59:59`, false) : null;
  if (until && (!validDate(until) || until < start)) return { occurrences: [], recurrence: null, warnings, error: "Repeat-through date must be on or after the first event." };
  const values: Date[] = [];
  const accept = (candidate: Date) => {
    if (!validDate(candidate) || candidate < start || (until && candidate > until) || values.length >= countLimit) return false;
    values.push(candidate); return true;
  };
  const finished = (candidate: Date) => !validDate(candidate) || Boolean(until && candidate > until) || values.length >= countLimit;

  if (draft.frequency === "daily") {
    for (let index = 0; values.length < countLimit; index += 1) { const candidate = new Date(start); candidate.setUTCDate(start.getUTCDate() + index * interval); if (finished(candidate)) break; accept(candidate); }
  } else if (draft.frequency === "weekly") {
    const selected = new Set(draft.weekdays.length ? draft.weekdays : [start.getUTCDay()]);
    const mondayOffset = (start.getUTCDay() + 6) % 7;
    for (let recurrenceWeek = 0; values.length < countLimit; recurrenceWeek += interval) {
      let pastUntil = false;
      for (const day of [...selected].sort((left, right) => ((left + 6) % 7) - ((right + 6) % 7))) {
        const candidate = new Date(start);
        candidate.setUTCDate(start.getUTCDate() - mondayOffset + recurrenceWeek * 7 + ((day + 6) % 7));
        if (!validDate(candidate)) { pastUntil = true; break; }
        if (until && candidate > until) { pastUntil = true; break; }
        accept(candidate);
        if (values.length >= countLimit) break;
      }
      if (pastUntil) break;
    }
  } else if (draft.frequency === "monthly") {
    const day = start.getUTCDate();
    for (let index = 0; values.length < countLimit; index += 1) { const targetMonth = start.getUTCMonth() + index * interval; const candidate = new Date(start); candidate.setUTCDate(1); candidate.setUTCMonth(targetMonth); candidate.setUTCDate(day); if (finished(candidate)) break; if (candidate.getUTCMonth() === ((targetMonth % 12) + 12) % 12) accept(candidate); }
  } else {
    const month = start.getUTCMonth(); const day = start.getUTCDate();
    for (let index = 0; values.length < countLimit; index += 1) { const year = start.getUTCFullYear() + index * interval; const candidate = new Date(start); candidate.setUTCDate(1); candidate.setUTCFullYear(year); candidate.setUTCMonth(month); candidate.setUTCDate(day); if (finished(candidate)) break; if (candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month) accept(candidate); }
  }

  if (values.length > MAX_OCCURRENCES) return { occurrences: [], recurrence: null, warnings, error: `That end date creates more than ${MAX_OCCURRENCES} occurrences. Choose an earlier date or a larger interval.` };
  if (draft.endMode === "count" && values.length !== draft.count) return { occurrences: [], recurrence: null, warnings, error: "Calendar could not materialize the requested number of occurrences." };

  const occurrences = values.map((candidate) => {
    const occurrenceEnd = new Date(candidate.getTime() + duration);
    const occurrenceStartInstant = resolveZonedEditorValue(wallValue(candidate, allDay), timeZone, allDay).date;
    const occurrenceEndInstant = resolveZonedEditorValue(wallValue(occurrenceEnd, allDay), timeZone, allDay).date;
    return { recurrence_key: keyFor(candidate, allDay), start_ns: toNs(occurrenceStartInstant), end_ns: toNs(occurrenceEndInstant) };
  });
  const weekdaysMask = draft.weekdays.reduce((mask, day) => mask | (2 ** day), 0);
  const recurrence: WireRecurrence = {
    frequency: { [draft.frequency]: null }, interval,
    weekdays_mask: draft.frequency === "weekly" ? weekdaysMask || 2 ** start.getUTCDay() : 0,
    month_day: draft.frequency === "monthly" ? start.getUTCDate() : null,
    end: draft.endMode === "count" ? { count: occurrences.length } : { until: toNs(resolveZonedEditorValue(`${draft.until}T23:59:59`, timeZone, false).date) },
  };
  return { occurrences, recurrence, warnings, error: null };
}

export function repeatSummary(draft: RecurrenceDraft): string {
  if (draft.frequency === "none") return "Does not repeat";
  const unit = draft.frequency.replace("ly", "");
  const cadence = draft.interval === 1 ? `Every ${unit}` : `Every ${draft.interval} ${unit}s`;
  const ending = draft.endMode === "count" ? `${draft.count} times` : `until ${draft.until}`;
  return `${cadence}, ${ending}`;
}
import { formatWallParts, parseEditorParts, resolveZonedEditorValue } from "./time_zone";
