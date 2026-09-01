import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import ICAL from "ical.js";
import { serializeIcs, type IcsEvent } from "../../apps/calendar/src/ics";

const updatedAt = new Date("2026-09-01T18:00:00Z");

const base: IcsEvent = {
  seriesId: "provider-acceptance",
  occurrenceId: "1",
  recurrenceKey: "once:1",
  seriesRevision: "7",
  occurrenceRevision: "7",
  updatedAt,
  start: new Date("2026-09-10T15:00:00Z"),
  end: new Date("2026-09-10T16:00:00Z"),
  title: "Planning, review; 旅行 ✨ \\ notes",
  notes: "First line\nSecond line, semicolon; backslash \\",
  location: "Room 1; west, north",
  availability: "busy",
  allDay: false,
  timeZone: "America/Chicago",
  status: "normal",
  source: "owner",
};

export const providerAcceptanceEvents: IcsEvent[] = [
  base,
  {
    ...base,
    seriesId: "provider-all-day",
    occurrenceId: "2",
    recurrenceKey: "20260912",
    start: new Date("2026-09-12T05:00:00Z"),
    end: new Date("2026-09-13T05:00:00Z"),
    title: "All-day free",
    notes: "",
    location: "",
    availability: "free",
    allDay: true,
  },
  {
    ...base,
    seriesId: "provider-dst-series",
    occurrenceId: "3",
    recurrenceKey: "20261026T090000",
    start: new Date("2026-10-26T14:00:00Z"),
    end: new Date("2026-10-26T14:30:00Z"),
    title: "DST weekly wall time",
    notes: "Materialized before the America/Chicago fall transition.",
    location: "",
  },
  {
    ...base,
    seriesId: "provider-dst-series",
    occurrenceId: "4",
    recurrenceKey: "20261102T090000",
    occurrenceRevision: "8",
    start: new Date("2026-11-02T15:00:00Z"),
    end: new Date("2026-11-02T15:45:00Z"),
    title: "Overridden DST occurrence",
    notes: "Materialized after the America/Chicago fall transition.",
    location: "",
    status: "overridden",
  },
  {
    ...base,
    seriesId: "excluded-hold",
    occurrenceId: "5",
    recurrenceKey: "hold:5",
    title: "MUST NOT IMPORT tentative hold",
    status: "hold",
    source: "rendezvous",
  },
  {
    ...base,
    seriesId: "excluded-cancelled",
    occurrenceId: "6",
    recurrenceKey: "cancelled:6",
    title: "MUST NOT IMPORT cancelled event",
    status: "cancelled",
  },
];

export function buildProviderFixture(): string {
  return serializeIcs(providerAcceptanceEvents, {
    calendarId: "calendar-0.6.6-provider-acceptance",
    calendarName: "Neutron Calendar 0.6.6 acceptance",
    includeDetails: true,
  });
}

export type ProviderFixtureReport = {
  sha256: string;
  bytes: number;
  eventCount: number;
  summaries: string[];
  busyCount: number;
  freeCount: number;
  excludedStatusesAbsent: boolean;
  crlfOnly: boolean;
  maxPhysicalLineBytes: number;
};

export function validateProviderFixture(contents: string): ProviderFixtureReport {
  const crlfOnly = !/(?<!\r)\n/u.test(contents) && contents.endsWith("\r\n");
  const physicalLineBytes = contents.split("\r\n").filter(Boolean).map((line) => new TextEncoder().encode(line).byteLength);
  const component = new ICAL.Component(ICAL.parse(contents));
  const events = component.getAllSubcomponents("vevent");
  const summaries = events.map((event) => String(event.getFirstPropertyValue("summary")));
  const statuses = events.map((event) => String(event.getFirstPropertyValue("status")));
  const transparency = events.map((event) => String(event.getFirstPropertyValue("transp")));
  const starts = events.map((event) => String(event.getFirstPropertyValue("dtstart")));

  const require = (condition: boolean, message: string) => {
    if (!condition) throw new Error(`Provider fixture validation failed: ${message}`);
  };
  require(events.length === 4, `expected 4 exported events, received ${events.length}`);
  require(crlfOnly, "line endings are not exclusively CRLF");
  require(Math.max(...physicalLineBytes) <= 75, "a physical content line exceeds 75 UTF-8 octets");
  require(statuses.every((status) => status === "CONFIRMED"), "cancelled or tentative status escaped filtering");
  require(!contents.includes("MUST NOT IMPORT"), "excluded hold or cancelled content is present");
  require(summaries.includes("Planning, review; 旅行 ✨ \\ notes"), "Unicode/escaped summary did not round-trip");
  require(events[0]?.getFirstPropertyValue("description") === "First line\nSecond line, semicolon; backslash \\", "escaped description did not round-trip");
  require(transparency.filter((value) => value === "OPAQUE").length === 3, "Busy projection is wrong");
  require(transparency.filter((value) => value === "TRANSPARENT").length === 1, "Free projection is wrong");
  require(starts.includes("2026-10-26T14:00:00Z") && starts.includes("2026-11-02T15:00:00Z"), "DST materializations are missing");
  require(summaries.filter((value) => value === "Overridden DST occurrence").length === 1, "override is not represented exactly once");

  return {
    sha256: createHash("sha256").update(contents).digest("hex"),
    bytes: new TextEncoder().encode(contents).byteLength,
    eventCount: events.length,
    summaries,
    busyCount: transparency.filter((value) => value === "OPAQUE").length,
    freeCount: transparency.filter((value) => value === "TRANSPARENT").length,
    excludedStatusesAbsent: !contents.includes("MUST NOT IMPORT"),
    crlfOnly,
    maxPhysicalLineBytes: Math.max(...physicalLineBytes),
  };
}

if (import.meta.main) {
  const output = resolve(process.argv[2] ?? "test-evidence/calendar-0.6.6/calendar-provider-import.ics");
  const contents = buildProviderFixture();
  const report = validateProviderFixture(contents);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, contents, "utf8");
  await writeFile(`${output}.validation.json`, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output, report }, null, 2));
}
