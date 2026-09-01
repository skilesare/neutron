import { expect, test } from "bun:test";
import {
  listExposedTools,
  validateToolArguments,
  validateToolResult,
  type JsonObject,
  type JsonValue,
  type MsgBusToolContext,
} from "neutron-tools/app";
import { calendarToolHandlers } from "../src/service";
import { decodeCalendarSearchWire } from "../src/search_wire";

type ScriptedCall = { name: string; args: JsonObject };

class FakeCalendarModel {
  plan(prompt: string): ScriptedCall[] {
    if (prompt === "Add design review tomorrow at 9 for one hour") return [{ name: "create_event", args: { title: "Design review", start: "2026-09-01T09:00:00-05:00", end: "2026-09-01T10:00:00-05:00", timeZone: "America/Chicago" } }];
    if (prompt === "Find my design review") return [{ name: "search_events", args: { query: "design review", limit: 10 } }];
    if (prompt === "Reconcile the interrupted write") return [{ name: "status", args: {} }, { name: "search_events", args: { query: "launch webcast", limit: 10 } }];
    throw new Error(`No deterministic plan for: ${prompt}`);
  }
}

function qualificationContext(options: { dropAfterCreate?: boolean } = {}) {
  let revision = 4;
  let nextSeries = 20;
  const events: JsonObject[] = [];
  let createDispatches = 0;
  const context: MsgBusToolContext = {
    reportProgress: () => undefined,
    kernel: {
      querySelf: async (method, args) => {
        if (method === "calendar_preferences_get") return { revision: String(revision), display_time_zone: "America/Chicago", slot_increment_minutes: 15, buffer_before_minutes: 0, buffer_after_minutes: 0 };
        if (method === "calendar_status") return { revision: String(revision), event_count: String(events.length) };
        if (method === "calendar_search_v1") {
          const query = decodeCalendarSearchWire(String(args?.[0] ?? ""))[0]!.toLowerCase();
          return { ok: { revision: String(revision), occurrences: events.filter((event) => String(event.title).toLowerCase().includes(query)), next_offset: [] } };
        }
        throw new Error(`Unexpected qualification query ${method}`);
      },
      updateSelf: async (method, args) => {
        if (method !== "calendar_series_create_v2") throw new Error(`Unexpected qualification update ${method}`);
        createDispatches += 1;
        const request = args?.[0] as JsonObject;
        const value = request.value as JsonObject;
        const occurrenceInput = (value.occurrences as JsonObject[])[0]!;
        const seriesId = String(nextSeries++);
        revision += 1;
        const created = { id: seriesId, revision: "1", title: value.title, notes: value.notes, location: value.location, color: value.color, availability: value.availability, kind: value.kind, time_zone: value.time_zone, recurrence: value.recurrence, source: "owner" };
        events.push({ id: String(100 + events.length), revision: "1", series_id: seriesId, series_revision: "1", recurrence_key: occurrenceInput.recurrence_key, title: value.title, notes: value.notes, location: value.location, start_ns: occurrenceInput.start_ns, end_ns: occurrenceInput.end_ns, availability: value.availability, kind: value.kind, time_zone: value.time_zone, source: "owner", status: "active" });
        if (options.dropAfterCreate) throw new Error("Transport dropped after dispatch");
        return { ok: created };
      },
    },
  };
  return { context, events, createDispatches: () => createDispatches };
}

async function runPlan(model: FakeCalendarModel, prompt: string, context: MsgBusToolContext): Promise<JsonValue[]> {
  const descriptors = new Map(listExposedTools().map((descriptor) => [descriptor.name, descriptor]));
  const results: JsonValue[] = [];
  for (const call of model.plan(prompt)) {
    const descriptor = descriptors.get(call.name);
    if (!descriptor) throw new Error(`Tool ${call.name} is not exposed`);
    validateToolArguments(descriptor, call.args);
    const result = await calendarToolHandlers[call.name]!(call.args, context);
    validateToolResult(descriptor, result);
    results.push(result);
  }
  return results;
}

test("deterministic fake model creates and then finds an authoritative event", async () => {
  const model = new FakeCalendarModel();
  const fixture = qualificationContext();
  const created = await runPlan(model, "Add design review tomorrow at 9 for one hour", fixture.context);
  expect(created[0]).toMatchObject({ committed: true, series: { title: "Design review", timeZone: "America/Chicago" } });
  const found = await runPlan(model, "Find my design review", fixture.context);
  expect(found[0]).toMatchObject({ stale: false, events: [{ title: "Design review", source: "owner" }] });
  expect(fixture.createDispatches()).toBe(1);
});

test("ambiguous write is reconciled by status/search and never retried", async () => {
  const model = new FakeCalendarModel();
  const fixture = qualificationContext({ dropAfterCreate: true });
  await expect(calendarToolHandlers.create_event({ title: "Launch webcast", start: "2026-09-02T14:00:00Z", end: "2026-09-02T15:00:00Z", timeZone: "UTC" }, fixture.context)).rejects.toThrow("Transport dropped after dispatch");
  expect(fixture.createDispatches()).toBe(1);
  const reconciled = await runPlan(model, "Reconcile the interrupted write", fixture.context);
  expect(reconciled[0]).toMatchObject({ revision: "5", eventCount: "1" });
  expect(reconciled[1]).toMatchObject({ events: [{ title: "Launch webcast" }] });
  expect(fixture.createDispatches()).toBe(1);
});

test("Calendar tool contracts prohibit private data in web search and model-visible ICS", () => {
  const descriptors = listExposedTools();
  expect(descriptors.find((item) => item.name === "search_events")?.description).toContain("Do not place private Calendar contents into public web-search queries");
  expect(descriptors.find((item) => item.name === "export_event")?.description).toContain("never puts private iCalendar contents into model text");
});
