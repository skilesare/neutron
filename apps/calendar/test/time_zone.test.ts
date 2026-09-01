import { expect, test } from "bun:test";
import {
  calendarMarkerToEditorValue,
  calendarMarkerToInstant,
  formatInstantForEditor,
  instantToCalendarMarker,
  isValidTimeZone,
  resolveZonedEditorValue,
  supportedTimeZones,
} from "../src/time_zone";

test("validates and enumerates IANA zones", () => {
  expect(isValidTimeZone("UTC")).toBe(true);
  expect(isValidTimeZone("America/Chicago")).toBe(true);
  expect(isValidTimeZone("Not/AZone")).toBe(false);
  expect(supportedTimeZones("America/Chicago")).toContain("America/Chicago");
});

test("resolves exact local wall times in representative zones", () => {
  const fixtures = [
    ["UTC", "2026-08-31T12:15", "2026-08-31T12:15"],
    ["America/Chicago", "2026-08-31T12:15", "2026-08-31T17:15"],
    ["America/New_York", "2026-08-31T12:15", "2026-08-31T16:15"],
    ["Europe/London", "2026-08-31T12:15", "2026-08-31T11:15"],
    ["Asia/Kolkata", "2026-08-31T12:15", "2026-08-31T06:45"],
  ];
  for (const [zone, local, utc] of fixtures) {
    const resolved = resolveZonedEditorValue(local!, zone!);
    expect(resolved.date.toISOString().slice(0, 16)).toBe(utc);
    expect(resolved.normalizedValue).toBe(local);
    expect(resolved.gap).toBe(false);
    expect(resolved.fold).toBe(false);
  }
});

test("normalizes a DST gap and deterministically chooses the earlier fold instant", () => {
  const gap = resolveZonedEditorValue("2026-03-08T02:30", "America/Chicago");
  expect(gap.gap).toBe(true);
  expect(gap.normalizedValue).toBe("2026-03-08T03:30");
  expect(gap.date.toISOString()).toBe("2026-03-08T08:30:00.000Z");

  const fold = resolveZonedEditorValue("2026-11-01T01:30", "America/Chicago");
  expect(fold.fold).toBe(true);
  expect(fold.date.toISOString()).toBe("2026-11-01T06:30:00.000Z");
});

test("all-day boundaries remain local midnights across DST", () => {
  const start = resolveZonedEditorValue("2026-03-08", "America/Chicago", true);
  const end = resolveZonedEditorValue("2026-03-09", "America/Chicago", true);
  expect(start.date.toISOString()).toBe("2026-03-08T06:00:00.000Z");
  expect(end.date.toISOString()).toBe("2026-03-09T05:00:00.000Z");
  expect((end.date.getTime() - start.date.getTime()) / 3_600_000).toBe(23);
});

test("calendar UTC markers round-trip arbitrary display zones", () => {
  const instant = new Date("2026-12-15T23:45:00.000Z");
  for (const zone of ["UTC", "America/Chicago", "Europe/London", "Asia/Kolkata"]) {
    const marker = instantToCalendarMarker(instant, zone);
    const editor = calendarMarkerToEditorValue(marker);
    expect(editor).toBe(formatInstantForEditor(instant, zone));
    expect(calendarMarkerToInstant(marker, zone).date.toISOString()).toBe(instant.toISOString());
  }
});

test("rejects malformed dates and zones", () => {
  expect(() => resolveZonedEditorValue("2026-02-30T10:00", "UTC")).toThrow();
  expect(() => resolveZonedEditorValue("2026-08-31T10:00", "Invalid/Zone")).toThrow();
});
