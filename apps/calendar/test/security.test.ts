import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { serializeIcs, type IcsEvent } from "../src/ics";

const sourceFiles = [
  "../src/index.tsx",
  "../src/service.ts",
  "../src/ics.ts",
  "../backend/main.mo",
] as const;

test("Calendar production paths contain no application logging sink", async () => {
  for (const relative of sourceFiles) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    expect(source).not.toMatch(/\bconsole\s*\./u);
    expect(source).not.toMatch(/\bDebug\s*\.\s*print\b/u);
    expect(source).not.toMatch(/\bdebug_show\b/u);
  }
});

test("ICS projection cannot serialize authorization or Rendezvous signaling metadata", () => {
  const event: IcsEvent = {
    seriesId: "41",
    occurrenceId: "99",
    recurrenceKey: "meeting:99",
    seriesRevision: "3",
    occurrenceRevision: "2",
    updatedAt: new Date("2026-08-31T12:00:00Z"),
    start: new Date("2026-09-01T12:00:00Z"),
    end: new Date("2026-09-01T12:30:00Z"),
    title: "Private title",
    notes: "Private notes",
    location: "Private room",
    availability: "busy",
    allDay: false,
    timeZone: "UTC",
    status: "confirmed",
    source: "rendezvous",
  };
  const contents = serializeIcs([event], {
    calendarId: "mxzaz-hqaaa-aaaar-qaada-cai",
    calendarName: "Calendar",
    includeDetails: false,
  });
  expect(contents).not.toContain("Private title");
  expect(contents).not.toContain("Private notes");
  expect(contents).not.toContain("Private room");
  expect(contents).not.toMatch(/principal|authorization|bearer|token|candidate|fingerprint|sdp|offer|answer/iu);
  expect(contents).not.toContain(event.source);
});

test("Calendar packages only self-scoped frontend and Agent calls", async () => {
  const tile = await readFile(new URL("../src/index.tsx", import.meta.url), "utf8");
  const service = await readFile(new URL("../src/service.ts", import.meta.url), "utf8");
  expect(tile).not.toMatch(/\bqueryApp\b|\bupdateApp\b|\bcallApp\b/u);
  expect(service).not.toMatch(/context\.kernel\.(?:queryApp|updateApp|callApp)/u);
  expect(service).toContain("context.kernel.querySelf");
  expect(service).toContain("context.kernel.updateSelf");
});
