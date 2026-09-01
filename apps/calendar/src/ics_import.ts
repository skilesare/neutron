import ICAL from "ical.js";
import { isValidTimeZone, resolveZonedEditorValue } from "./time_zone";

export const ICS_IMPORT_LIMITS = {
  bytes: 1_048_576,
  lines: 20_000,
  properties: 50_000,
  components: 1_000,
  series: 250,
  occurrences: 2_000,
  propertiesPerEvent: 128,
  uidBytes: 512,
  titleBytes: 160,
  notesBytes: 4_096,
  locationBytes: 512,
} as const;

export type IcsImportDiagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  uid?: string;
  component?: number;
};

export type IcsImportOccurrence = {
  recurrenceKey: string;
  startIso: string;
  endIso: string;
  allDay: boolean;
  timeZone: string;
  title: string;
  notes: string;
  location: string;
  availability: "busy" | "free";
  status: "normal" | "cancelled";
};

export type IcsImportSeries = {
  uid: string;
  sequence: number;
  contentDigest: string;
  occurrences: IcsImportOccurrence[];
};

export type IcsImportParseResult = {
  sourceNamespace: string;
  calendarName: string;
  byteLength: number;
  lineCount: number;
  componentCount: number;
  propertyCount: number;
  series: IcsImportSeries[];
  diagnostics: IcsImportDiagnostic[];
};

type IcalTime = InstanceType<typeof ICAL.Time>;
type IcalEvent = InstanceType<typeof ICAL.Event>;
type EventGroup = { uid: string; master: InstanceType<typeof ICAL.Component> | null; exceptions: InstanceType<typeof ICAL.Component>[]; component: number };

const encoder = new TextEncoder();
const byteLength = (value: string) => encoder.encode(value).length;
const textValue = (value: unknown) => typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
const pad = (value: number) => String(value).padStart(2, "0");
const dateText = (value: IcalTime, includeTime: boolean) => `${value.year}-${pad(value.month)}-${pad(value.day)}${includeTime ? `T${pad(value.hour)}:${pad(value.minute)}:${pad(value.second)}` : ""}`;

function boundedText(value: string, maximum: number, field: string, uid: string, diagnostics: IcsImportDiagnostic[]): string {
  if (byteLength(value) <= maximum) return value;
  diagnostics.push({ severity: "error", code: `${field}_too_large`, message: `${field} exceeds ${maximum.toLocaleString()} UTF-8 bytes.`, uid });
  return value;
}

function sourceNamespace(root: InstanceType<typeof ICAL.Component>): string {
  const prodid = textValue(root.getFirstPropertyValue("prodid")).trim().normalize("NFKC").slice(0, 256);
  return prodid ? `ics:${prodid}` : "ics:unknown-producer";
}

function countTree(component: InstanceType<typeof ICAL.Component>): { components: number; properties: number } {
  let components = 1;
  let properties = component.getAllProperties().length;
  for (const child of component.getAllSubcomponents()) {
    const nested = countTree(child);
    components += nested.components;
    properties += nested.properties;
  }
  return { components, properties };
}

function timeZoneFor(component: InstanceType<typeof ICAL.Component>, fallback: string): string {
  const property = component.getFirstProperty("dtstart");
  const parameter = textValue(property?.getParameter("tzid")).trim();
  if (parameter) return parameter;
  const value = property?.getFirstValue();
  if (value instanceof ICAL.Time && value.zone?.tzid === "UTC") return "UTC";
  return fallback;
}

function timeToDate(value: IcalTime, timeZone: string): Date {
  if (value.isDate) return resolveZonedEditorValue(dateText(value, false), timeZone, true).date;
  if (value.zone?.tzid === "UTC" || timeZone === "UTC") return value.toJSDate();
  return resolveZonedEditorValue(dateText(value, true), timeZone).date;
}

function validateEventSurface(component: InstanceType<typeof ICAL.Component>, uid: string, index: number, diagnostics: IcsImportDiagnostic[]): boolean {
  let valid = true;
  if (component.getAllProperties().length > ICS_IMPORT_LIMITS.propertiesPerEvent) {
    diagnostics.push({ severity: "error", code: "event_property_limit", message: `VEVENT exceeds ${ICS_IMPORT_LIMITS.propertiesPerEvent} properties.`, uid, component: index });
    valid = false;
  }
  const unsupported = ["attendee", "organizer", "attach", "request-status"].filter((name) => component.hasProperty(name));
  if (component.getAllSubcomponents("valarm").length) unsupported.push("valarm");
  if (unsupported.length) {
    diagnostics.push({ severity: "error", code: "unsupported_scheduling", message: `Unsupported scheduling data: ${unsupported.join(", ")}. This event was not imported.`, uid, component: index });
    valid = false;
  }
  return valid;
}

function occurrenceFrom(details: ReturnType<IcalEvent["getOccurrenceDetails"]>, fallbackZone: string, uid: string, diagnostics: IcsImportDiagnostic[]): IcsImportOccurrence | null {
  const item = details.item;
  const component = item.component;
  const timeZone = timeZoneFor(component, fallbackZone);
  if (!isValidTimeZone(timeZone)) {
    diagnostics.push({ severity: "error", code: "unsupported_timezone", message: `TZID ${timeZone || "(empty)"} is not a supported IANA time zone.`, uid });
    return null;
  }
  let start: Date;
  let end: Date;
  try {
    start = timeToDate(details.startDate, timeZone);
    end = timeToDate(details.endDate, timeZone);
  } catch (error) {
    diagnostics.push({ severity: "error", code: "invalid_time", message: error instanceof Error ? error.message : String(error), uid });
    return null;
  }
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    diagnostics.push({ severity: "error", code: "invalid_range", message: "VEVENT must have a finite end after its start.", uid });
    return null;
  }
  const title = boundedText(textValue(component.getFirstPropertyValue("summary")).trim() || "Untitled event", ICS_IMPORT_LIMITS.titleBytes, "title", uid, diagnostics);
  const notes = boundedText(textValue(component.getFirstPropertyValue("description")), ICS_IMPORT_LIMITS.notesBytes, "notes", uid, diagnostics);
  const location = boundedText(textValue(component.getFirstPropertyValue("location")), ICS_IMPORT_LIMITS.locationBytes, "location", uid, diagnostics);
  if (byteLength(title) > ICS_IMPORT_LIMITS.titleBytes || byteLength(notes) > ICS_IMPORT_LIMITS.notesBytes || byteLength(location) > ICS_IMPORT_LIMITS.locationBytes) return null;
  const status = textValue(component.getFirstPropertyValue("status")).toUpperCase();
  const transparency = textValue(component.getFirstPropertyValue("transp")).toUpperCase();
  return {
    recurrenceKey: details.recurrenceId.toString(),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    allDay: details.startDate.isDate,
    timeZone,
    title,
    notes,
    location,
    availability: transparency === "TRANSPARENT" ? "free" : "busy",
    status: status === "CANCELLED" ? "cancelled" : "normal",
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalSeries(uid: string, sequence: number, occurrences: IcsImportOccurrence[]): string {
  return JSON.stringify({ uid, sequence, occurrences: [...occurrences].sort((left, right) => left.recurrenceKey.localeCompare(right.recurrenceKey)) });
}

export async function parseIcsImport(text: string, options: { defaultTimeZone: string }): Promise<IcsImportParseResult> {
  const bytes = byteLength(text);
  const lines = text.split(/\r\n|\n|\r/gu).length;
  if (bytes > ICS_IMPORT_LIMITS.bytes) throw new Error(`iCalendar file exceeds ${ICS_IMPORT_LIMITS.bytes.toLocaleString()} bytes.`);
  if (lines > ICS_IMPORT_LIMITS.lines) throw new Error(`iCalendar file exceeds ${ICS_IMPORT_LIMITS.lines.toLocaleString()} lines.`);
  if (text.includes("\0") || text.includes("\uFFFD")) throw new Error("iCalendar text contains invalid or replacement characters.");
  if (!isValidTimeZone(options.defaultTimeZone)) throw new Error("A valid IANA default time zone is required for floating times.");

  let root: InstanceType<typeof ICAL.Component>;
  try {
    root = new ICAL.Component(ICAL.parse(text));
  } catch (error) {
    throw new Error(`Invalid iCalendar syntax: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (root.name !== "vcalendar") throw new Error("The file must contain one VCALENDAR component.");
  const counts = countTree(root);
  if (counts.components > ICS_IMPORT_LIMITS.components) throw new Error(`iCalendar file exceeds ${ICS_IMPORT_LIMITS.components.toLocaleString()} components.`);
  if (counts.properties > ICS_IMPORT_LIMITS.properties) throw new Error(`iCalendar file exceeds ${ICS_IMPORT_LIMITS.properties.toLocaleString()} properties.`);

  const diagnostics: IcsImportDiagnostic[] = [];
  if (root.hasProperty("method")) diagnostics.push({ severity: "error", code: "unsupported_method", message: "Scheduling METHOD files are not imported; remove METHOD and review the events as plain calendar data." });
  const groups = new Map<string, EventGroup>();
  const eventComponents = root.getAllSubcomponents("vevent");
  for (let index = 0; index < eventComponents.length; index += 1) {
    const component = eventComponents[index]!;
    const uid = textValue(component.getFirstPropertyValue("uid")).trim();
    if (!uid || byteLength(uid) > ICS_IMPORT_LIMITS.uidBytes) {
      diagnostics.push({ severity: "error", code: "invalid_uid", message: `VEVENT UID is required and limited to ${ICS_IMPORT_LIMITS.uidBytes} bytes.`, component: index });
      continue;
    }
    if (!component.hasProperty("dtstart")) { diagnostics.push({ severity: "error", code: "missing_dtstart", message: "VEVENT DTSTART is required. This event was not imported.", uid, component: index }); continue; }
    if (!validateEventSurface(component, uid, index, diagnostics)) continue;
    const group = groups.get(uid) ?? { uid, master: null, exceptions: [], component: index };
    if (component.hasProperty("recurrence-id")) group.exceptions.push(component);
    else if (group.master) diagnostics.push({ severity: "error", code: "duplicate_master", message: "Multiple master VEVENTs use the same UID.", uid, component: index });
    else group.master = component;
    groups.set(uid, group);
  }
  if (groups.size > ICS_IMPORT_LIMITS.series) throw new Error(`Import exceeds ${ICS_IMPORT_LIMITS.series} event series.`);

  const parsed: IcsImportSeries[] = [];
  let occurrenceCount = 0;
  for (const group of groups.values()) {
    if (!group.master) {
      diagnostics.push({ severity: "error", code: "orphan_exception", message: "A RECURRENCE-ID exception has no master VEVENT.", uid: group.uid, component: group.component });
      continue;
    }
    const event = new ICAL.Event(group.master, { exceptions: group.exceptions, strictExceptions: true });
    const sequence = Number(event.sequence || 0);
    if (!Number.isSafeInteger(sequence) || sequence < 0) {
      diagnostics.push({ severity: "error", code: "invalid_sequence", message: "SEQUENCE must be a non-negative safe integer.", uid: group.uid, component: group.component });
      continue;
    }
    const fallbackZone = timeZoneFor(group.master, options.defaultTimeZone);
    const occurrences: IcsImportOccurrence[] = [];
    const seen = new Set<string>();
    try {
      // ical.js iterates explicit RDATE values but omits DTSTART when no RRULE
      // exists. RFC 5545 still includes DTSTART in the recurrence set.
      if (!group.master.hasProperty("rrule") && group.master.hasProperty("rdate")) {
        const excluded = new Set(group.master.getAllProperties("exdate").flatMap((property) => property.getValues()).map((value) => textValue(value)));
        if (!excluded.has(event.startDate.toString())) {
          const initial = occurrenceFrom(event.getOccurrenceDetails(event.startDate), fallbackZone, group.uid, diagnostics);
          if (initial) { occurrences.push(initial); seen.add(initial.recurrenceKey); occurrenceCount += 1; }
        }
      }
      const iterator = event.iterator();
      while (true) {
        const next = iterator.next();
        if (!next) break;
        if (occurrences.length >= ICS_IMPORT_LIMITS.occurrences || occurrenceCount >= ICS_IMPORT_LIMITS.occurrences) {
          throw new Error(`Recurrence expansion exceeds ${ICS_IMPORT_LIMITS.occurrences.toLocaleString()} occurrences.`);
        }
        const details = event.getOccurrenceDetails(next);
        const occurrence = occurrenceFrom(details, fallbackZone, group.uid, diagnostics);
        if (!occurrence || seen.has(occurrence.recurrenceKey)) continue;
        seen.add(occurrence.recurrenceKey);
        occurrences.push(occurrence);
        occurrenceCount += 1;
        if (!event.isRecurring()) break;
      }
    } catch (error) {
      diagnostics.push({ severity: "error", code: "recurrence_error", message: error instanceof Error ? error.message : String(error), uid: group.uid, component: group.component });
      continue;
    }
    if (!occurrences.length) continue;
    occurrences.sort((left, right) => left.startIso.localeCompare(right.startIso) || left.recurrenceKey.localeCompare(right.recurrenceKey));
    parsed.push({ uid: group.uid, sequence, contentDigest: await sha256(canonicalSeries(group.uid, sequence, occurrences)), occurrences });
  }
  parsed.sort((left, right) => left.uid.localeCompare(right.uid));
  return {
    sourceNamespace: sourceNamespace(root),
    calendarName: textValue(root.getFirstPropertyValue("x-wr-calname")).trim() || "Imported calendar",
    byteLength: bytes,
    lineCount: lines,
    componentCount: counts.components,
    propertyCount: counts.properties,
    series: root.hasProperty("method") ? [] : parsed,
    diagnostics,
  };
}
