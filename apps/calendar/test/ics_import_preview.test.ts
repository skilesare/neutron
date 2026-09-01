import { expect, test } from "bun:test";
import type { IcsImportParseResult, IcsImportSeries } from "../src/ics_import";
import { buildImportPreview, bytesHex, hexBytes, importPreviewDigest, importSeriesWire } from "../src/ics_import_preview";

const series = (uid: string, sequence: number, digest: string, overrides: Partial<IcsImportSeries["occurrences"][number]> = {}): IcsImportSeries => ({ uid, sequence, contentDigest: digest, occurrences: [{ recurrenceKey: "20260901T150000Z", startIso: "2026-09-01T15:00:00.000Z", endIso: "2026-09-01T16:00:00.000Z", allDay: false, timeZone: "UTC", title: uid, notes: "", location: "", availability: "busy", status: "normal", ...overrides }] });
const digestA = "11".repeat(32); const digestB = "22".repeat(32);
const parsed = (values: IcsImportSeries[]): IcsImportParseResult => ({ sourceNamespace: "ics:test", calendarName: "Test", byteLength: 1, lineCount: 1, componentCount: 1, propertyCount: 1, series: values, diagnostics: [] });

test("classifies create, update, unchanged, and both conflict forms deterministically", () => {
  const result = buildImportPreview(parsed([series("create", 1, digestA), series("update", 2, digestB), series("same", 1, digestA), series("older", 0, digestA), series("ambiguous", 1, digestB)]), { revision: "9", entries: [
    { external_uid: "update", series_id: "2", series_revision: "3", sequence: "1", content_digest: hexBytes(digestA) },
    { external_uid: "same", series_id: "3", series_revision: "1", sequence: "1", content_digest: hexBytes(digestA) },
    { external_uid: "older", series_id: "4", series_revision: "1", sequence: "1", content_digest: hexBytes(digestA) },
    { external_uid: "ambiguous", series_id: "5", series_revision: "1", sequence: "1", content_digest: hexBytes(digestA) },
  ] });
  expect(result.items.map((item) => [item.uid, item.category, item.selected])).toEqual([
    ["create", "create", true], ["update", "update", true], ["same", "unchanged", false], ["older", "conflict", false], ["ambiguous", "conflict", false],
  ]);
});

test("marks duplicate/parser errors and incompatible series invalid", () => {
  const input = parsed([series("duplicate", 1, digestA), series("mixed", 1, digestA)]);
  input.series[1]!.occurrences.push({ ...input.series[1]!.occurrences[0]!, recurrenceKey: "2", startIso: "2026-09-02T15:00:00.000Z", endIso: "2026-09-02T16:00:00.000Z", timeZone: "America/Chicago" });
  input.diagnostics.push({ severity: "error", code: "duplicate_master", message: "duplicate", uid: "duplicate" });
  const result = buildImportPreview(input, { revision: "0", entries: [] });
  expect(result.items.map((item) => item.category)).toEqual(["duplicate", "invalid"]);
  expect(result.items.every((item) => !item.selected)).toBe(true);
});

test("categorizes unrepresented diagnostics as skipped or invalid", () => {
  const input = parsed([]); input.diagnostics = [
    { severity: "error", code: "unsupported_scheduling", message: "Attendees are unsupported", uid: "invite" },
    { severity: "error", code: "missing_dtstart", message: "Start is required", uid: "broken" },
  ];
  expect(buildImportPreview(input, { revision: "0", entries: [] }).rejected).toEqual([
    { uid: "invite", category: "skipped", reason: "Attendees are unsupported" },
    { uid: "broken", category: "invalid", reason: "Start is required" },
  ]);
});

test("rejects a series that exceeds the backend per-series occurrence bound", () => {
  const value = series("large", 1, digestA); value.occurrences = Array.from({ length: 731 }, (_, index) => ({ ...value.occurrences[0]!, recurrenceKey: String(index), startIso: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(), endIso: new Date(Date.UTC(2026, 0, 1 + index, 1)).toISOString() }));
  expect(buildImportPreview(parsed([value]), { revision: "0", entries: [] }).items[0]).toMatchObject({ category: "invalid", selected: false, reason: expect.stringContaining("730") });
});

test("creates stable preview digests and Candid JSON wire values", async () => {
  const preview = buildImportPreview(parsed([series("create", 7, digestA)]), { revision: "12", entries: [] });
  const first = await importPreviewDigest(preview, new Set(["create"]));
  expect(await importPreviewDigest(preview, new Set(["create"]))).toEqual(first);
  expect(first).toHaveLength(32);
  expect(bytesHex(hexBytes(digestA))).toBe(digestA);
  expect(importSeriesWire(preview.items[0]!)).toMatchObject({ external_uid: "create", sequence: "7", existing_series_id: null, expected_series_revision: null });
  expect(importSeriesWire(preview.items[0]!).occurrences[0]).toMatchObject({ start_ns: "1788274800000000000", status: { normal: null } });
});
