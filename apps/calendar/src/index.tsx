import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg, type EventResizeDoneArg } from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { cx, nt } from "neutron-design-system";
import { callTool, copyToClipboard, onTileViewRequest, openAppTile, publishAppStateChange, querySelf, updateSelf, type JsonValue } from "neutron-tools/app";
import { KERNEL_RUNTIME_CONFIG_PATH, parseKernelRuntimeConfig } from "neutron-tools/src/runtime_config.js";
import { safeIcsFilename, serializeIcs, type IcsEvent } from "./ics";
import { parseIcsFileInWorker } from "./ics_import_client";
import { buildImportPreview, importPreviewDigest, importSeriesWire, type ImportIndexEntry, type ImportPreview } from "./ics_import_preview";
import { encodeCalendarSearchWire } from "./search_wire";
import { materializeRecurrence, repeatSummary, type RecurrenceDraft, type RepeatFrequency } from "./recurrence";
import { meetingView, scheduleView } from "./rendezvous_handoff";
import { parseReminderTileView } from "./reminder_view";
import { calendarMarkerToInstant, formatInstantForEditor, instantToCalendarMarker, isValidTimeZone, resolveZonedEditorValue, supportedTimeZones } from "./time_zone";
import "./style.scss";

type OccurrenceView = { id: string; revision: string; series_id: string; series_revision: string; recurrence_key: string; start_ns: string; end_ns: string; title: string; notes: string; location: string; color: string; availability: JsonValue; kind: JsonValue; source: string; status: string; time_zone: string };
type RangePage = { revision: string; total: string; occurrences: OccurrenceView[] };
type SeriesView = { id: string; revision: string; title: string; notes: string; location: string; color: string; availability: JsonValue; kind: JsonValue; source: string; imported: boolean; time_zone: string; recurrence: JsonValue };
type ExportRow = { occurrence: OccurrenceView; series_updated_at_ns: string; time_zone: string };
type ExportPage = { revision: string; total: string; occurrences: ExportRow[] };
type PreparedExport = { path: string | null; filename: string; bodyBytes: number; contents: string };
type ImportReceipt = { batchId: Uint8Array; previewDigest: Uint8Array; committedRevision: string; changeCount: number; undone: boolean };
type SearchPage = { revision: string; scanned: string; occurrences: OccurrenceView[]; next_offset: JsonValue };
type SearchFilters = { text: string; source: "any" | "owner" | "rendezvous"; availability: "any" | "busy" | "free"; recurring: "any" | "yes" | "no"; from: string; through: string };
type Preferences = { revision: string; day_start_minute: number; day_end_minute: number; allowed_weekdays_mask: number; slot_increment_minutes: number; buffer_before_minutes: number; buffer_after_minutes: number; display_time_zone: string };
type ReminderView = { revision: string; calendar_revision: string; series_id: string; occurrence_id: JsonValue; offset_minutes: JsonValue; inherited: boolean };
type EditorDraft = { occurrenceId: string | null; occurrenceRevision: string | null; seriesId: string | null; seriesRevision: string | null; source: string; status: string; title: string; start: string; end: string; notes: string; location: string; color: string; availability: "busy" | "free"; allDay: boolean; recurrence: RecurrenceDraft; editScope: "occurrence" | "series"; anchorStart: string; anchorEnd: string };

const emptyPage: RangePage = { revision: "0", total: "0", occurrences: [] };
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const reminderOptions = [["none", "No reminder"], ["0", "At event time"], ["5", "5 minutes before"], ["10", "10 minutes before"], ["15", "15 minutes before"], ["30", "30 minutes before"], ["60", "1 hour before"], ["1440", "1 day before"], ["10080", "1 week before"]] as const;
const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const initialCalendarView = window.matchMedia("(max-width: 700px)").matches ? "listWeek" : "timeGridWeek";
const calendarHeight: number | "auto" = initialCalendarView === "listWeek" ? "auto" : Math.max(520, Math.min(760, window.innerHeight - 210));
const dayMs = 86_400_000;
const bufferedWindow = (visibleStart: Date, visibleEnd: Date) => {
  const start = new Date(visibleStart.getTime() - 30 * dayMs);
  const maximumEnd = new Date(start.getTime() + 366 * dayMs);
  return { start, end: visibleEnd < maximumEnd ? maximumEnd : visibleEnd };
};
const asNs = (value: string, timeZone: string, allDay = false) => String(BigInt(resolveZonedEditorValue(value, timeZone, allDay).date.getTime()) * 1_000_000n);
const fromNs = (value: string) => new Date(Number(BigInt(value) / 1_000_000n));
const localInput = (date: Date, timeZone: string, allDay = false) => formatInstantForEditor(date, timeZone, allDay);
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
const variantName = (value: unknown) => typeof value === "string" ? value : typeof value === "object" && value ? Object.keys(value)[0] ?? "unknown" : "unknown";
const variantValue = (value: unknown) => typeof value === "object" && value ? Object.values(value)[0] : undefined;
const optionalRecord = (value: SeriesView["recurrence"]): Record<string, JsonValue> | null => Array.isArray(value) ? value[0] as Record<string, JsonValue> ?? null : typeof value === "object" && value !== null ? value as Record<string, JsonValue> : null;
const minutesToTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
const minutesToDuration = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}:00`;
const timeToMinutes = (value: string) => { const [hours = 0, minutes = 0] = value.split(":").map(Number); return hours * 60 + minutes; };
const optionalScalar = (value: JsonValue | undefined): string | null => value === undefined || value === null ? null : Array.isArray(value) ? value[0] === undefined ? null : String(value[0]) : String(value);

const editorWeekday = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00Z`).getUTCDay();
const defaultRecurrence = (startValue: string, timeZone: string): RecurrenceDraft => ({ frequency: "none", interval: 1, weekdays: [editorWeekday(startValue)], endMode: "count", count: 10, until: localInput(new Date(resolveZonedEditorValue(startValue, timeZone, startValue.length === 10).date.getTime() + 90 * 86_400_000), timeZone, true) });
function freshDraft(start = new Date(Date.now() + 3_600_000), end = new Date(start.getTime() + 3_600_000), allDay = false, timeZone = detectedZone): EditorDraft {
  const duration = Math.max(15 * 60_000, end.getTime() - start.getTime());
  if (!allDay) { const marker = instantToCalendarMarker(start, timeZone); marker.setUTCMinutes(Math.ceil(marker.getUTCMinutes() / 15) * 15, 0, 0); start = calendarMarkerToInstant(marker, timeZone).date; }
  end = new Date(start.getTime() + duration);
  const startText = localInput(start, timeZone, allDay); const endText = localInput(end, timeZone, allDay);
  return { occurrenceId: null, occurrenceRevision: null, seriesId: null, seriesRevision: null, source: "owner", status: "normal", title: "", start: startText, end: endText, notes: "", location: "", color: "sage", availability: "busy", allDay, recurrence: defaultRecurrence(startText, timeZone), editScope: "series", anchorStart: startText, anchorEnd: endText };
}
function resultError(result: JsonValue): string | null { if (typeof result !== "object" || result === null || !("err" in result)) return null; const error = result.err; if (typeof error === "object" && error !== null && "message" in error) return String(error.message); return JSON.stringify(error); }
function successRecord(result: JsonValue, label: string): Record<string, JsonValue> {
  if (typeof result !== "object" || result === null || Array.isArray(result)) throw new Error(`${label} returned invalid data.`);
  const root = result as Record<string, JsonValue>; const value = "ok" in root ? root.ok : root;
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} returned invalid data.`);
  return value as Record<string, JsonValue>;
}
function recurrenceFromSeries(series: SeriesView, start: Date, timeZone: string): RecurrenceDraft {
  const startValue = localInput(start, timeZone); const rule = optionalRecord(series.recurrence); if (!rule) return defaultRecurrence(startValue, timeZone);
  const frequency = variantName(rule.frequency) as RepeatFrequency; const endMode = variantName(rule.end) === "until" ? "until" : "count"; const rawEnd = variantValue(rule.end);
  const mask = Number(rule.weekdays_mask ?? 0); const weekdays = weekdayLabels.map((_, day) => day).filter((day) => (mask & 2 ** day) !== 0);
  return { frequency, interval: Number(rule.interval ?? 1), weekdays: weekdays.length ? weekdays : [editorWeekday(startValue)], endMode, count: endMode === "count" ? Number(rawEnd ?? 10) : 10, until: endMode === "until" ? localInput(fromNs(String(rawEnd)), timeZone, true) : localInput(new Date(start.getTime() + 90 * 86_400_000), timeZone, true) };
}

export const App = () => {
  const [page, setPage] = useState<RangePage>(emptyPage); const [preferences, setPreferences] = useState<Preferences | null>(null); const [savedPreferences, setSavedPreferences] = useState<Preferences | null>(null); const [draft, setDraft] = useState<EditorDraft>(() => freshDraft());
  const [message, setMessage] = useState("Loading your calendar…"); const [busy, setBusy] = useState(false); const [deleteArmed, setDeleteArmed] = useState(false);
  const [exportDetails, setExportDetails] = useState(true); const [exportHolds, setExportHolds] = useState(false);
  const [preparedExport, setPreparedExport] = useState<PreparedExport | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null); const [importSelected, setImportSelected] = useState<Set<string>>(new Set()); const [importFilename, setImportFilename] = useState(""); const [importReceipt, setImportReceipt] = useState<ImportReceipt | null>(null);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({ text: "", source: "any", availability: "any", recurring: "any", from: "", through: "" });
  const [searchResults, setSearchResults] = useState<OccurrenceView[]>([]); const [searchRevision, setSearchRevision] = useState<string | null>(null); const [searchCursor, setSearchCursor] = useState<string | null>(null); const [searchState, setSearchState] = useState<"idle" | "loading" | "ready" | "stale" | "error">("idle"); const [searchError, setSearchError] = useState("");
  const [reminderChoice, setReminderChoice] = useState("none"); const [savedReminderChoice, setSavedReminderChoice] = useState("none");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const initialNow = useRef(new Date());
  const rangeRef = useRef(bufferedWindow(new Date(initialNow.current.getTime() - 7 * dayMs), new Date(initialNow.current.getTime() + 7 * dayMs)));
  const visibleRangeRef = useRef({ start: new Date(initialNow.current.getTime() - 7 * dayMs), end: new Date(initialNow.current.getTime() + 7 * dayMs) });
  const rangeRequestRef = useRef(0);
  const initialPreferencesApplied = useRef(false);
  const activeZone = savedPreferences && isValidTimeZone(savedPreferences.display_time_zone) ? savedPreferences.display_time_zone : detectedZone;
  const timeZones = useMemo(() => supportedTimeZones(detectedZone), []);
  const revealEditor = () => requestAnimationFrame(() => { titleInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); titleInputRef.current?.focus({ preventScroll: true }); });
  const beginDraft = (next: EditorDraft) => { setDeleteArmed(false); if (next.seriesId === null) { setReminderChoice("none"); setSavedReminderChoice("none"); } setDraft(next); revealEditor(); };
  const refresh = useCallback(async (visible?: { start: Date; end: Date }) => {
    if (visible) rangeRef.current = bufferedWindow(visible.start, visible.end);
    const requestId = ++rangeRequestRef.current;
    const { start, end } = rangeRef.current;
    const [nextPage, nextPreferences] = await Promise.all([querySelf<RangePage>("calendar_range_v2", [{ start_ns: String(BigInt(start.getTime()) * 1_000_000n), end_ns: String(BigInt(end.getTime()) * 1_000_000n), offset: "0", limit: "2000" }]), querySelf<Preferences>("calendar_preferences_get", [null])]);
    if (requestId !== rangeRequestRef.current) return;
    setPage(nextPage); setPreferences(nextPreferences); setSavedPreferences(nextPreferences); setMessage("");
  }, []);
  useEffect(() => { if (page.revision !== "0") void publishAppStateChange("calendar", page.revision).catch(() => undefined); }, [page.revision]);
  useEffect(() => { if (!preferences || initialPreferencesApplied.current) return; initialPreferencesApplied.current = true; setDraft((current) => current.seriesId || current.title ? current : freshDraft(undefined, undefined, false, activeZone)); }, [activeZone, preferences]);
  const showRange = (visible: { start: Date; end: Date }) => { const actual = { start: calendarMarkerToInstant(visible.start, activeZone, true).date, end: calendarMarkerToInstant(visible.end, activeZone, true).date }; visibleRangeRef.current = actual; void refresh(actual).catch((error) => setMessage(errorText(error))); };

  const calendarEvents = useMemo<EventInput[]>(() => page.occurrences.map((item) => { const hold = item.status === "hold"; const owner = item.source === "owner"; const allDay = variantName(item.kind) === "all_day"; return { id: item.id, title: item.title, start: instantToCalendarMarker(fromNs(item.start_ns), activeZone), end: instantToCalendarMarker(fromNs(item.end_ns), activeZone), allDay, editable: owner && !hold, durationEditable: owner && !hold, startEditable: owner && !hold, classNames: [hold ? "fc-event--hold" : item.source === "rendezvous" ? "fc-event--rendezvous" : `fc-event--personal fc-color--${item.color}`, variantName(item.availability) === "free" ? "fc-event--free" : ""], extendedProps: { item } }; }), [activeZone, page.occurrences]);
  const upcomingEvents = useMemo(() => page.occurrences.filter((item) => fromNs(item.end_ns).getTime() >= Date.now()).sort((left, right) => fromNs(left.start_ns).getTime() - fromNs(right.start_ns).getTime()).slice(0, 6), [page.occurrences]);
  const dateTime = useMemo(() => new Intl.DateTimeFormat(undefined, { timeZone: activeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }), [activeZone]);

  const reminderChoiceFrom = (value: ReminderView | null, occurrenceScope: boolean) => occurrenceScope && optionalScalar(value?.offset_minutes) === null ? "inherit" : value?.inherited && occurrenceScope ? "inherit" : optionalScalar(value?.offset_minutes) ?? "none";
  const loadReminderChoice = async (seriesId: string, occurrenceId: string | null, scope: "occurrence" | "series") => {
    const reminder = await querySelf<ReminderView | null>("calendar_reminder_get_v1", [{ series_id: seriesId, occurrence_id: scope === "occurrence" ? occurrenceId : null }]);
    const choice = reminderChoiceFrom(reminder, scope === "occurrence"); setReminderChoice(choice); setSavedReminderChoice(choice);
  };
  const changeEditScope = (scope: "occurrence" | "series") => {
    setDraft((current) => ({ ...current, editScope: scope, ...(scope === "series" ? { start: current.anchorStart, end: current.anchorEnd } : {}) }));
    if (draft.seriesId) void loadReminderChoice(draft.seriesId, draft.occurrenceId, scope).catch((error) => setMessage(errorText(error)));
  };
  const openEvent = async (item: OccurrenceView) => {
    try {
      const [series, occurrences] = await Promise.all([querySelf<SeriesView | null>("calendar_series_get_v2", [{ series_id: item.series_id }]), querySelf<RangePage>("calendar_series_occurrences_v2", [{ series_id: item.series_id, offset: "0", limit: "730" }])]);
      if (!series) throw new Error("Series not found"); const allDay = variantName(series.kind) === "all_day"; const first = occurrences.occurrences.filter((value) => value.status !== "cancelled").sort((a, b) => a.start_ns.localeCompare(b.start_ns))[0] ?? item;
      const hasRecurrence = optionalRecord(series.recurrence) !== null;
      const editScope = series.imported || hasRecurrence ? "occurrence" : "series";
      await loadReminderChoice(item.series_id, item.id, editScope);
      beginDraft({ occurrenceId: item.id, occurrenceRevision: item.revision, seriesId: item.series_id, seriesRevision: series.revision, source: series.imported ? "import" : series.source, status: item.status, title: item.title, start: localInput(fromNs(item.start_ns), activeZone, allDay), end: localInput(fromNs(item.end_ns), activeZone, allDay), notes: item.notes, location: item.location, color: item.color, availability: variantName(item.availability) === "free" ? "free" : "busy", allDay, recurrence: recurrenceFromSeries(series, fromNs(first.start_ns), activeZone), editScope, anchorStart: localInput(fromNs(first.start_ns), activeZone, allDay), anchorEnd: localInput(fromNs(first.end_ns), activeZone, allDay) });
    } catch (error) { setMessage(errorText(error)); }
  };
  useEffect(() => onTileViewRequest((view) => {
    void (async () => {
      try {
        const request = parseReminderTileView(view); if (!request) return;
        const occurrences = await querySelf<RangePage>("calendar_series_occurrences_v2", [{ series_id: request.seriesId, offset: "0", limit: "730" }]);
        const item = occurrences.occurrences.find((value) => value.id === request.occurrenceId && value.status !== "cancelled");
        if (item) await openEvent(item);
      } catch { /* Ignore malformed or stale tray navigation. */ }
    })();
  }), [activeZone]);
  const seriesValue = (current: EditorDraft) => { const materialized = materializeRecurrence(current.start, current.end, current.allDay, current.recurrence, activeZone); if (materialized.error) throw new Error(materialized.error); return { title: current.title.trim(), notes: current.notes, location: current.location, color: current.color, availability: { [current.availability]: null }, kind: { [current.allDay ? "all_day" : "timed"]: null }, time_zone: activeZone, recurrence: materialized.recurrence, occurrences: materialized.occurrences }; };
  const saveEvent = async () => {
    if (!draft.title.trim() || !draft.start || !draft.end) return; setBusy(true);
    try {
      let result: JsonValue;
      if (draft.seriesId === null) result = await updateSelf<JsonValue>("calendar_series_create_v2", [{ expected_revision: page.revision, value: seriesValue(draft) }]);
      else if (draft.editScope === "occurrence" && draft.occurrenceId && draft.occurrenceRevision) result = await updateSelf<JsonValue>("calendar_occurrence_update_v2", [{ occurrence_id: draft.occurrenceId, expected_occurrence_revision: draft.occurrenceRevision, start_ns: asNs(draft.start, activeZone, draft.allDay), end_ns: asNs(draft.end, activeZone, draft.allDay), title_override: draft.title, notes_override: draft.notes, location_override: draft.location }]);
      else result = await updateSelf<JsonValue>("calendar_series_update_v2", [{ series_id: draft.seriesId, expected_series_revision: draft.seriesRevision, value: seriesValue(draft) }]);
      const problem = resultError(result); if (problem) throw new Error(problem);
      const saved = successRecord(result, "Save event");
      const savedSeriesId = String(saved.series_id ?? saved.id ?? draft.seriesId ?? ""); const savedSeriesRevision = String(saved.series_revision ?? saved.revision ?? "");
      const reminderChanged = draft.seriesId === null ? reminderChoice !== "none" : reminderChoice !== savedReminderChoice;
      if (reminderChanged && savedSeriesId && savedSeriesRevision) {
        try {
          const reminderResult = await updateSelf<JsonValue>("calendar_reminder_set_v1", [{ series_id: savedSeriesId, occurrence_id: draft.editScope === "occurrence" ? draft.occurrenceId : null, expected_series_revision: savedSeriesRevision, offset_minutes: reminderChoice === "none" || reminderChoice === "inherit" ? null : Number(reminderChoice) }]);
          const reminderProblem = resultError(reminderResult); if (reminderProblem) throw new Error(reminderProblem);
        } catch (error) {
          setReminderChoice("none"); setSavedReminderChoice("none"); setDraft(freshDraft(undefined, undefined, false, activeZone)); await refresh();
          setMessage(`Event saved, but the reminder was not saved. Reopen the event to retry. ${errorText(error)}`); return;
        }
      }
      setReminderChoice("none"); setSavedReminderChoice("none"); setDraft(freshDraft(undefined, undefined, false, activeZone)); await refresh();
    } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  };
  const removeEvent = async () => {
    if (!deleteArmed) { setDeleteArmed(true); return; }
    if (!draft.seriesId) return; setBusy(true);
    try { const result = draft.editScope === "occurrence" && draft.occurrenceId ? await updateSelf<JsonValue>("calendar_occurrence_remove_v2", [{ occurrence_id: draft.occurrenceId, expected_occurrence_revision: draft.occurrenceRevision }]) : await updateSelf<JsonValue>("calendar_series_remove_v2", [{ series_id: draft.seriesId, expected_series_revision: draft.seriesRevision }]); const problem = resultError(result); if (problem) throw new Error(problem); setDeleteArmed(false); setReminderChoice("none"); setSavedReminderChoice("none"); setDraft(freshDraft(undefined, undefined, false, activeZone)); await refresh(); } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  };
  const saveReminderOnly = async () => {
    if (!draft.seriesId || !draft.seriesRevision) return; setBusy(true);
    try {
      const result = await updateSelf<JsonValue>("calendar_reminder_set_v1", [{ series_id: draft.seriesId, occurrence_id: draft.editScope === "occurrence" ? draft.occurrenceId : null, expected_series_revision: draft.seriesRevision, offset_minutes: reminderChoice === "none" || reminderChoice === "inherit" ? null : Number(reminderChoice) }]);
      const problem = resultError(result); if (problem) throw new Error(problem);
      const ok = successRecord(result, "Save reminder"); const revision = String(ok.revision);
      setDraft({ ...draft, seriesRevision: revision }); setSavedReminderChoice(reminderChoice); await refresh(); setMessage("Reminder saved.");
    } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  };
  const moveEvent = async (item: OccurrenceView, start: Date | null, end: Date | null, revert: () => void) => { if (!start || !end) { revert(); return; } setBusy(true); try { const allDay = variantName(item.kind) === "all_day"; const result = await updateSelf<JsonValue>("calendar_occurrence_update_v2", [{ occurrence_id: item.id, expected_occurrence_revision: item.revision, start_ns: String(BigInt(calendarMarkerToInstant(start, activeZone, allDay).date.getTime()) * 1_000_000n), end_ns: String(BigInt(calendarMarkerToInstant(end, activeZone, allDay).date.getTime()) * 1_000_000n), title_override: null, notes_override: null, location_override: null }]); const problem = resultError(result); if (problem) throw new Error(problem); await refresh(); } catch (error) { revert(); setMessage(`Could not change event time. ${errorText(error)}`); } finally { setBusy(false); } };
  const preferencesValid = Boolean(preferences && isValidTimeZone(preferences.display_time_zone) && preferences.day_start_minute >= 0 && preferences.day_start_minute < preferences.day_end_minute && preferences.day_end_minute <= 1_440 && preferences.allowed_weekdays_mask > 0 && preferences.slot_increment_minutes >= 5 && preferences.slot_increment_minutes <= 120 && preferences.buffer_before_minutes >= 0 && preferences.buffer_before_minutes <= 240 && preferences.buffer_after_minutes >= 0 && preferences.buffer_after_minutes <= 240);
  const preferencesDirty = Boolean(preferences && savedPreferences && JSON.stringify(preferences) !== JSON.stringify(savedPreferences));
  const savePreferences = async () => { if (!preferences || !preferencesValid) return; setBusy(true); try { const result = await updateSelf<JsonValue>("calendar_preferences_set", [{ expected_revision: page.revision, day_start_minute: preferences.day_start_minute, day_end_minute: preferences.day_end_minute, allowed_weekdays_mask: preferences.allowed_weekdays_mask, slot_increment_minutes: preferences.slot_increment_minutes, buffer_before_minutes: preferences.buffer_before_minutes, buffer_after_minutes: preferences.buffer_after_minutes, display_time_zone: preferences.display_time_zone }]); const problem = resultError(result); if (problem) throw new Error(problem); await refresh(); setMessage("Scheduling defaults saved."); } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); } };
  const scheduleWithSomeone = async () => {
    try {
      const start = resolveZonedEditorValue(draft.start, activeZone, draft.allDay).date; const end = resolveZonedEditorValue(draft.end, activeZone, draft.allDay).date;
      const view = scheduleView(start, end);
      await openAppTile({ appId: "rendezvous", tileId: "main", reuseExisting: true, view });
      setMessage("Opened Rendezvous with this date, time, and duration. You still choose who receives the proposal and which options to send.");
    } catch (error) { setMessage(errorText(error)); }
  };
  const openMeetingDetails = async () => {
    try {
      const view = meetingView(resolveZonedEditorValue(draft.start, activeZone, draft.allDay).date, resolveZonedEditorValue(draft.end, activeZone, draft.allDay).date);
      await openAppTile({ appId: "rendezvous", tileId: "main", reuseExisting: true, view });
      setMessage("Opened this scheduled meeting in Rendezvous.");
    } catch (error) { setMessage(errorText(error)); }
  };
  const loadPublicCalendarId = async () => {
    const response = await fetch(new URL(KERNEL_RUNTIME_CONFIG_PATH, window.location.href), { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error(`Could not read this Neutron's public identity (${response.status}).`);
    return parseKernelRuntimeConfig(await response.text()).canister_id;
  };
  const copyPreparedExport = () => {
    if (!preparedExport) return;
    void copyToClipboard(preparedExport.contents).then(() => setMessage(`Copied ${preparedExport.filename} iCalendar data. Save it as a plain-text .ics file to import it.`)).catch((error) => setMessage(`Could not copy the iCalendar data. ${errorText(error)}`));
  };
  const openFiles = () => {
    void openAppTile({ appId: "files", tileId: "files", reuseExisting: true }).then(() => setMessage(preparedExport?.path ? `Opened Files. Find ${preparedExport.path} and choose Download.` : "Opened Files.")).catch((error) => setMessage(`Could not open Files. ${errorText(error)}`));
  };
  const loadExportRows = async (filter: { seriesId?: string; occurrenceId?: string; start?: Date; end?: Date }) => {
    const rows: ExportRow[] = [];
    let offset = 0; let expectedRevision: string | null = null; let total = 0;
    do {
      const result = await querySelf<ExportPage>("calendar_export_v1", [{ series_id: filter.seriesId ?? null, occurrence_id: filter.occurrenceId ?? null, start_ns: filter.start ? String(BigInt(filter.start.getTime()) * 1_000_000n) : null, end_ns: filter.end ? String(BigInt(filter.end.getTime()) * 1_000_000n) : null, include_holds: exportHolds, offset: String(offset), limit: "100" }]);
      if (expectedRevision !== null && result.revision !== expectedRevision) throw new Error("Calendar changed during export. Try again to export one consistent snapshot.");
      expectedRevision = result.revision; total = Number(result.total); rows.push(...result.occurrences); offset += result.occurrences.length;
      if (result.occurrences.length === 0 && offset < total) throw new Error("Calendar export stopped before all events were read.");
    } while (offset < total);
    return rows;
  };
  const searchBoundaryNs = (value: string, exclusiveAfter = false) => {
    if (!value) return null;
    if (!exclusiveAfter) return asNs(value, activeZone, true);
    const marker = new Date(`${value}T00:00:00Z`); marker.setUTCDate(marker.getUTCDate() + 1);
    return asNs(marker.toISOString().slice(0, 10), activeZone, true);
  };
  const runSearch = useCallback(async (reset: boolean) => {
    const hasCriteria = Boolean(searchFilters.text.trim() || searchFilters.source !== "any" || searchFilters.availability !== "any" || searchFilters.recurring !== "any" || searchFilters.from || searchFilters.through);
    if (!hasCriteria) { setSearchResults([]); setSearchRevision(null); setSearchCursor(null); setSearchState("idle"); setSearchError(""); return; }
    setSearchState("loading"); setSearchError("");
    try {
      let cursor: string | null = reset ? "0" : searchCursor;
      let revision: string | null = reset ? null : searchRevision;
      let accumulated = reset ? [] : searchResults;
      let calls = 0; let added = 0;
      while (cursor !== null && calls < 6 && added < 50) {
        const raw = await querySelf<JsonValue>("calendar_search_v1", [encodeCalendarSearchWire({ queryText: searchFilters.text.trim(), startNs: searchBoundaryNs(searchFilters.from), endNs: searchBoundaryNs(searchFilters.through, true), source: searchFilters.source === "any" ? null : searchFilters.source, availability: searchFilters.availability === "any" ? null : searchFilters.availability, status: null, recurring: searchFilters.recurring === "any" ? null : searchFilters.recurring === "yes", expectedRevision: revision, offset: cursor, limit: "50" })]);
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("Calendar returned an invalid search response.");
        if ("stale" in raw) { setSearchState("stale"); setSearchCursor(null); return; }
        if ("invalid" in raw) { const value = raw.invalid; throw new Error(typeof value === "object" && value !== null && !Array.isArray(value) && "message" in value ? String(value.message) : "Invalid calendar search."); }
        if (!("ok" in raw) || typeof raw.ok !== "object" || raw.ok === null || Array.isArray(raw.ok)) throw new Error("Calendar returned an invalid search page.");
        const page = raw.ok as unknown as SearchPage;
        if (revision !== null && page.revision !== revision) { setSearchState("stale"); setSearchCursor(null); return; }
        revision = page.revision; added += page.occurrences.length; accumulated = [...accumulated, ...page.occurrences]; cursor = optionalScalar(page.next_offset); calls += 1;
      }
      setSearchResults([...new Map(accumulated.map((item) => [item.id, item])).values()]); setSearchRevision(revision); setSearchCursor(cursor); setSearchState("ready");
    } catch (error) { setSearchError(errorText(error)); setSearchState("error"); }
  }, [activeZone, searchCursor, searchFilters, searchResults, searchRevision]);
  useEffect(() => { const timer = window.setTimeout(() => void runSearch(true), 350); return () => window.clearTimeout(timer); }, [searchFilters, activeZone]);
  const exportCalendar = async (filter: { seriesId?: string; occurrenceId?: string; start?: Date; end?: Date }, filename: string) => {
    setBusy(true);
    try {
      const [calendarId, rows] = await Promise.all([loadPublicCalendarId(), loadExportRows(filter)]);
      const events: IcsEvent[] = rows.map(({ occurrence, series_updated_at_ns, time_zone }) => ({ seriesId: occurrence.series_id, occurrenceId: occurrence.id, recurrenceKey: occurrence.recurrence_key, seriesRevision: occurrence.series_revision, occurrenceRevision: occurrence.revision, updatedAt: fromNs(series_updated_at_ns), start: fromNs(occurrence.start_ns), end: fromNs(occurrence.end_ns), title: occurrence.title, notes: occurrence.notes, location: occurrence.location, availability: variantName(occurrence.availability) === "free" ? "free" : "busy", allDay: variantName(occurrence.kind) === "all_day", timeZone: time_zone, status: occurrence.status, source: occurrence.source }));
      const included = events.filter((event) => (exportHolds || event.status !== "hold") && event.status !== "cancelled").length;
      const contents = serializeIcs(events, { calendarId, calendarName: "Neutron Calendar", includeDetails: exportDetails, includeHolds: exportHolds });
      const safeFilename = safeIcsFilename(filename.replace(/\.ics$/iu, ""));
      const bodyBytes = new TextEncoder().encode(contents).byteLength;
      const path = `/Workspace/Calendar Exports/${safeFilename}`;
      setPreparedExport({ path: null, filename: safeFilename, bodyBytes, contents });
      try {
        const result = await callTool<JsonValue>({ target: "app:files:background", name: "write", arguments: { path, content: contents, mediaType: "text/calendar; charset=utf-8", overwrite: true, createParents: true } }, 180);
        if (typeof result !== "object" || result === null || Array.isArray(result) || result.path !== path) throw new Error("Files returned an invalid save receipt.");
        setPreparedExport({ path, filename: safeFilename, bodyBytes, contents });
        setMessage(`Saved ${included} event${included === 1 ? "" : "s"} to ${path}. Open Files to download or share the .ics file.`);
      } catch (filesError) {
        setMessage(`Prepared ${included} event${included === 1 ? "" : "s"} as ${safeFilename}, but Files could not save it: ${errorText(filesError)} You can still copy the iCalendar data below.`);
      }
    } catch (error) {
      setMessage(`Could not export calendar. ${errorText(error)}`);
    } finally { setBusy(false); }
  };
  const loadImportFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true); setImportPreview(null); setImportSelected(new Set()); setImportReceipt(null); setImportFilename(file.name);
    try {
      if (!file.name.toLowerCase().endsWith(".ics")) throw new Error("Choose a file whose name ends in .ics.");
      if (file.size > 1_048_576) throw new Error("iCalendar imports are limited to 1 MiB.");
      if (file.type && file.type !== "text/calendar" && file.type !== "application/octet-stream") throw new Error(`Unsupported file media type ${file.type}. Choose a text/calendar .ics file.`);
      const parsed = await parseIcsFileInWorker(file, activeZone);
      const index = await querySelf<{ revision: string; entries: ImportIndexEntry[] }>("calendar_import_index_v1", [{ source_namespace: parsed.sourceNamespace, external_uids: parsed.series.map((series) => series.uid) }]);
      const preview = buildImportPreview(parsed, index);
      setImportPreview(preview); setImportSelected(new Set(preview.items.filter((item) => item.selected).map((item) => item.uid)));
      const actionable = preview.items.filter((item) => item.category === "create" || item.category === "update").length;
      setMessage(`Reviewed ${parsed.series.length} series from ${file.name}. ${actionable} can be selected for import; no changes have been made.`);
    } catch (error) { setMessage(`Could not review ${file.name}. ${errorText(error)}`); }
    finally { setBusy(false); }
  };
  const toggleImport = (uid: string) => setImportSelected((current) => { const next = new Set(current); if (next.has(uid)) next.delete(uid); else next.add(uid); return next; });
  const commitImport = async () => {
    if (!importPreview) return;
    const chosen = importPreview.items.filter((item) => importSelected.has(item.uid) && (item.category === "create" || item.category === "update"));
    if (!chosen.length) return;
    setBusy(true);
    const batchId = crypto.getRandomValues(new Uint8Array(16));
    const previewDigest = await importPreviewDigest(importPreview, importSelected);
    const request = { expected_revision: importPreview.revision, batch_id: batchId, preview_digest: previewDigest, source_namespace: importPreview.sourceNamespace, series: chosen.map(importSeriesWire) };
    try {
      let result = await updateSelf<JsonValue>("calendar_import_commit_v1", [request]);
      if (typeof result !== "object" || result === null || Array.isArray(result)) throw new Error("Calendar returned an invalid import receipt.");
      if ("err" in result) throw new Error(resultError(result) ?? "Import was rejected.");
      const raw = "committed" in result ? result.committed : "already_committed" in result ? result.already_committed : null;
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("Calendar returned an invalid import receipt.");
      const receipt = raw as Record<string, JsonValue>;
      setImportReceipt({ batchId, previewDigest, committedRevision: String(receipt.committed_revision), changeCount: Number(receipt.change_count), undone: false });
      setImportPreview(null); setImportSelected(new Set()); await refresh(); setMessage(`Imported ${chosen.length} event series atomically. You can undo this exact batch until any imported item is edited.`);
    } catch (error) {
      try {
        const status = await querySelf<JsonValue>("calendar_bulk_status_v1", [{ batch_id: batchId, preview_digest: previewDigest }]);
        if (typeof status === "object" && status !== null && !Array.isArray(status) && "committed" in status && typeof status.committed === "object" && status.committed !== null && !Array.isArray(status.committed)) {
          const receipt = status.committed as Record<string, JsonValue>;
          setImportReceipt({ batchId, previewDigest, committedRevision: String(receipt.committed_revision), changeCount: Number(receipt.change_count), undone: false });
          setImportPreview(null); setImportSelected(new Set()); await refresh(); setMessage("The import response was interrupted, but its durable receipt confirms the complete batch committed.");
        } else throw error;
      } catch { setMessage(`Import did not produce a matching receipt. Nothing should be retried blindly. ${errorText(error)}`); }
    } finally { setBusy(false); }
  };
  const undoImport = async () => {
    if (!importReceipt || importReceipt.undone) return;
    setBusy(true);
    try {
      const result = await updateSelf<JsonValue>("calendar_bulk_undo_v1", [{ batch_id: importReceipt.batchId, preview_digest: importReceipt.previewDigest }]);
      const problem = resultError(result); if (problem) throw new Error(problem);
      if (typeof result !== "object" || result === null || Array.isArray(result) || (!("undone" in result) && !("already_undone" in result))) throw new Error("Calendar returned an invalid undo result.");
      setImportReceipt({ ...importReceipt, undone: true }); await refresh(); setMessage("The imported batch was undone without overwriting later edits.");
    } catch (error) { setMessage(`Could not undo import. ${errorText(error)}`); }
    finally { setBusy(false); }
  };
  const selectRange = (selection: DateSelectArg) => beginDraft(freshDraft(calendarMarkerToInstant(selection.start, activeZone, selection.allDay).date, calendarMarkerToInstant(selection.end, activeZone, selection.allDay).date, selection.allDay, activeZone));
  const clickDate = (selection: DateClickArg) => { const endMarker = new Date(selection.date.getTime() + (selection.allDay ? 86_400_000 : 3_600_000)); beginDraft(freshDraft(calendarMarkerToInstant(selection.date, activeZone, selection.allDay).date, calendarMarkerToInstant(endMarker, activeZone, selection.allDay).date, selection.allDay, activeZone)); };
  const clickEvent = (event: EventClickArg) => { const item = event.event.extendedProps.item as OccurrenceView | undefined; if (item) void openEvent(item); };
  const dropEvent = (event: EventDropArg) => void moveEvent(event.event.extendedProps.item as OccurrenceView, event.event.start, event.event.end, event.revert);
  const resizeEvent = (event: EventResizeDoneArg) => void moveEvent(event.event.extendedProps.item as OccurrenceView, event.event.start, event.event.end, event.revert);
  const togglePreferenceDay = (day: number) => preferences && setPreferences({ ...preferences, allowed_weekdays_mask: preferences.allowed_weekdays_mask ^ 2 ** day });
  const toggleRepeatDay = (day: number) => setDraft({ ...draft, recurrence: { ...draft.recurrence, weekdays: draft.recurrence.weekdays.includes(day) ? draft.recurrence.weekdays.filter((value) => value !== day) : [...draft.recurrence.weekdays, day].sort() } });
  const businessHours = preferences ? [{ daysOfWeek: weekdayLabels.map((_, day) => day).filter((day) => (preferences.allowed_weekdays_mask & 2 ** day) !== 0), startTime: minutesToTime(preferences.day_start_minute), endTime: minutesToTime(preferences.day_end_minute) }] : undefined;
  const recurring = draft.recurrence.frequency !== "none";
  const rendezvousMeeting = draft.source === "rendezvous";
  const importedSeries = draft.source === "import";
  const rendezvousHold = rendezvousMeeting && draft.status === "hold";
  const recurrencePreview = useMemo(() => materializeRecurrence(draft.start, draft.end, draft.allDay, draft.recurrence, activeZone), [activeZone, draft.start, draft.end, draft.allDay, draft.recurrence]);
  const slotDuration = minutesToDuration(preferences?.slot_increment_minutes ?? 15);
  const changeAllDay = (allDay: boolean) => {
    if (allDay) {
      const start = draft.start.slice(0, 10);
      let end = draft.end.slice(0, 10);
      if (end <= start) { const marker = new Date(`${start}T00:00:00Z`); marker.setUTCDate(marker.getUTCDate() + 1); end = marker.toISOString().slice(0, 10); }
      setDraft({ ...draft, allDay: true, start, end });
    } else {
      setDraft({ ...draft, allDay: false, start: `${draft.start.slice(0, 10)}T09:00`, end: `${draft.start.slice(0, 10)}T10:00` });
    }
  };

  return <main className={cx(nt.appFill, "calendar-app")}><div className="nt-page calendar-shell">
    <header className="nt-page-header calendar-header"><div><p className="nt-eyebrow">Private by default</p><h1 className="nt-title">Calendar</h1><p className="nt-text">A complete local calendar. Your event details stay inside your Neutron.</p></div><div className="header-actions"><span className="nt-tag nt-tag--success">{page.total} in this window</span><button className="nt-button nt-button--sm" onClick={() => beginDraft({ ...freshDraft(undefined, undefined, false, activeZone), title: "Busy" })} type="button">Block time</button></div></header>
    <div className="calendar-layout nt-page-main"><section className="nt-panel calendar-board" aria-label="Calendar views"><FullCalendar plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]} initialView={initialCalendarView} timeZone="UTC" now={instantToCalendarMarker(new Date(), activeZone)} datesSet={showRange} headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" }} buttonText={{ today: "Today", month: "Month", week: "Week", day: "Day", list: "Agenda" }} events={calendarEvents} selectable selectMirror select={selectRange} dateClick={clickDate} eventClick={clickEvent} eventDrop={dropEvent} eventResize={resizeEvent} editable={!busy} eventInteractive nowIndicator navLinks dayMaxEvents allDaySlot {...(businessHours ? { businessHours } : {})} scrollTime={preferences ? `${minutesToTime(preferences.day_start_minute)}:00` : "08:00:00"} slotDuration={slotDuration} snapDuration={slotDuration} height={calendarHeight} /></section>
      <aside className="calendar-sidebar"><section className="nt-panel editor" aria-labelledby="event-editor-title"><div className="section-title"><div><p className="nt-eyebrow">{draft.seriesId ? "Edit event" : "New event"}</p><h2 id="event-editor-title">{draft.seriesId ? draft.title || "Untitled event" : "Block or schedule time"}</h2></div>{draft.seriesId && <button className="nt-button nt-button--sm" onClick={() => beginDraft(freshDraft(undefined, undefined, false, activeZone))} type="button">New</button>}</div>
        {rendezvousMeeting && <div className="meeting-notice" role="status"><strong>{rendezvousHold ? "Tentative Rendezvous hold" : "Scheduled through Rendezvous"}</strong><span>{rendezvousHold ? "This time is temporarily reserved while delivery or confirmation is unresolved. Open Rendezvous to review or retry it." : "This confirmed meeting is read-only here. Open Rendezvous to see the negotiation or manage its state."}</span></div>}
        {importedSeries && <div className="meeting-notice" role="status"><strong>Imported iCalendar series</strong><span>You are editing only this occurrence. This preserves the other imported dates and makes a later file update surface as a conflict instead of overwriting your edit.</span></div>}
        {draft.seriesId && recurring && !rendezvousMeeting && <fieldset><legend>Change</legend><div className="scope-picker"><label><input type="radio" checked={draft.editScope === "occurrence"} onChange={() => changeEditScope("occurrence")} />This event</label><label><input type="radio" checked={draft.editScope === "series"} onChange={() => changeEditScope("series")} />Entire series</label></div></fieldset>}
        <label>Title<input ref={titleInputRef} required disabled={rendezvousMeeting} maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label className="inline-check"><input type="checkbox" checked={draft.allDay} disabled={rendezvousMeeting || (draft.editScope === "occurrence" && recurring)} onChange={(event) => changeAllDay(event.target.checked)} />All-day event</label>
        <div className="form-row"><label>Starts<input required disabled={rendezvousMeeting} type={draft.allDay ? "date" : "datetime-local"} value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} /></label><label>Ends{draft.allDay ? " (exclusive)" : ""}<input required disabled={rendezvousMeeting} type={draft.allDay ? "date" : "datetime-local"} value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} /></label></div>
        <div className="form-row"><label>Show as<select value={draft.availability} disabled={rendezvousMeeting || (draft.editScope === "occurrence" && recurring)} onChange={(event) => setDraft({ ...draft, availability: event.target.value as "busy" | "free" })}><option value="busy">Busy</option><option value="free">Free</option></select></label><label>Color<select value={draft.color} disabled={rendezvousMeeting || (draft.editScope === "occurrence" && recurring)} onChange={(event) => setDraft({ ...draft, color: event.target.value })}><option value="sage">Sage</option><option value="ocean">Ocean</option><option value="violet">Violet</option><option value="sunset">Sunset</option></select></label></div>
        <label>Location<input disabled={rendezvousMeeting} maxLength={512} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label><label>Notes<textarea disabled={rendezvousMeeting} maxLength={4096} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
        <label>Reminder<select value={reminderChoice} onChange={(event) => setReminderChoice(event.target.value)}>{draft.editScope === "occurrence" && <option value="inherit">Use series reminder</option>}{reminderOptions.filter(([value]) => draft.editScope !== "occurrence" || value !== "none").map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><span className="editor-hint">{draft.editScope === "occurrence" ? "This reminder applies only to this occurrence; choose the series option to inherit its default." : recurring ? "This reminder applies to every occurrence unless that occurrence has its own reminder." : "The tray badge appears when the reminder is due."}</span></label>
        {draft.editScope === "series" && !rendezvousMeeting && <div className="recurrence-editor"><label>Repeat<select value={draft.recurrence.frequency} onChange={(event) => setDraft({ ...draft, recurrence: { ...draft.recurrence, frequency: event.target.value as RepeatFrequency } })}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>{recurring && <><div className="form-row"><label>Every<input type="number" min="1" max="99" value={draft.recurrence.interval} onChange={(event) => setDraft({ ...draft, recurrence: { ...draft.recurrence, interval: Number(event.target.value) } })} /></label><label>Ends<select value={draft.recurrence.endMode} onChange={(event) => setDraft({ ...draft, recurrence: { ...draft.recurrence, endMode: event.target.value as "count" | "until" } })}><option value="count">After a number</option><option value="until">On a date</option></select></label></div>{draft.recurrence.frequency === "weekly" && <fieldset><legend>Repeat on</legend><div className="weekday-picker">{weekdayLabels.map((label, day) => <label key={label}><input type="checkbox" checked={draft.recurrence.weekdays.includes(day)} onChange={() => toggleRepeatDay(day)} />{label}</label>)}</div></fieldset>}{draft.recurrence.endMode === "count" ? <label>Occurrences<input type="number" min="1" max="730" value={draft.recurrence.count} onChange={(event) => setDraft({ ...draft, recurrence: { ...draft.recurrence, count: Number(event.target.value) } })} /></label> : <label>Repeat through<input type="date" min={draft.start.slice(0, 10)} value={draft.recurrence.until} onChange={(event) => setDraft({ ...draft, recurrence: { ...draft.recurrence, until: event.target.value } })} /></label>}<p className="repeat-summary">{repeatSummary(draft.recurrence)}</p></>}</div>}
        {recurrencePreview.error && !rendezvousMeeting && <p className="field-error" role="alert">{recurrencePreview.error}</p>}
        {!draft.allDay && recurrencePreview.occurrences[0] && <div className={recurrencePreview.warnings.length ? "time-resolution time-resolution--warning" : "time-resolution"}><p>Resolved in <strong>{activeZone}</strong> as {dateTime.format(fromNs(recurrencePreview.occurrences[0].start_ns))}.</p>{recurrencePreview.warnings.map((warning) => <p role="alert" key={warning}>{warning}</p>)}</div>}
        <div className="editor-actions">{!rendezvousMeeting && <button className="nt-button" disabled={busy || !draft.title.trim() || !draft.start || !draft.end || Boolean(recurrencePreview.error) || (draft.recurrence.frequency === "weekly" && draft.recurrence.weekdays.length === 0)} onClick={() => void saveEvent()} type="button">{draft.seriesId ? "Save changes" : "Add to calendar"}</button>}{draft.seriesId && !rendezvousMeeting && <button className="nt-button nt-button--danger" disabled={busy} onClick={() => void removeEvent()} type="button">{deleteArmed ? `Confirm delete ${draft.editScope === "occurrence" ? "event" : "series"}` : `Delete ${draft.editScope === "occurrence" ? "event" : "series"}`}</button>}{draft.occurrenceId && <button className="nt-button nt-button--sm" disabled={busy} onClick={() => void exportCalendar({ occurrenceId: draft.occurrenceId! }, draft.title || "event")} type="button">Export event</button>}{!draft.allDay && !rendezvousMeeting && <button className="nt-button nt-button--sm" disabled={busy || !draft.start || !draft.end} onClick={() => void scheduleWithSomeone()} type="button">{draft.seriesId ? "Find another time" : "Find a time with someone"}</button>}{rendezvousMeeting && <button className="nt-button" disabled={busy} onClick={() => void openMeetingDetails()} type="button">Open meeting in Rendezvous</button>}{rendezvousMeeting && <button className="nt-button nt-button--sm" disabled={busy || reminderChoice === savedReminderChoice} onClick={() => void saveReminderOnly()} type="button">Save reminder</button>}</div>{deleteArmed && <p className="editor-hint" role="alert">This cannot be undone. Select confirm delete to continue.</p>}<p className="editor-hint">{rendezvousMeeting ? rendezvousHold ? "Calendar treats this live hold as busy until it expires or Rendezvous resolves it." : "Calendar keeps the confirmed time busy; negotiation actions stay in Rendezvous." : "Drag across the calendar to choose time. Owner events can be moved or resized directly."}</p>
      </section>
      <section className="nt-panel editor search-editor" aria-labelledby="calendar-search-title"><div><p className="nt-eyebrow">Entire calendar</p><h2 id="calendar-search-title">Search events</h2></div><label>Words<input type="search" maxLength={256} placeholder="Title, notes, or location" value={searchFilters.text} onChange={(event) => setSearchFilters({ ...searchFilters, text: event.target.value })} /></label><div className="form-row"><label>Source<select value={searchFilters.source} onChange={(event) => setSearchFilters({ ...searchFilters, source: event.target.value as SearchFilters["source"] })}><option value="any">Any source</option><option value="owner">My events</option><option value="rendezvous">Rendezvous</option></select></label><label>Show as<select value={searchFilters.availability} onChange={(event) => setSearchFilters({ ...searchFilters, availability: event.target.value as SearchFilters["availability"] })}><option value="any">Busy or free</option><option value="busy">Busy</option><option value="free">Free</option></select></label></div><div className="form-row"><label>From<input type="date" value={searchFilters.from} onChange={(event) => setSearchFilters({ ...searchFilters, from: event.target.value })} /></label><label>Through<input type="date" value={searchFilters.through} onChange={(event) => setSearchFilters({ ...searchFilters, through: event.target.value })} /></label></div><label>Repeats<select value={searchFilters.recurring} onChange={(event) => setSearchFilters({ ...searchFilters, recurring: event.target.value as SearchFilters["recurring"] })}><option value="any">One-time or recurring</option><option value="yes">Recurring only</option><option value="no">One-time only</option></select></label>
        {searchState === "loading" && <p className="editor-hint" role="status">Searching authoritative Calendar data…</p>}
        {searchState === "idle" && <p className="editor-hint">Enter words or choose a filter. Search is not limited to the dates currently visible above.</p>}
        {searchState === "error" && <p className="field-error" role="alert">{searchError}</p>}
        {searchState === "stale" && <div><p className="field-error" role="alert">Calendar changed while these pages were being read.</p><button className="nt-button nt-button--sm" type="button" onClick={() => void runSearch(true)}>Restart search</button></div>}
        {searchState === "ready" && searchResults.length === 0 && <p className="editor-hint">No matching active events.</p>}
        {searchResults.length > 0 && <ol className="search-results">{searchResults.map((item) => <li key={item.id}><button type="button" onClick={() => void openEvent(item)}><span><strong>{item.title}</strong><small>{item.source === "rendezvous" ? "Rendezvous" : variantName(item.availability) === "free" ? "Free" : "Busy"}</small></span><time dateTime={fromNs(item.start_ns).toISOString()}>{dateTime.format(fromNs(item.start_ns))}</time></button></li>)}</ol>}
        {searchState === "ready" && searchCursor !== null && <button className="nt-button nt-button--sm" disabled={busy} type="button" onClick={() => void runSearch(false)}>Search more</button>}
      </section>
      <section className="nt-panel editor export-editor"><div><p className="nt-eyebrow">Interoperability</p><h2>Export iCalendar</h2></div><label className="inline-check"><input type="checkbox" checked={exportDetails} onChange={(event) => setExportDetails(event.target.checked)} />Include titles, notes, and locations</label><label className="inline-check"><input type="checkbox" checked={exportHolds} onChange={(event) => setExportHolds(event.target.checked)} />Include live tentative Rendezvous holds</label><div className="editor-actions"><button className="nt-button nt-button--sm" disabled={busy} onClick={() => void exportCalendar({ start: visibleRangeRef.current.start, end: visibleRangeRef.current.end }, "neutron-calendar-visible-range")} type="button">Export visible range</button><button className="nt-button nt-button--sm" disabled={busy} onClick={() => void exportCalendar({}, "neutron-calendar")} type="button">Export calendar</button></div>{preparedExport && <div className="export-publication" role="status"><p><strong>{preparedExport.filename}</strong> · {preparedExport.bodyBytes.toLocaleString()} bytes</p>{preparedExport.path && <label>Saved privately in Files<input readOnly value={preparedExport.path} onFocus={(event) => event.currentTarget.select()} /></label>}<div className="editor-actions"><button className="nt-button nt-button--sm" onClick={copyPreparedExport} type="button">Copy iCalendar data</button><button className="nt-button nt-button--ghost nt-button--sm" onClick={openFiles} type="button">Open Files</button><button className="nt-button nt-button--ghost nt-button--sm" onClick={() => setPreparedExport(null)} type="button">Clear prepared export</button></div><p className="editor-hint">In Files, select the saved file and choose Download. If Files is unavailable, copy the data and save it as a plain-text file with the filename shown above.</p></div>}<p className="editor-hint">The `.ics` file works with Google Calendar, Outlook, Apple Calendar, and other iCalendar apps. Files is an optional private download handoff; Calendar itself remains independently installable and keeps no extra export memory. Turn details off to export only Busy labels and times. Expired holds and cancelled occurrences are excluded.</p></section>
      <section className="nt-panel editor import-editor" aria-labelledby="calendar-import-title"><div><p className="nt-eyebrow">Review before changing</p><h2 id="calendar-import-title">Import iCalendar</h2></div><label>Choose `.ics` file<input accept=".ics,text/calendar" disabled={busy} type="file" onChange={(event) => void loadImportFile(event.currentTarget.files?.[0] ?? null)} /></label>
        {!importPreview && !importReceipt && <p className="editor-hint">Parsing happens locally in a bounded worker. Calendar rejects scheduling messages, attendees, organizers, alarms, malformed recurrence, and files larger than 1 MiB. Selecting a file does not change your calendar.</p>}
        {importPreview && <div className="import-preview" role="region" aria-label={`Import preview for ${importFilename}`}><div className="import-summary"><strong>{importFilename}</strong><span>{importSelected.size} backend mutation{importSelected.size === 1 ? "" : "s"} selected</span></div>{importPreview.diagnostics.length > 0 && <ul className="import-diagnostics" aria-label="Import diagnostics">{importPreview.diagnostics.map((item, index) => <li key={`${item.code}:${item.uid ?? "file"}:${index}`}><strong>{item.code.replaceAll("_", " ")}</strong>: {item.message}{item.uid ? ` (${item.uid})` : ""}</li>)}</ul>}<ol>{importPreview.items.map((item) => { const first = item.series.occurrences[0]; const selectable = item.category === "create" || item.category === "update"; return <li className={`import-item import-item--${item.category}`} key={item.uid}><label><input type="checkbox" disabled={!selectable || busy} checked={importSelected.has(item.uid)} onChange={() => toggleImport(item.uid)} /><span><strong>{first?.title ?? item.uid}</strong><small>{item.category} · {item.series.occurrences.length} occurrence{item.series.occurrences.length === 1 ? "" : "s"}</small></span></label>{first && <time dateTime={first.startIso}>{dateTime.format(new Date(first.startIso))} · {first.timeZone}</time>}<p>{item.reason}</p><details><summary>Details and UID</summary><p>{first?.location || "No location"}</p><p>{first?.notes || "No notes"}</p><code>{item.uid}</code></details></li>; })}</ol><div className="editor-actions"><button className="nt-button" disabled={busy || importSelected.size === 0} onClick={() => void commitImport()} type="button">Import {importSelected.size} selected</button><button className="nt-button nt-button--ghost nt-button--sm" disabled={busy} onClick={() => { setImportPreview(null); setImportSelected(new Set()); setImportFilename(""); }} type="button">Cancel preview</button></div><p className="editor-hint">Only create and newer-SEQUENCE updates can be selected. Unchanged, older, ambiguous, duplicate, and invalid series are never silently overwritten.</p></div>}
        {importReceipt && <div className="export-publication" role="status"><p><strong>{importReceipt.undone ? "Import undone" : "Import committed"}</strong> · {importReceipt.changeCount} series · revision {importReceipt.committedRevision}</p><div className="editor-actions"><button className="nt-button nt-button--sm" disabled={busy || importReceipt.undone} onClick={() => void undoImport()} type="button">Undo this import</button><button className="nt-button nt-button--ghost nt-button--sm" disabled={busy} onClick={() => setImportReceipt(null)} type="button">Dismiss receipt</button></div><p className="editor-hint">Undo is safe: Calendar refuses if any affected series was edited after the import. Receipts are bounded to the 20 most recent batches.</p></div>}
      </section>
      {preferences && <section className="nt-panel editor availability-editor">
        <div><p className="nt-eyebrow">Scheduling defaults</p><h2>Working hours</h2></div>
        <fieldset><legend>Days you usually meet</legend><div className="weekday-picker">{weekdayLabels.map((label, day) => <label key={label}><input type="checkbox" checked={(preferences.allowed_weekdays_mask & 2 ** day) !== 0} onChange={() => togglePreferenceDay(day)} />{label}</label>)}</div></fieldset>
        <div className="form-row"><label>Start<input type="time" value={minutesToTime(preferences.day_start_minute)} onChange={(event) => setPreferences({ ...preferences, day_start_minute: timeToMinutes(event.target.value) })} /></label><label>End<input type="time" value={minutesToTime(preferences.day_end_minute)} onChange={(event) => setPreferences({ ...preferences, day_end_minute: timeToMinutes(event.target.value) })} /></label></div>
        <label>Time zone<input list="calendar-time-zones" maxLength={64} value={preferences.display_time_zone} placeholder={detectedZone} aria-invalid={!isValidTimeZone(preferences.display_time_zone)} onChange={(event) => setPreferences({ ...preferences, display_time_zone: event.target.value })} /><datalist id="calendar-time-zones">{timeZones.map((zone) => <option value={zone} key={zone} />)}</datalist><span className="editor-hint">Browser suggestion: {detectedZone}</span></label>
        {!isValidTimeZone(preferences.display_time_zone) && <p className="field-error" role="alert">Choose a valid IANA time zone, such as America/Chicago.</p>}
        <div className="form-row"><label>Calendar grid<select value={preferences.slot_increment_minutes} onChange={(event) => setPreferences({ ...preferences, slot_increment_minutes: Number(event.target.value) })}>{[5, 10, 15, 20, 30, 45, 60, 90, 120].map((minutes) => <option value={minutes} key={minutes}>{minutes} minutes</option>)}</select></label><label>Before meetings<input type="number" min="0" max="240" step="5" value={preferences.buffer_before_minutes} onChange={(event) => setPreferences({ ...preferences, buffer_before_minutes: Number(event.target.value) })} /></label></div>
        <label>After meetings<input type="number" min="0" max="240" step="5" value={preferences.buffer_after_minutes} onChange={(event) => setPreferences({ ...preferences, buffer_after_minutes: Number(event.target.value) })} /></label>
        <button className="nt-button nt-button--sm" disabled={busy || !preferencesDirty || !preferencesValid} onClick={() => void savePreferences()} type="button">Save scheduling defaults{preferencesDirty ? " (unsaved)" : ""}</button>
        <p className="editor-hint">Working hours guide suggestions; they never prevent creating an event. Meeting buffers reduce the free time Rendezvous can suggest before and after busy events; they do not change the event itself.</p>
      </section>}
      <section className="nt-panel upcoming" aria-labelledby="upcoming-title"><div><p className="nt-eyebrow">Next on your calendar</p><h2 id="upcoming-title">Upcoming</h2></div>{upcomingEvents.length === 0 ? <p className="editor-hint">Nothing upcoming yet. Drag across the calendar to reserve time.</p> : <ol>{upcomingEvents.map((item) => <li key={item.id}><button type="button" onClick={() => void openEvent(item)}><span>{item.title}</span><time dateTime={fromNs(item.start_ns).toISOString()}>{dateTime.format(fromNs(item.start_ns))}</time></button></li>)}</ol>}</section></aside>
    </div>{message && <output className="nt-result calendar-message" aria-live="polite">{message}</output>}
  </div></main>;
};
const container = document.getElementById("root"); if (!container) throw new Error("Root element not found"); createRoot(container).render(<App />);
