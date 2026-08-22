import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Principal } from "@dfinity/principal";
import { expect, test, type BrowserContext, type FrameLocator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import {
  createKernelActor,
  localIdentityFromSeed,
} from "../../packages/neutron-provision/src/kernel.ts";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { signInWithLocalInternetIdentity } from "./local-ii.ts";

const configPath = process.env.NEUTRON_NDEPLOY_CONFIG ?? "calendar-submission-local.ndeploy.json";
const output = resolve("submission-assets/calendar");

test("capture the standalone Calendar submission", async ({ browser }) => {
  test.setTimeout(240_000);
  await mkdir(output, { recursive: true });
  const runtime = resolveLocalNeutronRuntime({ configPath });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  let principal: string | undefined;

  try {
    await context.credentials.install();
    await page.goto(localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl));
    await signInWithLocalInternetIdentity({
      page,
      context,
      loginSelector: '[data-tid="login-button"]',
      localHost: runtime.gatewayUrl,
    });
    const principalNode = page.locator('[data-tid="principal"]');
    await expect(principalNode).toBeVisible();
    principal = (await principalNode.textContent())?.trim();
    if (!principal) throw new Error("Internet Identity did not return a principal");
    const actor = await developerActor(runtime);
    await actor.kernel_authorized_recover(Principal.fromText(principal));
    await page.reload({ waitUntil: "domcontentloaded" });

    const calendar = await openCalendar(page);
    const monday = nextWeekday(1, 9, 0);
    await addEvent(calendar, "Design review", monday, minutesAfter(monday, 60), {
      location: "Studio A",
      color: "ocean",
      notes: "Review the launch flow and resolve open decisions.",
    });
    const focus = nextWeekday(2, 10, 0);
    await addEvent(calendar, "Focus time", focus, minutesAfter(focus, 90), {
      color: "violet",
      repeat: "weekly",
      count: 4,
    });
    const lunch = nextWeekday(3, 12, 30);
    await addEvent(calendar, "Lunch with Maya", lunch, minutesAfter(lunch, 60), {
      location: "Juniper Cafe",
      color: "sunset",
    });
    const planning = nextWeekday(4, 15, 0);
    await addEvent(calendar, "Product planning", planning, minutesAfter(planning, 45), {
      color: "sage",
    });

    await calendar.getByRole("button", { name: "Week", exact: true }).click();
    await navigateUntilVisible(calendar, "Design review");
    await expect(calendar.locator(".fc-event-title").filter({ hasText: "Design review" }).first()).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: resolve(output, "01-week-calendar.jpg"), type: "jpeg", quality: 84 });

    await calendar.locator(".upcoming button").filter({ hasText: "Focus time" }).first().click();
    await calendar.getByLabel("Entire series").check();
    await calendar.locator(".recurrence-editor").scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, "02-recurring-series.jpg"), type: "jpeg", quality: 84 });

    await calendar.getByRole("button", { name: "New", exact: true }).click();
    await calendar.locator(".calendar-header").scrollIntoViewIfNeeded();
    await calendar.getByRole("button", { name: "Month", exact: true }).click();
    await page.screenshot({ path: resolve(output, "03-month-calendar.jpg"), type: "jpeg", quality: 84 });

    await calendar.locator(".upcoming button").filter({ hasText: "Design review" }).first().click();
    await calendar.locator(".editor").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, "04-event-details.jpg"), type: "jpeg", quality: 84 });

    await page.setViewportSize({ width: 430, height: 900 });
    await page.reload({ waitUntil: "domcontentloaded" });
    const compact = page.frameLocator('[data-app-id="calendar"][data-tile-id="main"]').last();
    await expect(compact.getByRole("button", { name: "Agenda" })).toHaveClass(/fc-button-active/, { timeout: 60_000 });
    await compact.locator(".fc-next-button").click();
    await expect(compact.locator(".fc-view-harness").getByText("Design review", { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: resolve(output, "05-mobile-agenda.jpg"), type: "jpeg", quality: 84 });
  } finally {
    if (principal) {
      const actor = await developerActor(runtime);
      await actor.kernel_authorized_rem(Principal.fromText(principal));
    }
    await context.close();
  }
});

type Runtime = ReturnType<typeof resolveLocalNeutronRuntime>;

function developerActor(runtime: Runtime) {
  return createKernelActor({
    canisterId: runtime.canisterId,
    host: runtime.gatewayUrl,
    identity: localIdentityFromSeed(runtime.developerIdentitySeed),
    fetchRootKey: true,
  });
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

async function addEvent(
  calendar: FrameLocator,
  title: string,
  start: Date,
  end: Date,
  options: { location?: string; notes?: string; color?: string; repeat?: "weekly"; count?: number } = {},
) {
  const newButton = calendar.getByRole("button", { name: "New", exact: true });
  if (await newButton.count()) await newButton.click();
  await calendar.getByLabel("Title").fill(title);
  await calendar.getByLabel("Starts", { exact: true }).fill(localInput(start));
  await calendar.getByLabel("Ends", { exact: true }).fill(localInput(end));
  if (options.location) await calendar.getByLabel("Location").fill(options.location);
  if (options.notes) await calendar.getByLabel("Notes").fill(options.notes);
  if (options.color) await calendar.getByLabel("Color").selectOption(options.color);
  if (options.repeat) {
    await calendar.getByLabel("Repeat").selectOption(options.repeat);
    await calendar.getByLabel("Occurrences").fill(String(options.count ?? 4));
  }
  await calendar.getByRole("button", { name: "Add to calendar" }).click();
  await expect(calendar.getByLabel("Title")).toHaveValue("", { timeout: 60_000 });
}

async function navigateUntilVisible(calendar: FrameLocator, title: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await calendar.locator(".fc-event-title").filter({ hasText: title }).count()) return;
    await calendar.locator(".fc-next-button").click();
  }
  throw new Error(`Could not navigate Calendar to ${title}`);
}

function nextWeekday(target: number, hour: number, minute: number) {
  const value = new Date();
  const delta = ((target - value.getDay() + 7) % 7) || 7;
  value.setDate(value.getDate() + delta);
  value.setHours(hour, minute, 0, 0);
  return value;
}

function minutesAfter(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60_000);
}

function localInput(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
