import { resolve } from "node:path";
import { Principal } from "@dfinity/principal";
import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { createKernelActor, localIdentityFromSeed } from "../../packages/neutron-provision/src/kernel.ts";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { signInWithLocalInternetIdentity } from "./local-ii.ts";

const configPath = process.env.NEUTRON_NDEPLOY_CONFIG ?? "calendar-upgrade-local.ndeploy.json";
const candidateArchive = resolve(process.env.CALENDAR_UPGRADE_ARCHIVE ?? "apps/calendar/calendar.v0.5.0.neutron");

test("Calendar 0.2.0 state survives the reviewed in-product 0.5.0 update", async ({ browser }) => {
  test.setTimeout(360_000);
  const runtime = resolveLocalNeutronRuntime({ configPath });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "America/Chicago" });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  let principal: string | undefined;
  try {
    await context.credentials.install();
    await page.goto(localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl));
    await signInWithLocalInternetIdentity({ page, context, loginSelector: '[data-tid="login-button"]', localHost: runtime.gatewayUrl });
    const principalNode = page.locator('[data-tid="principal"]');
    await expect(principalNode).toBeVisible();
    principal = (await principalNode.textContent())?.trim();
    if (!principal) throw new Error("Internet Identity did not return a principal");
    const actor = await developerActor(runtime);
    await actor.kernel_authorized_recover(Principal.fromText(principal));
    await page.reload({ waitUntil: "domcontentloaded" });

    const beforeRuntime = await actor.kernel_runtime_info();
    const beforeCalendar = beforeRuntime.apps.find((app) => app.scope.app_id === "calendar");
    expect(Number(beforeCalendar?.version)).toBe(200);
    const beforeMemory = beforeRuntime.memories.find((memory) => memory.id === "calendar");
    expect(Number(beforeMemory?.version)).toBe(2);

    const calendar = await openCalendar(page);
    const timedStart = nextWeekday(1, 9, 15);
    await addEvent(calendar, "Upgrade timed", timedStart, minutesAfter(timedStart, 75), { location: "Room 0.2", notes: "Preserve exact details" });
    const recurringStart = nextWeekday(2, 11, 0);
    await addEvent(calendar, "Upgrade recurring", recurringStart, minutesAfter(recurringStart, 30), { availability: "free", repeat: "weekly", count: 3 });
    await overrideFirstOccurrence(calendar, "Upgrade recurring", "Upgrade exception");
    const allDayStart = nextWeekday(3, 0, 0);
    await addEvent(calendar, "Upgrade all day", allDayStart, minutesAfter(allDayStart, 24 * 60), { allDay: true });

    const beforeEvents = await upcomingSnapshot(calendar);
    expect(beforeEvents.filter((event) => event.title.includes("Upgrade recurring"))).toHaveLength(2);
    expect(beforeEvents.filter((event) => event.title.includes("Upgrade exception"))).toHaveLength(1);
    expect(beforeEvents.some((event) => event.title.includes("Upgrade timed"))).toBe(true);
    expect(beforeEvents.some((event) => event.title.includes("Upgrade all day"))).toBe(true);

    await uploadCandidate(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    const afterRuntime = await actor.kernel_runtime_info();
    const afterCalendar = afterRuntime.apps.find((app) => app.scope.app_id === "calendar");
    expect(Number(afterCalendar?.version)).toBe(500);
    const afterCalendarMemory = afterRuntime.memories.find((memory) => memory.id === "calendar");
    expect(Number(afterCalendarMemory?.version)).toBe(4);
    expect(String(afterCalendar?.scope.installation_uid)).toBe(String(beforeCalendar?.scope.installation_uid));
    const beforeMemories = beforeRuntime.memories.filter((memory) => memory.id !== "calendar").map(memoryIdentity);
    const afterMemories = afterRuntime.memories.filter((memory) => memory.id !== "calendar").map(memoryIdentity);
    expect(afterMemories).toEqual(expect.arrayContaining(beforeMemories));
    expect(afterRuntime.memories).toHaveLength(beforeRuntime.memories.length);
    expect(String(afterCalendarMemory?.owner)).toBe(String(beforeMemory?.owner));
    expect(String(afterCalendarMemory?.schema)).not.toBe(String(beforeMemory?.schema));

    const upgraded = await openCalendar(page);
    await expect(upgraded.getByRole("heading", { name: "Export iCalendar" })).toBeVisible();
    const afterEvents = await upcomingSnapshot(upgraded);
    expect(afterEvents).toEqual(beforeEvents);
    await openSearchResult(upgraded, "Upgrade timed");
    await expect(upgraded.getByLabel("Location", { exact: true })).toHaveValue("Room 0.2");
    await expect(upgraded.locator(".editor textarea").first()).toHaveValue("Preserve exact details");
    await openSearchResult(upgraded, "Upgrade recurring");
    await upgraded.getByLabel("Entire series").check();
    await expect(upgraded.locator(".recurrence-editor select").first()).toHaveValue("weekly");
    await expect(upgraded.locator(".nt-panel.editor").first().locator("select").first()).toHaveValue("free");
    await openSearchResult(upgraded, "Upgrade exception");
    await expect(upgraded.getByLabel("This event")).toBeChecked();
    await openSearchResult(upgraded, "Upgrade all day");
    await expect(upgraded.locator(".nt-panel.editor").first().locator('input[type="checkbox"]').first()).toBeChecked();
  } finally {
    if (principal) {
      const actor = await developerActor(runtime);
      await actor.kernel_authorized_rem(Principal.fromText(principal));
    }
    await context.close();
  }
});

type Runtime = ReturnType<typeof resolveLocalNeutronRuntime>;
type EventSnapshot = { title: string; instant: string | null };

function developerActor(runtime: Runtime) {
  return createKernelActor({ canisterId: runtime.canisterId, host: runtime.gatewayUrl, identity: localIdentityFromSeed(runtime.developerIdentitySeed), fetchRootKey: true });
}

function memoryIdentity(memory: { id: string; owner: string; version: bigint | number; schema: string }) {
  return { id: memory.id, owner: memory.owner, version: String(memory.version), schema: memory.schema };
}

async function openCalendar(page: Page): Promise<FrameLocator> {
  await expect(page.locator('[data-tid="launcher-open"]')).toBeVisible({ timeout: 60_000 });
  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator('[data-tid="launcher-tile-calendar-main"]').click();
  const frame = page.frameLocator('[data-app-id="calendar"][data-tile-id="main"]').last();
  await expect(frame.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(frame.getByText("Loading your calendar…")).toHaveCount(0, { timeout: 60_000 });
  return frame;
}

async function addEvent(calendar: FrameLocator, title: string, start: Date, end: Date, options: { location?: string; notes?: string; availability?: "busy" | "free"; repeat?: "weekly"; count?: number; allDay?: boolean } = {}) {
  const newButton = calendar.getByRole("button", { name: "New", exact: true });
  if (await newButton.count()) await newButton.click();
  await calendar.getByLabel("Title", { exact: true }).fill(title);
  if (options.allDay) await calendar.getByLabel("All-day event").check();
  if (options.allDay) {
    await calendar.locator('.editor input[type="date"]').nth(0).fill(dateInput(start));
    await calendar.locator('.editor input[type="date"]').nth(1).fill(dateInput(end));
  } else {
    await calendar.getByLabel("Starts", { exact: true }).fill(localInput(start));
    await calendar.getByLabel("Ends", { exact: true }).fill(localInput(end));
  }
  if (options.location) await calendar.getByLabel("Location", { exact: true }).fill(options.location);
  if (options.notes) await calendar.getByLabel("Notes", { exact: true }).fill(options.notes);
  if (options.availability) await calendar.locator(".editor select").first().selectOption({ index: options.availability === "free" ? 1 : 0 }, { timeout: 15_000 });
  if (options.repeat) {
    await calendar.locator(".recurrence-editor select").first().selectOption({ label: "Weekly" }, { timeout: 15_000 });
    await calendar.getByLabel("Occurrences").fill(String(options.count ?? 3));
  }
  await calendar.getByRole("button", { name: "Add to calendar" }).click();
  await expect(calendar.getByLabel("Title", { exact: true })).toHaveValue("", { timeout: 60_000 });
  await expect(calendar.locator(".upcoming button").filter({ hasText: title }).first()).toBeVisible({ timeout: 60_000 });
}

async function upcomingSnapshot(calendar: FrameLocator): Promise<EventSnapshot[]> {
  return calendar.locator(".upcoming li").evaluateAll((items) => items.map((item) => ({
    title: item.querySelector("span")?.textContent?.trim() ?? "",
    instant: item.querySelector("time")?.getAttribute("datetime") ?? null,
  })).filter((event) => event.title.startsWith("Upgrade ")));
}

async function overrideFirstOccurrence(calendar: FrameLocator, originalTitle: string, overrideTitle: string) {
  const occurrence = calendar.locator(".upcoming button").filter({ hasText: originalTitle }).first();
  await expect(occurrence).toBeVisible({ timeout: 60_000 });
  await occurrence.click();
  await expect(calendar.getByRole("heading", { name: originalTitle, exact: true })).toBeVisible({ timeout: 60_000 });
  const occurrenceScope = calendar.getByLabel("This event");
  await expect(occurrenceScope).toBeChecked();
  await calendar.getByLabel("Title", { exact: true }).fill(overrideTitle);
  await calendar.getByRole("button", { name: "Save changes" }).click();
  await expect(calendar.locator(".upcoming button").filter({ hasText: overrideTitle }).first()).toBeVisible({ timeout: 60_000 });
}

async function openSearchResult(calendar: FrameLocator, title: string) {
  await calendar.getByRole("searchbox", { name: "Words" }).fill(title);
  const result = calendar.locator(".search-results button").filter({ hasText: title }).first();
  await expect(result).toBeVisible({ timeout: 60_000 });
  await result.click();
}

async function uploadCandidate(page: Page) {
  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await page.locator('[data-tid="launcher-install-package"]').click();
  await (await chooser).setFiles(candidateArchive);
  const dialog = page.locator('[data-tid="install-dialog"]');
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole("heading", { name: "Update application" })).toBeVisible();
  await expect(page.locator('[data-tid="install-compiled"]')).toBeVisible({ timeout: 180_000 });
  await expect(page.locator('[data-tid="install-accept"]')).toHaveText("Update");
  await page.locator('[data-tid="install-accept"]').click();
  await expect(page.locator('[data-tid="install-progress"]')).toBeVisible();
  await expect(page.locator('[data-tid="install-progress"]')).not.toBeVisible({ timeout: 180_000 });
  await expect(page.locator('[data-tid="install-error"]')).not.toBeVisible();
}

function nextWeekday(target: number, hour: number, minute: number) {
  const value = new Date();
  const delta = ((target - value.getDay() + 7) % 7) || 7;
  value.setDate(value.getDate() + delta);
  value.setHours(hour, minute, 0, 0);
  return value;
}

function minutesAfter(value: Date, minutes: number) { return new Date(value.getTime() + minutes * 60_000); }
function dateInput(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }
function localInput(value: Date) { return `${dateInput(value)}T${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`; }
