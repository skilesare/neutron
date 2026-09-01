import { formatInstantForEditor } from "./time_zone";

export type IcsEvent = {
  seriesId: string;
  occurrenceId: string;
  recurrenceKey: string;
  seriesRevision: string;
  occurrenceRevision: string;
  updatedAt: Date;
  start: Date;
  end: Date;
  title: string;
  notes: string;
  location: string;
  availability: "busy" | "free";
  allDay: boolean;
  timeZone: string;
  status: string;
  source: string;
};

export type IcsOptions = {
  calendarId: string;
  calendarName: string;
  includeDetails: boolean;
  includeHolds?: boolean;
  includeCancelled?: boolean;
};

const encoder = new TextEncoder();
const pad = (value: number) => String(value).padStart(2, "0");

export function escapeIcsText(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/\r\n|\r|\n/gu, "\\n").replace(/,/gu, "\\,").replace(/;/gu, "\\;");
}

export function foldIcsLine(line: string): string {
  const output: string[] = [];
  let current = "";
  let bytes = 0;
  let capacity = 75;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes > 0 && bytes + size > capacity) {
      output.push(current);
      current = ` ${character}`;
      bytes = 1 + size;
      capacity = 75;
    } else {
      current += character;
      bytes += size;
    }
  }
  output.push(current);
  return output.join("\r\n");
}

const utcDateTime = (date: Date) => `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
const localDate = (date: Date, timeZone: string) => formatInstantForEditor(date, timeZone, true).replaceAll("-", "");
const safeUidPart = (value: string) => encodeURIComponent(value).replaceAll("%", "-");

export function stableEventUid(event: Pick<IcsEvent, "seriesId" | "recurrenceKey">, calendarId: string): string {
  return `${safeUidPart(event.seriesId)}-${safeUidPart(event.recurrenceKey)}@${safeUidPart(calendarId)}`;
}

function eventLines(event: IcsEvent, options: IcsOptions): string[] {
  const title = options.includeDetails ? event.title : "Busy";
  const sequence = Math.max(Number(event.seriesRevision), Number(event.occurrenceRevision));
  const lines = [
    "BEGIN:VEVENT",
    `UID:${stableEventUid(event, options.calendarId)}`,
    `DTSTAMP:${utcDateTime(event.updatedAt)}`,
    `SEQUENCE:${Number.isSafeInteger(sequence) ? sequence : 0}`,
  ];
  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${localDate(event.start, event.timeZone)}`);
    lines.push(`DTEND;VALUE=DATE:${localDate(event.end, event.timeZone)}`);
  } else {
    lines.push(`DTSTART:${utcDateTime(event.start)}`);
    lines.push(`DTEND:${utcDateTime(event.end)}`);
  }
  lines.push(`SUMMARY:${escapeIcsText(title)}`);
  if (options.includeDetails && event.notes) lines.push(`DESCRIPTION:${escapeIcsText(event.notes)}`);
  if (options.includeDetails && event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  lines.push(`TRANSP:${event.availability === "free" ? "TRANSPARENT" : "OPAQUE"}`);
  lines.push("CLASS:PRIVATE");
  if (event.status === "cancelled") lines.push("STATUS:CANCELLED");
  else if (event.status === "hold") lines.push("STATUS:TENTATIVE");
  else lines.push("STATUS:CONFIRMED");
  lines.push("END:VEVENT");
  return lines;
}

export function serializeIcs(events: IcsEvent[], options: IcsOptions): string {
  const selected = events.filter((event) => (options.includeHolds || event.status !== "hold") && (options.includeCancelled || event.status !== "cancelled"));
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Neutron//Calendar//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcsText(options.calendarName)}`,
    ...selected.flatMap((event) => eventLines(event, options)),
    "END:VCALENDAR",
  ];
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function safeIcsFilename(value: string): string {
  const stem = value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/^[.-]+|[.-]+$/gu, "").slice(0, 80) || "calendar";
  return `${stem}.ics`;
}

export function downloadIcs(contents: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = safeIcsFilename(filename.replace(/\.ics$/iu, ""));
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
