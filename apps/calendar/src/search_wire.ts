export type CalendarSearchWireRequest = {
  queryText: string;
  startNs: string | null;
  endNs: string | null;
  source: string | null;
  availability: "busy" | "free" | null;
  status: string | null;
  recurring: boolean | null;
  expectedRevision: string | null;
  offset: string;
  limit: string;
};

const textEncoder = new TextEncoder();
const field = (value: string | null): string => [...textEncoder.encode(value ?? "")].map((byte) => byte.toString(16).padStart(2, "0")).join("");

/** Unicode-safe, separator-free wire format for the generic self-call bridge. */
export function encodeCalendarSearchWire(request: CalendarSearchWireRequest): string {
  return [
    request.queryText,
    request.startNs,
    request.endNs,
    request.source,
    request.availability,
    request.status,
    request.recurring === null ? null : request.recurring ? "true" : "false",
    request.expectedRevision,
    request.offset,
    request.limit,
  ].map(field).join("|");
}

export function decodeCalendarSearchWire(wire: string): string[] {
  const fields = wire.split("|");
  if (fields.length !== 10 || fields.some((value) => value.length % 2 !== 0 || !/^[0-9a-f]*$/u.test(value))) throw new Error("Invalid Calendar search wire fields.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  return fields.map((value) => decoder.decode(Uint8Array.from(value.match(/../gu) ?? [], (pair) => Number.parseInt(pair, 16))));
}
