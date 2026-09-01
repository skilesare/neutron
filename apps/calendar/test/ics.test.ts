import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import ICAL from "ical.js";
import { escapeIcsText, foldIcsLine, safeIcsFilename, serializeIcs, stableEventUid, type IcsEvent } from "../src/ics";

const timed: IcsEvent = {
  seriesId: "42",
  occurrenceId: "77",
  recurrenceKey: "20260831T120000",
  seriesRevision: "2",
  occurrenceRevision: "3",
  updatedAt: new Date("2026-08-30T12:34:56Z"),
  start: new Date("2026-08-31T17:00:00Z"),
  end: new Date("2026-08-31T18:00:00Z"),
  title: "Planning, review; Q3\\notes",
  notes: "First line\nSecond line",
  location: "Room 1; west",
  availability: "busy",
  allDay: false,
  timeZone: "America/Chicago",
  status: "normal",
  source: "owner",
};

test("serializes deterministic RFC 5545 bytes matching the golden fixture", async () => {
  const value = serializeIcs([timed], { calendarId: "calendar.example", calendarName: "My Calendar", includeDetails: true });
  const golden = (await readFile(new URL("fixtures/export-timed.ics", import.meta.url), "utf8")).replace(/\r?\n/gu, "\r\n");
  expect(value).toBe(golden);
  expect(value.replace(/\r\n/gu, "")).not.toContain("\n");
  expect(serializeIcs([timed], { calendarId: "calendar.example", calendarName: "My Calendar", includeDetails: true })).toBe(value);
});

test("golden matrix covers all-day, free, recurring, overridden, hold, cancelled, and Rendezvous events", async () => {
  const events: IcsEvent[] = [
    { ...timed, title: "Timed", notes: "", location: "" },
    { ...timed, seriesId: "43", occurrenceId: "78", recurrenceKey: "20260308", start: new Date("2026-03-08T06:00:00Z"), end: new Date("2026-03-09T05:00:00Z"), title: "All-day free Rendezvous", notes: "", location: "", availability: "free", allDay: true, status: "confirmed", source: "rendezvous" },
    { ...timed, seriesId: "50", occurrenceId: "80", recurrenceKey: "20260907T090000", seriesRevision: "4", occurrenceRevision: "1", start: new Date("2026-09-07T14:00:00Z"), end: new Date("2026-09-07T14:30:00Z"), title: "Weekly wall time", notes: "", location: "" },
    { ...timed, seriesId: "50", occurrenceId: "81", recurrenceKey: "20260914T090000", seriesRevision: "4", occurrenceRevision: "5", start: new Date("2026-09-14T15:00:00Z"), end: new Date("2026-09-14T15:30:00Z"), title: "Overridden occurrence", notes: "", location: "", status: "overridden" },
    { ...timed, seriesId: "60", occurrenceId: "90", recurrenceKey: "meeting:90", title: "Tentative hold", notes: "", location: "", status: "hold", source: "rendezvous" },
    { ...timed, seriesId: "61", occurrenceId: "91", recurrenceKey: "once:91", title: "Cancelled", notes: "", location: "", status: "cancelled" },
  ];
  const value = serializeIcs(events, { calendarId: "calendar.example", calendarName: "Matrix", includeDetails: true, includeHolds: true, includeCancelled: true });
  const golden = (await readFile(new URL("fixtures/export-matrix.ics", import.meta.url), "utf8")).replace(/\r?\n/gu, "\r\n");
  expect(value).toBe(golden);
  const parsed = new ICAL.Component(ICAL.parse(value)).getAllSubcomponents("vevent");
  expect(parsed).toHaveLength(events.length);
  expect(parsed.map((event) => event.getFirstPropertyValue("status"))).toEqual(["CONFIRMED", "CONFIRMED", "CONFIRMED", "CONFIRMED", "TENTATIVE", "CANCELLED"]);
});

test("an independent parser accepts timed, all-day, free, cancelled, and Rendezvous events", () => {
  const events: IcsEvent[] = [
    timed,
    { ...timed, seriesId: "43", recurrenceKey: "20260308", allDay: true, start: new Date("2026-03-08T06:00:00Z"), end: new Date("2026-03-09T05:00:00Z"), availability: "free", status: "cancelled", source: "rendezvous", title: "旅行 ✨" },
  ];
  const value = serializeIcs(events, { calendarId: "calendar.example", calendarName: "Neutron", includeDetails: true, includeCancelled: true });
  const parsed = new ICAL.Component(ICAL.parse(value));
  const components = parsed.getAllSubcomponents("vevent");
  expect(components).toHaveLength(2);
  expect(components[0]!.getFirstPropertyValue("uid")).toBe(stableEventUid(timed, "calendar.example"));
  expect(components[1]!.getFirstPropertyValue("dtstart").toString()).toBe("2026-03-08");
  expect(components[1]!.getFirstPropertyValue("dtend").toString()).toBe("2026-03-09");
  expect(components[1]!.getFirstPropertyValue("transp")).toBe("TRANSPARENT");
  expect(components[1]!.getFirstPropertyValue("status")).toBe("CANCELLED");
});

test("folds UTF-8 content at 75 octets without splitting code points", () => {
  const folded = foldIcsLine(`DESCRIPTION:${"旅✨".repeat(40)}`);
  for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  expect(folded.replace(/\r\n[ \t]/gu, "")).toBe(`DESCRIPTION:${"旅✨".repeat(40)}`);
  expect(() => ICAL.parse(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//EN\r\n${folded}\r\nEND:VCALENDAR\r\n`)).not.toThrow();
});

test("escapes text, hides details on request, excludes holds by default, and sanitizes filenames", () => {
  expect(escapeIcsText("a,b;c\\d\r\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  expect(serializeIcs([{ ...timed, status: "hold" }], { calendarId: "x", calendarName: "x", includeDetails: true })).not.toContain("BEGIN:VEVENT");
  const privateValue = serializeIcs([timed], { calendarId: "x", calendarName: "x", includeDetails: false });
  expect(privateValue).toContain("SUMMARY:Busy");
  expect(privateValue).not.toContain("DESCRIPTION");
  expect(privateValue).not.toContain("LOCATION");
  expect(safeIcsFilename("../../My private calendar")).toBe("My-private-calendar.ics");
});
