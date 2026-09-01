import { expect, test } from "bun:test";
import { readFile, stat } from "node:fs/promises";
import { type NeutronManifest } from "neutron-tools/src/schema.js";
import { validate_neutron_conf } from "neutron-tools/src/validate_schema.js";

const manifestUrl = new URL("../neutron.json", import.meta.url);

test("Calendar 0.3.0 exposes bounded owner, export, search, and scheduling APIs", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8")) as NeutronManifest;
  expect(validate_neutron_conf(manifest).valid).toBe(true);
  expect(manifest).toMatchObject({
    id: "calendar",
    name: "Calendar",
    version: 300,
    update_source: "233tv-xiaaa-aaaay-aacta-cai",
    func: {
      calendar_status: { type: "query", async: false },
      calendar_range_v2: { type: "query", async: false },
      calendar_export_v1: { type: "query", async: false },
      calendar_search_v1: { type: "query", async: false },
      calendar_series_create_v2: { type: "update", async: false },
    },
    memory: {
      calendar: {
        version: 2,
        schemas: { "1": { src: "memory/calendar/v1.mo" }, "2": { src: "memory/calendar/v2.mo" } },
        migrations: [{ from: 1, to: 2, src: "memory/calendar/v1_to_v2.mo" }],
      },
    },
  });
  expect(manifest).not.toHaveProperty("backend.capabilities.certified_assets");
  expect(manifest).not.toHaveProperty("capabilities.certified_assets");
  expect(manifest.memory).not.toHaveProperty("calendar_exports");
  expect(manifest).not.toHaveProperty("init_arg");
  expect(manifest).toMatchObject({ background: { path: "service.html" } });
  const exported = Object.entries(manifest.func).filter(([, value]) => value.type === "internal").map(([name]) => name).sort();
  expect(exported).toEqual(["calendar_availability_v1", "calendar_confirm_v1", "calendar_release_v1", "calendar_reserve_v1"]);
  const migration = await readFile(new URL("../backend/memory/calendar/v1_to_v2.mo", import.meta.url), "utf8");
  expect(migration).toContain('import V1 "./v1"');
  expect(migration).toContain('import V2 "./v2"');
});

test("Calendar tile uses source-bound CRUD and renders all event origins", async () => {
  const frontend = await readFile(new URL("../src/index.tsx", import.meta.url), "utf8");
  expect(frontend).toContain('querySelf<RangePage>("calendar_range_v2"');
  expect(frontend).toContain('"calendar_series_create_v2"');
  expect(frontend).toContain('updateSelf<JsonValue>("calendar_series_remove_v2"');
  expect(frontend).toContain('"calendar_occurrence_update_v2"');
  expect(frontend).toContain('"calendar_occurrence_remove_v2"');
  expect(frontend).toContain('const initialCalendarView = window.matchMedia("(max-width: 700px)").matches ? "listWeek" : "timeGridWeek"');
  expect(frontend).toContain("initialView={initialCalendarView}");
  expect(frontend).toContain("datesSet={showRange}");
  expect(frontend).toContain("height={calendarHeight}");
  expect(frontend).toContain("dateClick={clickDate}");
  expect(frontend).toContain("dayGridMonth,timeGridWeek,timeGridDay,listWeek");
  expect(frontend).toContain("eventDrop={dropEvent}");
  expect(frontend).toContain("eventResize={resizeEvent}");
  expect(frontend).toContain("fc-event--hold");
  expect(frontend).toContain("fc-event--rendezvous");
  expect(frontend).toContain("Tentative Rendezvous hold");
  expect(frontend).toContain("Scheduled through Rendezvous");
  expect(frontend).toContain('type="date"');
  expect(frontend).toContain('Repeat');
  expect(frontend).toContain('This event');
  expect(frontend).toContain('Entire series');
  expect(frontend).toContain('openAppTile({ appId: "rendezvous"');
  expect(frontend).toContain('Find a time with someone');
  expect(frontend).toContain('target: "app:files:background"');
  expect(frontend).toContain('name: "write"');
  expect(frontend).toContain("copyToClipboard(preparedExport.contents)");
  expect(frontend).toContain('openAppTile({ appId: "files"');
  const service = await readFile(new URL("../src/service.ts", import.meta.url), "utf8");
  expect(service).toContain('registerTool("status"');
  expect(service).toContain("exposeTool(name, options, handler)");
  expect(service).toContain('registerTool("create_event"');
  expect(service).toContain('context.kernel.updateSelf<JsonValue>');
});

test("Calendar bundles the Neutron design system", async () => {
  const css = await readFile(new URL("../dist/web/main.css", import.meta.url), "utf8");
  expect(css).toContain(".nt-app");
  expect(css).toContain("--nt-bg-panel");
});

test("Calendar bundles only MIT FullCalendar standard views and fits the portal package limit", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as { dependencies: Record<string, string> };
  expect(packageJson.dependencies).toMatchObject({
    "@fullcalendar/core": "6.1.21",
    "@fullcalendar/daygrid": "6.1.21",
    "@fullcalendar/interaction": "6.1.21",
    "@fullcalendar/list": "6.1.21",
    "@fullcalendar/react": "6.1.21",
    "@fullcalendar/timegrid": "6.1.21",
  });
  expect(Object.keys(packageJson.dependencies).some((name) => name.includes("resource") || name.includes("premium"))).toBe(false);
  const notice = await readFile(new URL("../dist/web/THIRD_PARTY_NOTICES.txt", import.meta.url), "utf8");
  expect(notice).toContain("SPDX-License-Identifier: MIT");
  const archive = await stat(new URL("../calendar.v0.3.0.neutron", import.meta.url));
  expect(archive.size).toBeLessThanOrEqual(1_900_000);
});
