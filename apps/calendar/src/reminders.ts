import { isJsonObject, type JsonValue } from "neutron-tools/app";

export const REMINDER_GRACE_MS = 15 * 60_000;
export const REMINDER_LOOKAHEAD_MS = 7 * 86_400_000;
export const REMINDER_RECOVERY_POLL_MS = 60_000;

export type ReminderItem = {
  id: string;
  seriesId: string;
  title: string;
  source: "owner" | "rendezvous";
  status: string;
  startAt: number;
  endAt: number;
  dueAt: number;
  offsetMinutes: number;
};

export type ReminderSchedule = {
  revision: string;
  total: number;
  items: ReminderItem[];
};

export type ReminderSnapshot = {
  version: 1;
  revision: string;
  generatedAt: string;
  timeZone: string;
  badge: number;
  now: ReminderItem[];
  next: ReminderItem[];
  today: ReminderItem[];
  truncated: boolean;
  lifecycle: string;
};

export function parseReminderSchedule(value: JsonValue): ReminderSchedule {
  const root = object(value, "reminder schedule");
  const rows = array(root.reminders, "reminders");
  return {
    revision: nat(root.revision, "revision"),
    total: Number(nat(root.total, "total")),
    items: rows.map((row) => {
      const item = object(row, "reminder");
      const occurrence = object(item.occurrence, "occurrence");
      const source = text(occurrence.source, "source");
      if (source !== "owner" && source !== "rendezvous") throw new Error("Invalid reminder source");
      return {
        id: nat(occurrence.id, "occurrence id"),
        seriesId: nat(occurrence.series_id, "series id"),
        title: text(occurrence.title, "title"),
        source,
        status: text(occurrence.status, "status"),
        startAt: milliseconds(occurrence.start_ns, "start"),
        endAt: milliseconds(occurrence.end_ns, "end"),
        dueAt: milliseconds(item.due_at_ns, "due time"),
        offsetMinutes: Number(nat(item.offset_minutes, "offset")),
      };
    }),
  };
}

export function projectReminderSnapshot(schedule: ReminderSchedule, now: number, timeZone: string): ReminderSnapshot {
  const active = schedule.items.filter((item) => item.endAt > now && item.dueAt >= now - REMINDER_GRACE_MS).sort(compareDue);
  const actionable = active.filter((item) => item.dueAt <= now);
  const nowItems = actionable.slice(0, 20);
  const upcoming = active.filter((item) => item.dueAt > now);
  const todayKey = localDateKey(now, timeZone);
  return {
    version: 1,
    revision: schedule.revision,
    generatedAt: new Date(now).toISOString(),
    timeZone,
    badge: Math.min(99, actionable.length),
    now: nowItems,
    next: upcoming.slice(0, 5),
    today: active.filter((item) => localDateKey(item.startAt, timeZone) === todayKey).slice(0, 20),
    truncated: schedule.total > schedule.items.length,
    lifecycle: "Reminders appear while this Neutron is open. Calendar catches up only within a 15-minute grace window after resume.",
  };
}

export function nextReminderWakeAt(snapshot: ReminderSnapshot, now: number): number {
  const candidates = [
    ...snapshot.next.map((item) => item.dueAt),
    ...snapshot.now.map((item) => item.dueAt + REMINDER_GRACE_MS + 1),
  ].filter((value) => value > now);
  return candidates.length ? Math.min(...candidates) : now + REMINDER_RECOVERY_POLL_MS;
}

function compareDue(left: ReminderItem, right: ReminderItem): number {
  return left.dueAt - right.dueAt || left.startAt - right.startAt || left.id.localeCompare(right.id);
}

function localDateKey(value: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function object(value: JsonValue | undefined, label: string): Record<string, JsonValue> {
  if (!isJsonObject(value)) throw new Error(`Invalid ${label}`);
  return value;
}
function array(value: JsonValue | undefined, label: string): JsonValue[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value;
}
function text(value: JsonValue | undefined, label: string): string {
  if (typeof value !== "string") throw new Error(`Invalid ${label}`);
  return value;
}
function nat(value: JsonValue | undefined, label: string): string {
  const result = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : typeof value === "string" ? value : "";
  if (!/^(0|[1-9][0-9]*)$/u.test(result)) throw new Error(`Invalid ${label}`);
  return result;
}
function milliseconds(value: JsonValue | undefined, label: string): number {
  const result = Number(BigInt(nat(value, label)) / 1_000_000n);
  if (!Number.isSafeInteger(result)) throw new Error(`Invalid ${label}`);
  return result;
}
