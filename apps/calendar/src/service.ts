import { exposeTool, isJsonObject, type ExposedToolOptions, type JsonObject, type JsonValue, type MsgBusToolHandler } from "neutron-tools/app";
import { formatInstantForEditor, isValidTimeZone } from "./time_zone";
import { materializeRecurrence, type RecurrenceDraft, type RepeatFrequency } from "./recurrence";
import { encodeCalendarSearchWire } from "./search_wire";

const QUERY_TIMEOUT = 30;
const WRITE_TIMEOUT = 45;
const decimalSchema: JsonObject = { type: "string", pattern: "^0$|^[1-9][0-9]*$" };
const rfc3339Schema: JsonObject = { type: "string", minLength: 16, maxLength: 40, pattern: "^[0-9T:.+Z-]+$" };
const nullableRfc3339Schema: JsonObject = { oneOf: [rfc3339Schema, { type: "null" }] };
const zoneSchema: JsonObject = { type: "string", minLength: 1, maxLength: 64 };
const eventSchema: JsonObject = objectSchema(["id", "revision", "seriesId", "seriesRevision", "title", "start", "end", "allDay", "timeZone", "availability", "source", "status"], {
  id: decimalSchema, revision: decimalSchema, seriesId: decimalSchema, seriesRevision: decimalSchema,
  title: { type: "string" }, notes: { type: "string" }, location: { type: "string" },
  start: rfc3339Schema, end: rfc3339Schema, allDay: { type: "boolean" }, timeZone: zoneSchema,
  availability: { type: "string", enum: ["busy", "free"] }, source: { type: "string", enum: ["owner", "rendezvous"] }, status: { type: "string" },
});
const seriesSchema: JsonObject = objectSchema(["id", "revision", "title", "notes", "location", "timeZone", "availability", "source", "recurring"], { id: decimalSchema, revision: decimalSchema, title: { type: "string" }, notes: { type: "string" }, location: { type: "string" }, timeZone: zoneSchema, availability: { type: "string", enum: ["busy", "free"] }, source: { type: "string", enum: ["owner", "rendezvous"] }, recurring: { type: "boolean" } });
const recurrenceSchema: JsonObject = objectSchema(["frequency", "interval", "endMode"], {
  frequency: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"] }, interval: { type: "integer", minimum: 1, maximum: 99 },
  weekdays: { type: "array", uniqueItems: true, maxItems: 7, items: { type: "integer", minimum: 0, maximum: 6 } },
  endMode: { type: "string", enum: ["count", "until"] }, count: { type: "integer", minimum: 1, maximum: 730 }, until: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
});

export const calendarToolHandlers: Record<string, MsgBusToolHandler> = {};

function registerTool(name: string, options: ExposedToolOptions, handler: MsgBusToolHandler): void {
  calendarToolHandlers[name] = handler;
  exposeTool(name, options, handler);
}

registerTool("status", {
  title: "Calendar Status", description: "Read Calendar revision, active event count, saved time zone, scheduling defaults, and supported tool capabilities.",
  inputSchema: objectSchema([], {}), outputSchema: objectSchema(["revision", "eventCount", "timeZone", "slotIncrementMinutes", "bufferBeforeMinutes", "bufferAfterMinutes", "capabilities"], { revision: decimalSchema, eventCount: decimalSchema, timeZone: zoneSchema, slotIncrementMinutes: { type: "integer" }, bufferBeforeMinutes: { type: "integer" }, bufferAfterMinutes: { type: "integer" }, capabilities: { type: "array", items: { type: "string" } } }), annotations: { "neutron:effects": ["read"] },
}, async (_args, context) => {
  const [status, preferences] = await Promise.all([context.kernel.querySelf<JsonValue>("calendar_status", [null], QUERY_TIMEOUT), context.kernel.querySelf<JsonValue>("calendar_preferences_get", [null], QUERY_TIMEOUT)]);
  const state = record(status, "Calendar status"); const prefs = record(preferences, "Calendar preferences");
  return { revision: nat(state.revision, "revision"), eventCount: nat(state.event_count, "event count"), timeZone: text(prefs.display_time_zone, "time zone"), slotIncrementMinutes: integer(prefs.slot_increment_minutes, "slot increment"), bufferBeforeMinutes: integer(prefs.buffer_before_minutes, "buffer before"), bufferAfterMinutes: integer(prefs.buffer_after_minutes, "buffer after"), capabilities: ["search", "read", "find_free_time", "create", "update", "delete", "export_in_tile"] };
});

registerTool("search_events", {
  title: "Search Calendar Events", description: "Search authoritative private Calendar data by words and filters. Do not place private Calendar contents into public web-search queries. Continue with nextOffset and expectedRevision; restart if stale.",
  inputSchema: objectSchema([], { query: { type: "string", maxLength: 256 }, start: nullableRfc3339Schema, end: nullableRfc3339Schema, source: { type: ["string", "null"], enum: ["owner", "rendezvous", null] }, availability: { type: ["string", "null"], enum: ["busy", "free", null] }, recurring: { type: ["boolean", "null"] }, expectedRevision: { oneOf: [decimalSchema, { type: "null" }] }, offset: decimalSchema, limit: { type: "integer", minimum: 1, maximum: 100 } }),
  outputSchema: objectSchema(["stale", "revision", "events", "nextOffset"], { stale: { type: "boolean" }, revision: decimalSchema, events: { type: "array", items: eventSchema, maxItems: 100 }, nextOffset: { oneOf: [decimalSchema, { type: "null" }] } }), annotations: { "neutron:effects": ["read"] },
}, async (args, context) => {
  const availability = optionalText(args.availability);
  const raw = await context.kernel.querySelf<JsonValue>("calendar_search_v1", [encodeCalendarSearchWire({ queryText: optionalText(args.query) ?? "", startNs: optionalInstantNs(args.start), endNs: optionalInstantNs(args.end), source: optionalText(args.source), availability: availability === "busy" || availability === "free" ? availability : null, status: null, recurring: optionalBoolean(args.recurring), expectedRevision: optionalNat(args.expectedRevision), offset: optionalNat(args.offset) ?? "0", limit: String(optionalInteger(args.limit) ?? 50) })], QUERY_TIMEOUT);
  const outcome = record(raw, "Calendar search result");
  if ("stale" in outcome) return { stale: true, revision: nat(record(outcome.stale, "stale result").revision, "revision"), events: [], nextOffset: null };
  if ("invalid" in outcome) throw new Error(text(record(outcome.invalid, "invalid result").message, "message"));
  const page = record(outcome.ok, "search page");
  return { stale: false, revision: nat(page.revision, "revision"), events: array(page.occurrences, "events").map(eventFromWire), nextOffset: optionalWireNat(page.next_offset) };
});

registerTool("get_event", {
  title: "Get Calendar Event", description: "Read one Calendar series and optionally one occurrence by stable id.",
  inputSchema: objectSchema(["seriesId"], { seriesId: decimalSchema, occurrenceId: { oneOf: [decimalSchema, { type: "null" }] } }), outputSchema: { oneOf: [objectSchema(["series", "occurrence", "occurrences", "occurrenceCount", "truncated"], { series: seriesSchema, occurrence: { oneOf: [eventSchema, { type: "null" }] }, occurrences: { type: "array", items: eventSchema, maxItems: 100 }, occurrenceCount: decimalSchema, truncated: { type: "boolean" } }), { type: "null" }] }, annotations: { "neutron:effects": ["read"] },
}, async (args, context) => {
  const seriesId = requiredNat(args.seriesId, "seriesId");
  const [seriesRaw, occurrencesRaw] = await Promise.all([context.kernel.querySelf<JsonValue>("calendar_series_get_v2", [{ series_id: seriesId }], QUERY_TIMEOUT), context.kernel.querySelf<JsonValue>("calendar_series_occurrences_v2", [{ series_id: seriesId, offset: "0", limit: "730" }], QUERY_TIMEOUT)]);
  if (seriesRaw === null) return null;
  const series = record(seriesRaw, "series"); const page = record(occurrencesRaw, "series occurrences");
  const occurrenceId = optionalNat(args.occurrenceId); const occurrences = array(page.occurrences, "occurrences").map(eventFromWire);
  return { series: seriesFromWire(series), occurrence: occurrenceId ? occurrences.find((item) => item.id === occurrenceId) ?? null : null, occurrences: occurrenceId ? [] : occurrences.slice(0, 100), occurrenceCount: nat(page.total, "occurrence count"), truncated: Number(nat(page.total, "occurrence count")) > 100 };
});

registerTool("list_schedule", {
  title: "List Calendar Schedule", description: "List active private Calendar events in a bounded RFC 3339 range of at most 366 days.",
  inputSchema: objectSchema(["start", "end"], { start: rfc3339Schema, end: rfc3339Schema, offset: decimalSchema, limit: { type: "integer", minimum: 1, maximum: 100 } }), outputSchema: objectSchema(["revision", "total", "events"], { revision: decimalSchema, total: decimalSchema, events: { type: "array", items: eventSchema, maxItems: 100 } }), annotations: { "neutron:effects": ["read"] },
}, async (args, context) => {
  const start = instant(args.start, "start"); const end = instant(args.end, "end");
  if (end <= start || end.getTime() - start.getTime() > 366 * 86_400_000) throw new Error("Schedule range must be positive and at most 366 days.");
  const raw = record(await context.kernel.querySelf<JsonValue>("calendar_range_v2", [{ start_ns: ns(start), end_ns: ns(end), offset: optionalNat(args.offset) ?? "0", limit: optionalInteger(args.limit) ?? 50 }], QUERY_TIMEOUT), "schedule");
  return { revision: nat(raw.revision, "revision"), total: nat(raw.total, "total"), events: array(raw.occurrences, "events").map(eventFromWire) };
});

registerTool("find_free_time", {
  title: "Find Free Calendar Time", description: "Return bounded owner-only free-time suggestions. Results disclose candidate times only, never unrelated private event details. At most 32 candidates are inspected per call; continue from nextStart when it is non-null.",
  inputSchema: objectSchema(["start", "end", "durationMinutes"], { start: rfc3339Schema, end: rfc3339Schema, durationMinutes: { type: "integer", minimum: 15, maximum: 480 }, stepMinutes: { type: "integer", minimum: 5, maximum: 120 }, limit: { type: "integer", minimum: 1, maximum: 32 } }), outputSchema: objectSchema(["revision", "durationMinutes", "starts", "nextStart"], { revision: decimalSchema, durationMinutes: { type: "integer" }, starts: { type: "array", items: rfc3339Schema, maxItems: 32 }, nextStart: nullableRfc3339Schema }), annotations: { "neutron:effects": ["read"] },
}, async (args, context) => {
  const start = instant(args.start, "start"); const end = instant(args.end, "end"); const duration = requiredInteger(args.durationMinutes, "durationMinutes", 15, 480); const step = optionalInteger(args.stepMinutes) ?? 15; const limit = optionalInteger(args.limit) ?? 16;
  if (end <= start || end.getTime() - start.getTime() > 31 * 86_400_000) throw new Error("Free-time range must be positive and at most 31 days.");
  const candidates: string[] = []; let cursor = start.getTime(); for (; cursor + duration * 60_000 <= end.getTime() && candidates.length < 32; cursor += step * 60_000) candidates.push(ns(new Date(cursor)));
  const raw = record(await context.kernel.querySelf<JsonValue>("calendar_find_free_v1", [{ window_start_ns: ns(start), window_end_ns: ns(end), duration_minutes: duration, candidate_starts_ns: candidates }], QUERY_TIMEOUT), "free-time result");
  const available = array(raw.available_starts_ns, "available starts").map((value) => fromNs(nat(value, "available start")));
  const next = available[limit] ?? (cursor + duration * 60_000 <= end.getTime() ? new Date(cursor) : null);
  return { revision: nat(raw.revision, "revision"), durationMinutes: duration, starts: available.slice(0, limit).map((value) => value.toISOString()), nextStart: next?.toISOString() ?? null };
});

registerTool("create_event", {
  title: "Create Calendar Event", description: "Create one reviewed one-time or bounded recurring owner event. If dispatch becomes ambiguous, do not retry automatically; call status and search_events for the exact title/time to reconcile first. Public web research must never include private Calendar contents.",
  inputSchema: objectSchema(["title", "start", "end"], { title: { type: "string", minLength: 1, maxLength: 160 }, start: { type: "string", minLength: 10, maxLength: 40 }, end: { type: "string", minLength: 10, maxLength: 40 }, allDay: { type: "boolean" }, timeZone: zoneSchema, notes: { type: "string", maxLength: 4096 }, location: { type: "string", maxLength: 512 }, availability: { type: "string", enum: ["busy", "free"] }, recurrence: { oneOf: [recurrenceSchema, { type: "null" }] } }),
  outputSchema: objectSchema(["committed", "series", "warnings", "reconciliation"], { committed: { const: true }, series: seriesSchema, warnings: { type: "array", items: { type: "string" } }, reconciliation: { type: "string" } }), annotations: { "neutron:effects": ["write"] },
}, async (args, context) => {
  const preferences = record(await context.kernel.querySelf<JsonValue>("calendar_preferences_get", [null], QUERY_TIMEOUT), "preferences"); const zone = optionalText(args.timeZone) ?? text(preferences.display_time_zone, "time zone"); if (!isValidTimeZone(zone)) throw new Error("timeZone must be a valid IANA zone.");
  const allDay = optionalBoolean(args.allDay) ?? false; const startValue = editorValue(args.start, zone, allDay, "start"); const endValue = editorValue(args.end, zone, allDay, "end"); const recurrence = recurrenceDraft(args.recurrence, startValue, zone); const materialized = materializeRecurrence(startValue, endValue, allDay, recurrence, zone); if (materialized.error) throw new Error(materialized.error);
  const result = mutationOk(await context.kernel.updateSelf<JsonValue>("calendar_series_create_v2", [{ expected_revision: nat(preferences.revision, "revision"), value: { title: requiredText(args.title, "title"), notes: optionalText(args.notes) ?? "", location: optionalText(args.location) ?? "", color: "sage", availability: { [optionalText(args.availability) ?? "busy"]: null }, kind: { [allDay ? "all_day" : "timed"]: null }, time_zone: zone, recurrence: materialized.recurrence, occurrences: materialized.occurrences } }], WRITE_TIMEOUT), "create event");
  return { committed: true, series: seriesFromWire(result), warnings: materialized.warnings, reconciliation: "If a transport error was reported instead, search the exact title and start time before retrying." };
});

registerTool("update_event", {
  title: "Update Calendar Event", description: "Update one occurrence time/details or the metadata of an entire owner series at an expected revision. Unknown dispatch is not retry-safe; read the event again before retrying.",
  inputSchema: objectSchema(["scope", "seriesId", "expectedRevision"], { scope: { type: "string", enum: ["occurrence", "series"] }, seriesId: decimalSchema, occurrenceId: { oneOf: [decimalSchema, { type: "null" }] }, expectedRevision: decimalSchema, title: { type: "string", minLength: 1, maxLength: 160 }, notes: { type: "string", maxLength: 4096 }, location: { type: "string", maxLength: 512 }, start: nullableRfc3339Schema, end: nullableRfc3339Schema }), outputSchema: { oneOf: [objectSchema(["committed", "event", "reconciliation"], { committed: { const: true }, event: eventSchema, reconciliation: { type: "string" } }), objectSchema(["committed", "series", "reconciliation"], { committed: { const: true }, series: seriesSchema, reconciliation: { type: "string" } })] }, annotations: { "neutron:effects": ["write"] },
}, async (args, context) => {
  const seriesId = requiredNat(args.seriesId, "seriesId"); const scope = requiredText(args.scope, "scope"); const expected = requiredNat(args.expectedRevision, "expectedRevision");
  if (scope === "occurrence") {
    const occurrenceId = requiredNat(args.occurrenceId, "occurrenceId"); const raw = record(await context.kernel.querySelf<JsonValue>("calendar_series_occurrences_v2", [{ series_id: seriesId, offset: "0", limit: "730" }], QUERY_TIMEOUT), "occurrences"); const current = array(raw.occurrences, "occurrences").map(recordValue).find((item) => nat(item.id, "id") === occurrenceId); if (!current) throw new Error("Occurrence not found.");
    const start = args.start === undefined || args.start === null ? fromNs(nat(current.start_ns, "start")) : instant(args.start, "start"); const end = args.end === undefined || args.end === null ? fromNs(nat(current.end_ns, "end")) : instant(args.end, "end");
    const result = mutationOk(await context.kernel.updateSelf<JsonValue>("calendar_occurrence_update_v2", [{ occurrence_id: occurrenceId, expected_occurrence_revision: expected, start_ns: ns(start), end_ns: ns(end), title_override: optionalText(args.title), notes_override: optionalText(args.notes), location_override: optionalText(args.location) }], WRITE_TIMEOUT), "update occurrence");
    return { committed: true, event: eventFromWire(result), reconciliation: "Read this occurrence again before retrying after an unknown dispatch." };
  }
  if (scope !== "series") throw new Error("scope must be occurrence or series.");
  if ((args.start !== undefined && args.start !== null) || (args.end !== undefined && args.end !== null)) throw new Error("start and end apply only to occurrence updates; use scope occurrence.");
  const [seriesRaw, occurrencesRaw] = await Promise.all([context.kernel.querySelf<JsonValue>("calendar_series_get_v2", [{ series_id: seriesId }], QUERY_TIMEOUT), context.kernel.querySelf<JsonValue>("calendar_series_occurrences_v2", [{ series_id: seriesId, offset: "0", limit: "730" }], QUERY_TIMEOUT)]); const series = record(seriesRaw, "series"); const page = record(occurrencesRaw, "occurrences");
  const value = { title: optionalText(args.title) ?? text(series.title, "title"), notes: optionalText(args.notes) ?? text(series.notes, "notes"), location: optionalText(args.location) ?? text(series.location, "location"), color: text(series.color, "color"), availability: series.availability!, kind: series.kind!, time_zone: text(series.time_zone, "time zone"), recurrence: series.recurrence ?? null, occurrences: array(page.occurrences, "occurrences").map((item) => { const occurrence = record(item, "occurrence"); return { recurrence_key: text(occurrence.recurrence_key, "recurrence key"), start_ns: nat(occurrence.start_ns, "start"), end_ns: nat(occurrence.end_ns, "end") }; }) };
  const result = mutationOk(await context.kernel.updateSelf<JsonValue>("calendar_series_update_v2", [{ series_id: seriesId, expected_series_revision: expected, value }], WRITE_TIMEOUT), "update series");
  return { committed: true, series: seriesFromWire(result), reconciliation: "Read this series again before retrying after an unknown dispatch." };
});

registerTool("delete_event", {
  title: "Delete Calendar Event", description: "Delete one occurrence or an entire owner series at an expected revision. This is destructive. Unknown dispatch is not retry-safe; call get_event to reconcile before retrying.", inputSchema: objectSchema(["scope", "seriesId", "expectedRevision"], { scope: { type: "string", enum: ["occurrence", "series"] }, seriesId: decimalSchema, occurrenceId: { oneOf: [decimalSchema, { type: "null" }] }, expectedRevision: decimalSchema }), outputSchema: objectSchema(["committed", "revision", "reconciliation"], { committed: { const: true }, revision: decimalSchema, reconciliation: { type: "string" } }), annotations: { "neutron:effects": ["write"] },
}, async (args, context) => { const scope = requiredText(args.scope, "scope"); const method = scope === "occurrence" ? "calendar_occurrence_remove_v2" : scope === "series" ? "calendar_series_remove_v2" : null; if (!method) throw new Error("scope must be occurrence or series."); const request = scope === "occurrence" ? { occurrence_id: requiredNat(args.occurrenceId, "occurrenceId"), expected_occurrence_revision: requiredNat(args.expectedRevision, "expectedRevision") } : { series_id: requiredNat(args.seriesId, "seriesId"), expected_series_revision: requiredNat(args.expectedRevision, "expectedRevision") }; const result = mutationOk(await context.kernel.updateSelf<JsonValue>(method, [request], WRITE_TIMEOUT), "delete event"); return { committed: true, revision: nat(result.revision, "revision"), reconciliation: "Call get_event before retrying after an unknown dispatch." }; });

registerTool("export_event", {
  title: "Export Calendar Event", description: "Prepare a privacy-safe owner action for exporting an event. This tool never puts private iCalendar contents into model text; the owner opens Calendar and uses Export event.", inputSchema: objectSchema(["seriesId", "occurrenceId"], { seriesId: decimalSchema, occurrenceId: decimalSchema }), outputSchema: objectSchema(["seriesId", "occurrenceId", "action", "instructions"], { seriesId: decimalSchema, occurrenceId: decimalSchema, action: { const: "open_calendar_export" }, instructions: { type: "string" } }), annotations: { "neutron:effects": ["read"] },
}, async (args, context) => { const seriesId = requiredNat(args.seriesId, "seriesId"); const occurrenceId = requiredNat(args.occurrenceId, "occurrenceId"); const raw = record(await context.kernel.querySelf<JsonValue>("calendar_series_occurrences_v2", [{ series_id: seriesId, offset: "0", limit: "730" }], QUERY_TIMEOUT), "occurrences"); if (!array(raw.occurrences, "occurrences").some((value) => nat(record(value, "occurrence").id, "id") === occurrenceId)) throw new Error("Event not found."); return { seriesId, occurrenceId, action: "open_calendar_export", instructions: "Open Calendar, select this event, and choose Export event. Choose whether the downloaded .ics file includes private titles, notes, and locations." }; });

function objectSchema(required: string[], properties: JsonObject): JsonObject { return { type: "object", required, properties, additionalProperties: false }; }
function record(value: unknown, label: string): JsonObject { if (!isJsonObject(value)) throw new Error(`${label} returned invalid data.`); return value as JsonObject; }
function recordValue(value: JsonValue): JsonObject { return record(value, "Calendar"); }
function array(value: JsonValue | undefined, label: string): JsonValue[] { if (!Array.isArray(value)) throw new Error(`${label} must be an array.`); return value; }
function text(value: JsonValue | undefined, label: string): string { if (typeof value !== "string") throw new Error(`${label} must be text.`); return value; }
function requiredText(value: JsonValue | undefined, label: string): string { const valueText = text(value, label).trim(); if (!valueText) throw new Error(`${label} is required.`); return valueText; }
function optionalText(value: JsonValue | undefined): string | null { if (value === undefined || value === null) return null; return text(value, "value"); }
function nat(value: JsonValue | undefined, label: string): string { const result = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : typeof value === "string" ? value : ""; if (!/^(0|[1-9][0-9]*)$/u.test(result)) throw new Error(`${label} must be a natural number.`); return result; }
function requiredNat(value: JsonValue | undefined, label: string): string { return nat(value, label); }
function optionalNat(value: JsonValue | undefined): string | null { return value === undefined || value === null ? null : nat(value, "value"); }
function optionalWireNat(value: JsonValue | undefined): string | null { return Array.isArray(value) ? value[0] === undefined ? null : nat(value[0], "next offset") : optionalNat(value); }
function integer(value: JsonValue | undefined, label: string): number { const result = typeof value === "number" ? value : Number(value); if (!Number.isSafeInteger(result)) throw new Error(`${label} must be an integer.`); return result; }
function requiredInteger(value: JsonValue | undefined, label: string, minimum: number, maximum: number): number { const result = integer(value, label); if (result < minimum || result > maximum) throw new Error(`${label} is outside its allowed range.`); return result; }
function optionalInteger(value: JsonValue | undefined): number | null { return value === undefined || value === null ? null : integer(value, "value"); }
function optionalBoolean(value: JsonValue | undefined): boolean | null { if (value === undefined || value === null) return null; if (typeof value !== "boolean") throw new Error("value must be boolean."); return value; }
function optionalVariant(value: JsonValue | undefined): JsonValue { const name = optionalText(value); return name === null ? null : { [name]: null }; }
function instant(value: JsonValue | undefined, label: string): Date { const source = text(value, label); if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/u.test(source)) throw new Error(`${label} must be RFC 3339 with Z or an explicit offset.`); const result = new Date(source); if (Number.isNaN(result.getTime())) throw new Error(`${label} is invalid.`); return result; }
function optionalInstantNs(value: JsonValue | undefined): string | null { return value === undefined || value === null ? null : ns(instant(value, "time")); }
function ns(value: Date): string { return String(BigInt(value.getTime()) * 1_000_000n); }
function fromNs(value: string): Date { return new Date(Number(BigInt(value) / 1_000_000n)); }
function variantName(value: JsonValue | undefined): string { if (typeof value === "string") return value; if (isJsonObject(value)) return Object.keys(value)[0] ?? "unknown"; return "unknown"; }
function eventFromWire(value: JsonValue): JsonObject { const item = record(value, "event"); return { id: nat(item.id, "event id"), revision: nat(item.revision, "event revision"), seriesId: nat(item.series_id, "series id"), seriesRevision: nat(item.series_revision, "series revision"), title: text(item.title, "title"), notes: text(item.notes, "notes"), location: text(item.location, "location"), start: fromNs(nat(item.start_ns, "start")).toISOString(), end: fromNs(nat(item.end_ns, "end")).toISOString(), allDay: variantName(item.kind) === "all_day", timeZone: text(item.time_zone, "time zone"), availability: variantName(item.availability), source: text(item.source, "source"), status: text(item.status, "status") }; }
function seriesFromWire(value: JsonObject): JsonObject { return { id: nat(value.id, "series id"), revision: nat(value.revision, "series revision"), title: text(value.title, "title"), notes: text(value.notes, "notes"), location: text(value.location, "location"), timeZone: text(value.time_zone, "time zone"), availability: variantName(value.availability), source: text(value.source, "source"), recurring: optionalWireValue(value.recurrence) !== null }; }
function optionalWireValue(value: JsonValue | undefined): JsonValue | null { if (value === undefined || value === null) return null; if (Array.isArray(value)) return value[0] ?? null; return value; }
function mutationOk(value: JsonValue, label: string): JsonObject { const result = record(value, label); if ("err" in result) { const error = record(result.err, "Calendar error"); throw new Error(`${text(error.code, "error code")}: ${text(error.message, "error message")} (Calendar revision ${nat(error.revision, "revision")})`); } return record(result.ok, `${label} result`); }
function editorValue(value: JsonValue | undefined, zone: string, allDay: boolean, label: string): string { const source = text(value, label); if (allDay) { if (!/^\d{4}-\d{2}-\d{2}$/u.test(source)) throw new Error(`${label} must be YYYY-MM-DD for an all-day event.`); return source; } return formatInstantForEditor(instant(value, label), zone); }
function recurrenceDraft(value: JsonValue | undefined, start: string, zone: string): RecurrenceDraft { if (value === undefined || value === null) return { frequency: "none", interval: 1, weekdays: [], endMode: "count", count: 1, until: formatInstantForEditor(new Date(Date.now() + 90 * 86_400_000), zone, true) }; const item = record(value, "recurrence"); const frequency = requiredText(item.frequency, "frequency") as RepeatFrequency; const endMode = requiredText(item.endMode, "endMode") as "count" | "until"; const weekday = new Date(`${start.slice(0, 10)}T00:00:00Z`).getUTCDay(); return { frequency, interval: requiredInteger(item.interval, "interval", 1, 99), weekdays: item.weekdays === undefined ? [weekday] : array(item.weekdays, "weekdays").map((day) => requiredInteger(day, "weekday", 0, 6)), endMode, count: endMode === "count" ? requiredInteger(item.count, "count", 1, 730) : 10, until: endMode === "until" ? requiredText(item.until, "until") : start.slice(0, 10) }; }
