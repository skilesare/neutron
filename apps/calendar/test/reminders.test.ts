import { expect, test } from "bun:test";
import { nextReminderWakeAt, parseReminderSchedule, projectReminderSnapshot, REMINDER_GRACE_MS, REMINDER_RECOVERY_POLL_MS, type ReminderItem } from "../src/reminders";

const now = Date.parse("2026-09-01T15:00:00.000Z");
const item = (id: string, dueAt: number, startAt = now + 60 * 60_000): ReminderItem => ({ id, seriesId: id, title: `Event ${id}`, source: "owner", status: "normal", startAt, endAt: startAt + 30 * 60_000, dueAt, offsetMinutes: 60 });

test("projects due, future, today, missed, and capped reminder state deterministically", () => {
  const due = Array.from({ length: 105 }, (_, index) => item(String(index), now - 1_000));
  const future = item("future", now + 30_000);
  const missed = item("missed", now - REMINDER_GRACE_MS - 1);
  const snapshot = projectReminderSnapshot({ revision: "42", total: 107, items: [...due, future, missed] }, now, "UTC");
  expect(snapshot.badge).toBe(99);
  expect(snapshot.now).toHaveLength(20);
  expect(snapshot.next.map((value) => value.id)).toEqual(["future"]);
  expect(snapshot.now.some((value) => value.id === "missed")).toBe(false);
  expect(snapshot.lifecycle).toContain("while this Neutron is open");
});

test("next wake uses the next due time, grace expiry, then bounded recovery polling", () => {
  const future = item("future", now + 12_345);
  let snapshot = projectReminderSnapshot({ revision: "1", total: 1, items: [future] }, now, "UTC");
  expect(nextReminderWakeAt(snapshot, now)).toBe(future.dueAt);
  const due = item("due", now - 5_000);
  snapshot = projectReminderSnapshot({ revision: "2", total: 1, items: [due] }, now, "UTC");
  expect(nextReminderWakeAt(snapshot, now)).toBe(due.dueAt + REMINDER_GRACE_MS + 1);
  snapshot = projectReminderSnapshot({ revision: "3", total: 0, items: [] }, now, "UTC");
  expect(nextReminderWakeAt(snapshot, now)).toBe(now + REMINDER_RECOVERY_POLL_MS);
});

test("parses the bounded backend wire without leaking notes or locations", () => {
  const parsed = parseReminderSchedule({ revision: "7", total: "1", reminders: [{ due_at_ns: String(BigInt(now) * 1_000_000n), offset_minutes: 15, occurrence: { id: "9", series_id: "4", title: "Private title", source: "rendezvous", status: "confirmed", start_ns: String(BigInt(now + 15 * 60_000) * 1_000_000n), end_ns: String(BigInt(now + 45 * 60_000) * 1_000_000n), notes: "not projected", location: "not projected" } }] });
  expect(parsed.items[0]).toEqual({ id: "9", seriesId: "4", title: "Private title", source: "rendezvous", status: "confirmed", startAt: now + 15 * 60_000, endAt: now + 45 * 60_000, dueAt: now, offsetMinutes: 15 });
  expect(parsed.items[0]).not.toHaveProperty("notes");
  expect(parsed.items[0]).not.toHaveProperty("location");
});
