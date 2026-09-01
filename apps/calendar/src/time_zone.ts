export type WallParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

export type ZonedResolution = {
  date: Date;
  normalizedValue: string;
  gap: boolean;
  fold: boolean;
};

const editorPattern = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/u;
const formatterCache = new Map<string, Intl.DateTimeFormat>();
const pad = (value: number, length = 2) => String(value).padStart(length, "0");

function formatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const next = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  formatterCache.set(timeZone, next);
  return next;
}

export function isValidTimeZone(value: string): boolean {
  if (!value || value.length > 64) return false;
  try {
    formatter(value).format(0);
    return true;
  } catch {
    return false;
  }
}

export function supportedTimeZones(fallback: string): string[] {
  const valuesOf = (Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  }).supportedValuesOf;
  const values = typeof valuesOf === "function" ? valuesOf("timeZone") : [];
  const zones = new Set(["UTC", fallback, ...values].filter(isValidTimeZone));
  return [...zones].sort((left, right) => left.localeCompare(right));
}

export function parseEditorParts(value: string, allDay = false): WallParts | null {
  const match = editorPattern.exec(value);
  if (!match) return null;
  const parts: WallParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: allDay ? 0 : Number(match[4] ?? 0),
    minute: allDay ? 0 : Number(match[5] ?? 0),
    second: allDay ? 0 : Number(match[6] ?? 0),
    millisecond: 0,
  };
  const marker = new Date(wallStamp(parts));
  if (
    marker.getUTCFullYear() !== parts.year ||
    marker.getUTCMonth() + 1 !== parts.month ||
    marker.getUTCDate() !== parts.day ||
    marker.getUTCHours() !== parts.hour ||
    marker.getUTCMinutes() !== parts.minute ||
    marker.getUTCSeconds() !== parts.second
  ) return null;
  if (!allDay && (match[4] === undefined || match[5] === undefined)) return null;
  return parts;
}

export function formatWallParts(parts: WallParts, allDay = false): string {
  const date = `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
  return allDay ? date : `${date}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function wallPartsAt(date: Date, timeZone: string): WallParts {
  const values: Record<string, number> = {};
  for (const item of formatter(timeZone).formatToParts(date)) {
    if (item.type !== "literal") values[item.type] = Number(item.value);
  }
  return {
    year: values.year!,
    month: values.month!,
    day: values.day!,
    hour: values.hour!,
    minute: values.minute!,
    second: values.second!,
    millisecond: date.getUTCMilliseconds(),
  };
}

export function formatInstantForEditor(date: Date, timeZone: string, allDay = false): string {
  return formatWallParts(wallPartsAt(date, timeZone), allDay);
}

export function resolveZonedEditorValue(value: string, timeZone: string, allDay = false): ZonedResolution {
  if (!isValidTimeZone(timeZone)) throw new Error("Choose a valid IANA time zone.");
  const target = parseEditorParts(value, allDay);
  if (!target) throw new Error(allDay ? "Choose a valid date." : "Choose a valid local date and time.");
  const targetStamp = wallStamp(target);
  const offsets = new Set<number>();
  for (const delta of [-36, -12, 0, 12, 36]) {
    const sample = new Date(targetStamp + delta * 3_600_000);
    offsets.add(wallStamp(wallPartsAt(sample, timeZone)) - Math.floor(sample.getTime() / 1_000) * 1_000);
  }
  const candidates = [...offsets].map((offset) => new Date(targetStamp - offset));
  const exact = candidates
    .filter((candidate) => equalWall(wallPartsAt(candidate, timeZone), target))
    .sort((left, right) => left.getTime() - right.getTime());
  if (exact.length > 0) {
    return {
      date: exact[0]!,
      normalizedValue: formatInstantForEditor(exact[0]!, timeZone, allDay),
      gap: false,
      fold: exact.length > 1,
    };
  }

  const normalized = candidates
    .map((candidate) => ({ candidate, delta: wallStamp(wallPartsAt(candidate, timeZone)) - targetStamp }))
    .filter((item) => item.delta > 0)
    .sort((left, right) => left.delta - right.delta || left.candidate.getTime() - right.candidate.getTime())[0];
  if (!normalized) throw new Error("That local time cannot be resolved in the selected time zone.");
  return {
    date: normalized.candidate,
    normalizedValue: formatInstantForEditor(normalized.candidate, timeZone, allDay),
    gap: true,
    fold: false,
  };
}

export function instantToCalendarMarker(date: Date, timeZone: string): Date {
  return new Date(wallStamp(wallPartsAt(date, timeZone)));
}

export function calendarMarkerToEditorValue(marker: Date, allDay = false): string {
  return formatWallParts({
    year: marker.getUTCFullYear(),
    month: marker.getUTCMonth() + 1,
    day: marker.getUTCDate(),
    hour: marker.getUTCHours(),
    minute: marker.getUTCMinutes(),
    second: marker.getUTCSeconds(),
    millisecond: marker.getUTCMilliseconds(),
  }, allDay);
}

export function calendarMarkerToInstant(marker: Date, timeZone: string, allDay = false): ZonedResolution {
  return resolveZonedEditorValue(calendarMarkerToEditorValue(marker, allDay), timeZone, allDay);
}

function wallStamp(parts: WallParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond);
}

function equalWall(left: WallParts, right: WallParts): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day &&
    left.hour === right.hour && left.minute === right.minute && left.second === right.second;
}
