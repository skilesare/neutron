import { expect, test } from "bun:test";
import { ICS_IMPORT_LIMITS, parseIcsImport } from "../src/ics_import";
import { serializeIcs } from "../src/ics";

const calendar = (body: string, extra = "") => [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Neutron Calendar Import Test//EN",
  extra,
  body,
  "END:VCALENDAR",
  "",
].filter(Boolean).join("\r\n");

test("parses deterministic UTC, floating, and all-day events", async () => {
  const source = calendar([
    "BEGIN:VEVENT",
    "UID:utc@example.test",
    "SEQUENCE:4",
    "DTSTART:20260901T150000Z",
    "DTEND:20260901T160000Z",
    "SUMMARY:UTC event",
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:floating@example.test",
    "DTSTART:20260901T090000",
    "DTEND:20260901T093000",
    "SUMMARY:Floating event",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:all-day@example.test",
    "DTSTART;VALUE=DATE:20260902",
    "DTEND;VALUE=DATE:20260904",
    "SUMMARY:Two days",
    "END:VEVENT",
  ].join("\r\n"), "X-WR-CALNAME:Imported test");

  const first = await parseIcsImport(source, { defaultTimeZone: "America/Chicago" });
  const second = await parseIcsImport(source, { defaultTimeZone: "America/Chicago" });
  expect(second).toEqual(first);
  expect(first.sourceNamespace).toBe("ics:-//Neutron Calendar Import Test//EN");
  expect(first.calendarName).toBe("Imported test");
  expect(first.series.map((series) => series.uid)).toEqual(["all-day@example.test", "floating@example.test", "utc@example.test"]);
  expect(first.series[0]!.occurrences[0]).toMatchObject({ startIso: "2026-09-02T05:00:00.000Z", endIso: "2026-09-04T05:00:00.000Z", allDay: true });
  expect(first.series[1]!.occurrences[0]).toMatchObject({ startIso: "2026-09-01T14:00:00.000Z", endIso: "2026-09-01T14:30:00.000Z", timeZone: "America/Chicago" });
  expect(first.series[2]!.occurrences[0]).toMatchObject({ availability: "free", timeZone: "UTC" });
  expect(first.series[2]!.sequence).toBe(4);
  expect(first.series[2]!.contentDigest).toMatch(/^[a-f0-9]{64}$/u);
});

test("expands recurrence, EXDATE, and RECURRENCE-ID overrides", async () => {
  const result = await parseIcsImport(calendar([
    "BEGIN:VEVENT",
    "UID:weekly@example.test",
    "DTSTART;TZID=America/Chicago:20260907T090000",
    "DTEND;TZID=America/Chicago:20260907T093000",
    "RRULE:FREQ=WEEKLY;COUNT=4",
    "EXDATE;TZID=America/Chicago:20260914T090000",
    "SUMMARY:Weekly",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:weekly@example.test",
    "RECURRENCE-ID;TZID=America/Chicago:20260921T090000",
    "DTSTART;TZID=America/Chicago:20260921T110000",
    "DTEND;TZID=America/Chicago:20260921T114500",
    "SUMMARY:Moved weekly",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:weekly@example.test",
    "RECURRENCE-ID;TZID=America/Chicago:20260928T090000",
    "DTSTART;TZID=America/Chicago:20260928T090000",
    "DTEND;TZID=America/Chicago:20260928T093000",
    "STATUS:CANCELLED",
    "SUMMARY:Cancelled weekly",
    "END:VEVENT",
  ].join("\r\n")), { defaultTimeZone: "UTC" });

  const occurrences = result.series[0]!.occurrences;
  expect(occurrences).toHaveLength(3);
  expect(occurrences.map((item) => [item.title, item.startIso, item.status])).toEqual([
    ["Weekly", "2026-09-07T14:00:00.000Z", "normal"],
    ["Moved weekly", "2026-09-21T16:00:00.000Z", "normal"],
    ["Cancelled weekly", "2026-09-28T14:00:00.000Z", "cancelled"],
  ]);
});

test("supports RDATE additions", async () => {
  const result = await parseIcsImport(calendar([
    "BEGIN:VEVENT", "UID:rdate@example.test", "DTSTART:20260901T150000Z", "DTEND:20260901T160000Z", "RDATE:20260903T150000Z,20260905T150000Z", "SUMMARY:RDATE event", "END:VEVENT",
  ].join("\r\n")), { defaultTimeZone: "UTC" });
  expect(result.series[0]!.occurrences.map((item) => item.startIso)).toEqual(["2026-09-01T15:00:00.000Z", "2026-09-03T15:00:00.000Z", "2026-09-05T15:00:00.000Z"]);
});

test("round-trips the supported export subset with occurrence semantics intact", async () => {
  const exported = serializeIcs([{ seriesId: "1", occurrenceId: "2", recurrenceKey: "once", seriesRevision: "1", occurrenceRevision: "1", updatedAt: new Date("2026-09-01T12:00:00Z"), start: new Date("2026-09-02T15:00:00Z"), end: new Date("2026-09-02T16:00:00Z"), title: "Round trip", notes: "Plain notes", location: "Room 2", availability: "free", allDay: false, timeZone: "UTC", status: "normal", source: "owner" }], { calendarId: "test", calendarName: "Round trip", includeDetails: true });
  const result = await parseIcsImport(exported, { defaultTimeZone: "America/Chicago" });
  expect(result.series).toHaveLength(1);
  expect(result.series[0]!.occurrences[0]).toMatchObject({ startIso: "2026-09-02T15:00:00.000Z", endIso: "2026-09-02T16:00:00.000Z", title: "Round trip", notes: "Plain notes", location: "Room 2", availability: "free", allDay: false, timeZone: "UTC" });
});

test("rejects scheduling messages and skips unsafe scheduling surfaces", async () => {
  const method = await parseIcsImport(calendar([
    "BEGIN:VEVENT",
    "UID:invite@example.test",
    "DTSTART:20260901T150000Z",
    "DTEND:20260901T160000Z",
    "SUMMARY:Invite",
    "END:VEVENT",
  ].join("\r\n"), "METHOD:REQUEST"), { defaultTimeZone: "UTC" });
  expect(method.series).toHaveLength(0);
  expect(method.diagnostics.map((item) => item.code)).toContain("unsupported_method");

  const unsafe = await parseIcsImport(calendar([
    "BEGIN:VEVENT",
    "UID:attendee@example.test",
    "DTSTART:20260901T150000Z",
    "DTEND:20260901T160000Z",
    "ATTENDEE:mailto:someone@example.test",
    "ORGANIZER:mailto:owner@example.test",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT5M",
    "DESCRIPTION:Alarm",
    "END:VALARM",
    "END:VEVENT",
  ].join("\r\n")), { defaultTimeZone: "UTC" });
  expect(unsafe.series).toHaveLength(0);
  expect(unsafe.diagnostics[0]).toMatchObject({ code: "unsupported_scheduling", uid: "attendee@example.test" });
});

test("reports invalid event data without importing partial series", async () => {
  const oversized = "x".repeat(ICS_IMPORT_LIMITS.titleBytes + 1);
  const result = await parseIcsImport(calendar([
    "BEGIN:VEVENT",
    "UID:bad-title@example.test",
    "DTSTART:20260901T150000Z",
    "DTEND:20260901T160000Z",
    `SUMMARY:${oversized}`,
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:missing-start@example.test",
    "DTEND:20260901T160000Z",
    "SUMMARY:Missing start",
    "END:VEVENT",
  ].join("\r\n")), { defaultTimeZone: "UTC" });
  expect(result.series).toHaveLength(0);
  expect(result.diagnostics.map((item) => item.code)).toContain("title_too_large");
  expect(result.diagnostics.map((item) => item.code)).toContain("missing_dtstart");
});

test("fails closed on malformed input, invalid zones, and hard file bounds", async () => {
  await expect(parseIcsImport("not a calendar", { defaultTimeZone: "UTC" })).rejects.toThrow("Invalid iCalendar syntax");
  await expect(parseIcsImport(calendar(""), { defaultTimeZone: "Not/A_Zone" })).rejects.toThrow("valid IANA default time zone");
  await expect(parseIcsImport("X".repeat(ICS_IMPORT_LIMITS.bytes + 1), { defaultTimeZone: "UTC" })).rejects.toThrow("exceeds 1,048,576 bytes");
  await expect(parseIcsImport(calendar("BEGIN:VEVENT\r\nUID:bad\0uid\r\nEND:VEVENT"), { defaultTimeZone: "UTC" })).rejects.toThrow("invalid or replacement characters");
  await expect(parseIcsImport(calendar("BEGIN:VEVENT\r\nUID:bad\uFFFDuid\r\nEND:VEVENT"), { defaultTimeZone: "UTC" })).rejects.toThrow("invalid or replacement characters");
  const excessiveLines = `${"\r\n".repeat(ICS_IMPORT_LIMITS.lines)}X`;
  await expect(parseIcsImport(excessiveLines, { defaultTimeZone: "UTC" })).rejects.toThrow("exceeds 20,000 lines");
});

test("bounds unending recurrence expansion", async () => {
  const result = await parseIcsImport(calendar([
    "BEGIN:VEVENT",
    "UID:forever@example.test",
    "DTSTART:20260901T150000Z",
    "DTEND:20260901T160000Z",
    "RRULE:FREQ=DAILY",
    "SUMMARY:Forever",
    "END:VEVENT",
  ].join("\r\n")), { defaultTimeZone: "UTC" });
  expect(result.series).toHaveLength(0);
  expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "recurrence_error", uid: "forever@example.test" }));
});

test("deterministically fuzzes malformed folding and text encoding boundaries", async () => {
  const base = calendar([
    "BEGIN:VEVENT",
    "UID:fuzz@example.test",
    "DTSTART:20260901T150000Z",
    "DTEND:20260901T160000Z",
    "SUMMARY:A folded plain-text summary",
    "DESCRIPTION:No value is interpreted as HTML or a formula",
    "END:VEVENT",
  ].join("\r\n"));
  let state = 0x5eed1234;
  const next = () => { state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0; return state; };
  const cases = Array.from({ length: 96 }, (_, index) => {
    const offset = next() % Math.max(1, base.length - 1);
    const insertions = ["\r\n ", "\r\n\t", "\n ", "\r\t", "\0", "\uFFFD", ":", ";VALUE=TEXT:"];
    const insertion = insertions[next() % insertions.length]!;
    const mutated = `${base.slice(0, offset)}${insertion}${base.slice(offset + (index % 3 === 0 ? 1 : 0))}`;
    return mutated.slice(0, ICS_IMPORT_LIMITS.bytes);
  });
  const summarize = async () => Promise.all(cases.map(async (source) => {
    try {
      const value = await parseIcsImport(source, { defaultTimeZone: "UTC" });
      return `ok:${value.series.length}:${value.diagnostics.map((item) => item.code).join(",")}`;
    } catch (error) {
      return `error:${error instanceof Error ? error.message : String(error)}`;
    }
  }));
  const first = await summarize();
  expect(await summarize()).toEqual(first);
  expect(first.some((result) => result.startsWith("ok:"))).toBe(true);
  expect(first.some((result) => result.startsWith("error:"))).toBe(true);
});
