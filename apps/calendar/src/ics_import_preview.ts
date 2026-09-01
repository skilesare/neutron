import type { IcsImportParseResult, IcsImportSeries } from "./ics_import";

export type ImportIndexEntry = {
  external_uid: string;
  series_id: string;
  series_revision: string;
  sequence: string;
  content_digest: Uint8Array;
};

export type ImportPreviewCategory = "create" | "update" | "unchanged" | "conflict" | "duplicate" | "skipped" | "invalid";

export type ImportPreviewItem = {
  uid: string;
  category: ImportPreviewCategory;
  selected: boolean;
  reason: string;
  series: IcsImportSeries;
  existing: ImportIndexEntry | null;
};

export type ImportPreview = {
  revision: string;
  sourceNamespace: string;
  items: ImportPreviewItem[];
  skippedDiagnostics: number;
  diagnostics: { severity: "error" | "warning"; code: string; message: string; uid?: string }[];
  rejected: { uid?: string; category: "skipped" | "invalid"; reason: string }[];
};

const encoder = new TextEncoder();
export const hexBytes = (value: string): Uint8Array => {
  if (!/^[a-f0-9]+$/u.test(value) || value.length % 2 !== 0) throw new Error("Invalid hexadecimal digest.");
  return Uint8Array.from({ length: value.length / 2 }, (_, index) => Number.parseInt(value.slice(index * 2, index * 2 + 2), 16));
};
export const bytesHex = (value: number[] | Uint8Array): string => [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");

function incompatibleSeries(series: IcsImportSeries): string | null {
  const first = series.occurrences[0];
  if (!first) return "No importable occurrences remain.";
  if (series.occurrences.length > 730) return "A single series exceeds Calendar's 730-occurrence limit.";
  if (series.occurrences.some((item) => item.allDay !== first.allDay)) return "A series mixes timed and all-day occurrences.";
  if (series.occurrences.some((item) => item.timeZone !== first.timeZone)) return "A series mixes time zones across occurrences.";
  if (series.occurrences.some((item) => item.availability !== first.availability)) return "A series mixes busy and free availability across occurrences.";
  return null;
}

export function buildImportPreview(parsed: IcsImportParseResult, index: { revision: string; entries: ImportIndexEntry[] }): ImportPreview {
  const stored = new Map(index.entries.map((entry) => [entry.external_uid, entry]));
  const duplicateUids = new Set(parsed.diagnostics.filter((item) => item.code === "duplicate_master" && item.uid).map((item) => item.uid!));
  const invalidUids = new Set(parsed.diagnostics.filter((item) => item.severity === "error" && item.uid && item.code !== "duplicate_master").map((item) => item.uid!));
  const items = parsed.series.map<ImportPreviewItem>((series) => {
    const existing = stored.get(series.uid) ?? null;
    if (duplicateUids.has(series.uid)) return { uid: series.uid, category: "duplicate", selected: false, reason: "The file contains multiple master events with this UID.", series, existing };
    if (invalidUids.has(series.uid)) return { uid: series.uid, category: "invalid", selected: false, reason: "This series has parser errors that must be resolved before import.", series, existing };
    const incompatible = incompatibleSeries(series);
    if (incompatible) return { uid: series.uid, category: "invalid", selected: false, reason: incompatible, series, existing };
    if (!existing) return { uid: series.uid, category: "create", selected: true, reason: "New UID from this calendar source.", series, existing };
    const storedDigest = bytesHex(existing.content_digest);
    const storedSequence = BigInt(existing.sequence);
    const incomingSequence = BigInt(series.sequence);
    if (incomingSequence === storedSequence && series.contentDigest === storedDigest) return { uid: series.uid, category: "unchanged", selected: false, reason: "SEQUENCE and normalized content match the stored import.", series, existing };
    if (incomingSequence > storedSequence) return { uid: series.uid, category: "update", selected: true, reason: `Newer SEQUENCE ${series.sequence} replaces ${existing.sequence}.`, series, existing };
    if (incomingSequence < storedSequence) return { uid: series.uid, category: "conflict", selected: false, reason: `Incoming SEQUENCE ${series.sequence} is older than stored ${existing.sequence}.`, series, existing };
    return { uid: series.uid, category: "conflict", selected: false, reason: "The same SEQUENCE has different normalized content.", series, existing };
  });
  const represented = new Set(items.map((item) => item.uid));
  const unrepresented = parsed.diagnostics.filter((item) => !item.uid || !represented.has(item.uid));
  return { revision: index.revision, sourceNamespace: parsed.sourceNamespace, items, skippedDiagnostics: unrepresented.length, diagnostics: parsed.diagnostics.map(({ severity, code, message, uid }) => ({ severity, code, message, ...(uid ? { uid } : {}) })), rejected: unrepresented.map((item) => ({ ...(item.uid ? { uid: item.uid } : {}), category: item.code === "unsupported_method" || item.code === "unsupported_scheduling" ? "skipped" : "invalid", reason: item.message })) };
}

export async function importPreviewDigest(preview: ImportPreview, selectedUids: Set<string>): Promise<Uint8Array> {
  const selected = preview.items.filter((item) => selectedUids.has(item.uid) && (item.category === "create" || item.category === "update")).map((item) => ({ uid: item.uid, sequence: item.series.sequence, digest: item.series.contentDigest, existingSeriesId: item.existing?.series_id ?? null, expectedSeriesRevision: item.existing?.series_revision ?? null }));
  const canonical = JSON.stringify({ revision: preview.revision, sourceNamespace: preview.sourceNamespace, selected });
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(canonical)));
}

export function importSeriesWire(item: ImportPreviewItem) {
  const first = item.series.occurrences[0]!;
  return {
    external_uid: item.uid,
    sequence: String(item.series.sequence),
    content_digest: hexBytes(item.series.contentDigest),
    existing_series_id: item.existing?.series_id ?? null,
    expected_series_revision: item.existing?.series_revision ?? null,
    availability: { [first.availability]: null },
    kind: { [first.allDay ? "all_day" : "timed"]: null },
    time_zone: first.timeZone,
    occurrences: item.series.occurrences.map((occurrence) => ({
      recurrence_key: occurrence.recurrenceKey,
      start_ns: String(BigInt(new Date(occurrence.startIso).getTime()) * 1_000_000n),
      end_ns: String(BigInt(new Date(occurrence.endIso).getTime()) * 1_000_000n),
      status: { [occurrence.status]: null },
      title: occurrence.title,
      notes: occurrence.notes,
      location: occurrence.location,
    })),
  };
}
