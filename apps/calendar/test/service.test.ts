import { expect, test } from "bun:test";
import { listExposedTools, type JsonValue, type MsgBusToolContext } from "neutron-tools/app";
import { calendarToolHandlers } from "../src/service";

const tools = listExposedTools();

test("Calendar exposes the complete bounded semantic tool surface", () => {
  expect(tools.map((tool) => tool.name).sort()).toEqual(["commit_ics_import", "create_event", "delete_event", "export_event", "find_free_time", "get_event", "ics_import_status", "list_schedule", "preview_ics_import", "reminder_snapshot", "search_events", "status", "undo_ics_import", "update_event"]);
  for (const tool of tools) {
    expect(tool.inputSchema).toMatchObject({ type: "object", additionalProperties: false });
    expect(tool.outputSchema).toBeDefined();
  }
});

test("Calendar tools declare conservative read and write effects", () => {
  const effects = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations?.["neutron:effects"]]));
  expect(effects).toMatchObject({ status: ["read"], search_events: ["read"], get_event: ["read"], list_schedule: ["read"], find_free_time: ["read"], export_event: ["read"], preview_ics_import: ["read"], ics_import_status: ["read"], create_event: ["write"], update_event: ["write"], delete_event: ["write"], commit_ics_import: ["write"], undo_ics_import: ["write"] });
});

test("write descriptions require reconciliation and web search keeps Calendar private", () => {
  for (const name of ["create_event", "update_event", "delete_event", "commit_ics_import"]) {
    const description = tools.find((tool) => tool.name === name)?.description ?? "";
    expect(description.toLowerCase()).toMatch(/reconcil|read|search/);
    expect(description.toLowerCase()).toContain("retry");
  }
  expect(tools.find((tool) => tool.name === "search_events")?.description).toContain("private Calendar contents");
  expect(tools.find((tool) => tool.name === "export_event")?.description).toContain("never puts private iCalendar contents into model text");
  expect(tools.find((tool) => tool.name === "preview_ics_import")?.annotations?.["neutron:attachments"]).toMatchObject({ version: 1, input: { mediaTypes: ["text/calendar", "application/octet-stream"], maxBytes: 1_048_576 } });
});

type Call = { kind: "query" | "update"; method: string; args: JsonValue[] | undefined };

function fakeContext(respond: (call: Call) => JsonValue): { context: MsgBusToolContext; calls: Call[] } {
  const calls: Call[] = [];
  const invoke = async (kind: Call["kind"], method: string, args?: JsonValue[]): Promise<JsonValue> => {
    const call = { kind, method, args };
    calls.push(call);
    return respond(call);
  };
  return {
    calls,
    context: {
      reportProgress: () => undefined,
      kernel: {
        querySelf: (method, args) => invoke("query", method, args),
        updateSelf: (method, args) => invoke("update", method, args),
      },
    },
  };
}

const series = {
  id: "7", revision: "3", title: "Planning", notes: "Private", location: "Room 2", color: "sage",
  availability: { busy: null }, kind: { timed: null }, time_zone: "America/Chicago", recurrence: [], source: "owner",
};
const occurrence = {
  id: "11", revision: "2", series_id: "7", series_revision: "3", recurrence_key: "one-time",
  title: "Planning", notes: "Private", location: "Room 2", start_ns: "1788282000000000000", end_ns: "1788285600000000000",
  availability: { busy: null }, kind: { timed: null }, time_zone: "America/Chicago", source: "owner", status: "active",
};

test("semantic reads use only scoped querySelf calls and normalize bounded results", async () => {
  const { context, calls } = fakeContext((call) => {
    if (call.method === "calendar_status") return { revision: "9", event_count: "1" };
    if (call.method === "calendar_preferences_get") return { revision: "9", display_time_zone: "America/Chicago", slot_increment_minutes: 30, buffer_before_minutes: 10, buffer_after_minutes: 20 };
    if (call.method === "calendar_search_v1") return { ok: { revision: "9", occurrences: [occurrence], next_offset: [] } };
    throw new Error(`Unexpected ${call.method}`);
  });
  expect(await calendarToolHandlers.status({}, context)).toMatchObject({ revision: "9", timeZone: "America/Chicago", eventCount: "1" });
  expect(await calendarToolHandlers.search_events({ query: "plan", limit: 10 }, context)).toMatchObject({ stale: false, revision: "9", events: [{ id: "11", seriesId: "7", timeZone: "America/Chicago" }], nextOffset: null });
  expect(calls.every((call) => call.kind === "query")).toBe(true);
  expect(calls.map((call) => call.method)).toEqual(["calendar_status", "calendar_preferences_get", "calendar_search_v1"]);
});

test("free-time results are privacy-minimal and explicitly continuable", async () => {
  const { context, calls } = fakeContext(() => ({ revision: "9", available_starts_ns: ["1788282000000000000"] }));
  const result = await calendarToolHandlers.find_free_time({ start: "2026-09-01T09:00:00-05:00", end: "2026-09-02T09:00:00-05:00", durationMinutes: 30, stepMinutes: 15, limit: 4 }, context);
  expect(result).toMatchObject({ revision: "9", durationMinutes: 30, starts: ["2026-09-01T17:00:00.000Z"] });
  expect((result as { nextStart: string | null }).nextStart).not.toBeNull();
  expect(calls).toHaveLength(1);
  expect(calls[0]?.method).toBe("calendar_find_free_v1");
  expect(JSON.stringify(calls[0]?.args)).not.toContain("Planning");
});

test("create_event performs one revision-guarded scoped mutation", async () => {
  const { context, calls } = fakeContext((call) => call.method === "calendar_preferences_get"
    ? { revision: "9", display_time_zone: "America/Chicago", slot_increment_minutes: 15, buffer_before_minutes: 0, buffer_after_minutes: 0 }
    : { ok: series });
  const result = await calendarToolHandlers.create_event({ title: "Planning", start: "2026-09-01T09:00:00-05:00", end: "2026-09-01T10:00:00-05:00" }, context);
  expect(result).toMatchObject({ committed: true, series: { id: "7", recurring: false } });
  expect(calls.map((call) => [call.kind, call.method])).toEqual([["query", "calendar_preferences_get"], ["update", "calendar_series_create_v2"]]);
  expect(calls[1]?.args?.[0]).toMatchObject({ expected_revision: "9", value: { title: "Planning", time_zone: "America/Chicago" } });
});

test("series updates reject occurrence times before any authoritative call", async () => {
  const { context, calls } = fakeContext(() => { throw new Error("must not call"); });
  await expect(calendarToolHandlers.update_event({ scope: "series", seriesId: "7", expectedRevision: "3", start: "2026-09-01T09:00:00Z" }, context)).rejects.toThrow("start and end apply only");
  expect(calls).toHaveLength(0);
});

test("delete_event dispatches the exact revision-guarded scoped mutation", async () => {
  const { context, calls } = fakeContext(() => ({ ok: { revision: "10" } }));
  expect(await calendarToolHandlers.delete_event({ scope: "occurrence", seriesId: "7", occurrenceId: "11", expectedRevision: "2" }, context)).toMatchObject({ committed: true, revision: "10" });
  expect(calls).toEqual([{ kind: "update", method: "calendar_occurrence_remove_v2", args: [{ occurrence_id: "11", expected_occurrence_revision: "2" }] }]);
});
