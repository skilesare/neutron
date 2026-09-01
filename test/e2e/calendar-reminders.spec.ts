import { Principal } from "@dfinity/principal";
import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { createKernelActor, localIdentityFromSeed } from "../../packages/neutron-provision/src/kernel.ts";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { signInWithLocalInternetIdentity } from "./local-ii.ts";

const configPath = process.env.NEUTRON_NDEPLOY_CONFIG ?? "calendar-upgrade-local.ndeploy.json";
const candidateArchive = resolve(process.env.CALENDAR_UPGRADE_ARCHIVE ?? "apps/calendar/calendar.v0.6.6.neutron");

test("resident reminder survives reload, drives the badge and tray, and opens the exact event", async ({ browser }) => {
  test.setTimeout(180_000);
  const runtime = resolveLocalNeutronRuntime({ configPath });
  const context = await browser.newContext({ viewport: { width: 420, height: 900 }, timezoneId: "America/Chicago" });
  const page = await context.newPage(); page.setDefaultTimeout(20_000);
  let principal: string | undefined;
  const title = `Reminder acceptance ${Date.now()}`;
  try {
    await context.credentials.install();
    await page.goto(localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl));
    await signInWithLocalInternetIdentity({ page, context, loginSelector: '[data-tid="login-button"]', localHost: runtime.gatewayUrl });
    principal = (await page.locator('[data-tid="principal"]').textContent())?.trim();
    if (!principal) throw new Error("Internet Identity did not return a principal");
    const actor = await createKernelActor({ canisterId: runtime.canisterId, host: runtime.gatewayUrl, identity: localIdentityFromSeed(runtime.developerIdentitySeed), fetchRootKey: true });
    await actor.kernel_authorized_recover(Principal.fromText(principal));
    await page.reload({ waitUntil: "domcontentloaded" });
    const installed = (await actor.kernel_runtime_info()).apps.find((app) => app.scope.app_id === "calendar");
    if (Number(installed?.version) < 606) { await uploadCandidate(page); await page.reload({ waitUntil: "domcontentloaded" }); }

    let calendar = await openCalendar(page);
    const start = new Date(Date.now() + 2 * 60_000); const end = new Date(Date.now() + 32 * 60_000);
    await calendar.getByLabel("Title", { exact: true }).fill(title);
    // The exact 0.2.0 fixture carries its saved UTC display preference forward.
    await calendar.getByLabel("Starts", { exact: true }).fill(utcInput(start));
    await calendar.getByLabel("Ends", { exact: true }).fill(utcInput(end));
    await reminderSelect(calendar).selectOption({ label: "15 minutes before" });
    await calendar.getByRole("button", { name: "Add to calendar" }).click();
    await expect(calendar.getByLabel("Title", { exact: true })).toHaveValue("", { timeout: 60_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    calendar = await openCalendar(page);
    await calendar.getByRole("searchbox", { name: "Words" }).fill(title);
    const result = calendar.locator(".search-results button").filter({ hasText: title }).first();
    await expect(result).toBeVisible({ timeout: 60_000 }); await result.click();
    await expect(reminderSelect(calendar)).toHaveValue("15");
    await expect(calendar.getByLabel("Starts", { exact: true })).toHaveValue(utcInput(start));
    await page.locator('[data-tid="app-tray-button-calendar"]').click();
    let tray = page.frameLocator('[data-tid="app-tray-frame"][data-app-id="calendar"]');
    await expect(tray.getByRole("heading", { name: "Reminders" })).toBeVisible();
    await expect(tray.locator("body")).toContainText(title);
    await tray.locator("body").press("Escape");
    await expect(page.locator('[data-tid="app-tray-button-calendar"]')).toHaveAttribute("aria-label", /1 new item/, { timeout: 60_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-tid="app-tray-button-calendar"]')).toHaveAttribute("aria-label", /1 new item/, { timeout: 60_000 });
    calendar = await openCalendar(page);
    const zoneInput = calendar.getByLabel("Time zone");
    const targetZone = await zoneInput.inputValue() === "Asia/Kolkata" ? "Europe/London" : "Asia/Kolkata";
    await zoneInput.fill(targetZone);
    await calendar.getByRole("button", { name: /Save scheduling defaults/ }).click();
    await expect(calendar.getByText("Scheduling defaults saved.")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-tid="app-tray-button-calendar"]')).toHaveAttribute("aria-label", /1 new item/, { timeout: 60_000 });
    await page.locator('[data-tid="app-tray-button-calendar"]').click();
    tray = page.frameLocator('[data-tid="app-tray-frame"][data-app-id="calendar"]');
    await expect(tray.getByRole("heading", { name: "Now" })).toBeVisible();
    const dueReminder = tray.getByLabel("Now").getByRole("button", { name: new RegExp(title) });
    await expect(dueReminder).toBeVisible();
    await dueReminder.click();

    calendar = focusedCalendar(page);
    await expect(calendar.getByLabel("Title", { exact: true })).toHaveValue(title, { timeout: 60_000 });
    await calendar.getByRole("button", { name: "Delete series" }).click();
    await calendar.getByRole("button", { name: "Confirm delete series" }).click();
    await page.locator('[data-tid="app-tray-button-calendar"]').click();
    tray = page.frameLocator('[data-tid="app-tray-frame"][data-app-id="calendar"]');
    await expect(tray.locator("body")).not.toContainText(title, { timeout: 60_000 });
    await tray.locator("body").press("Escape");
    await page.locator('[data-tid="kernel-tray-toggle"]').click();
    await page.locator('[data-tid="kernel-tray-logout"]').click();
    await expect(page.locator('[data-tid="login-button"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-tid="app-background-frame"][data-app-id="calendar"]')).toHaveCount(0);
    await expect(page.locator('[data-tid="app-tray-button-calendar"]')).toHaveCount(0);
  } finally {
    if (principal) {
      const actor = await createKernelActor({ canisterId: runtime.canisterId, host: runtime.gatewayUrl, identity: localIdentityFromSeed(runtime.developerIdentitySeed), fetchRootKey: true });
      await actor.kernel_authorized_rem(Principal.fromText(principal));
    }
    await context.close();
  }
});

async function openCalendar(page: Page): Promise<FrameLocator> {
  await expect(page.locator('[data-tid="launcher-open"]')).toBeVisible({ timeout: 60_000 });
  await page.locator('[data-tid="launcher-open"]').click();
  await page.locator('[data-tid="launcher-tile-calendar-main"]').click();
  const frame = focusedCalendar(page);
  await expect(frame.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(frame.getByText("Loading your calendar…")).toHaveCount(0, { timeout: 60_000 });
  return frame;
}

async function uploadCandidate(page: Page) {
  await page.locator('[data-tid="launcher-open"]').click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator('[data-tid="launcher-install-package"]').click();
  await (await chooser).setFiles(candidateArchive);
  await expect(page.locator('[data-tid="install-dialog"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-tid="install-compiled"]')).toBeVisible({ timeout: 180_000 });
  await page.locator('[data-tid="install-accept"]').click();
  await expect(page.locator('[data-tid="install-progress"]')).toBeVisible();
  await expect(page.locator('[data-tid="install-progress"]')).not.toBeVisible({ timeout: 180_000 });
  await expect(page.locator('[data-tid="install-error"]')).not.toBeVisible();
}

function utcInput(value: Date): string { return value.toISOString().slice(0, 16); }
function reminderSelect(calendar: FrameLocator) { return calendar.locator("label").filter({ hasText: /^Reminder/ }).locator("select"); }
function focusedCalendar(page: Page): FrameLocator { return page.frameLocator('.workspace-tile--focused iframe[data-app-id="calendar"][data-tile-id="main"]'); }
