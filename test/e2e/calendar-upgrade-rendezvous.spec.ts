import { resolve } from "node:path";
import { Actor, HttpAgent, type ActorMethod } from "@dfinity/agent";
import { IDL } from "@dfinity/candid";
import { Principal } from "@dfinity/principal";
import { expect, test, type BrowserContext, type FrameLocator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { createKernelActor, localIdentityFromSeed } from "../../packages/neutron-provision/src/kernel.ts";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { signInWithLocalInternetIdentity } from "./local-ii.ts";

const configPath = process.env.NEUTRON_NDEPLOY_CONFIG ?? "rendezvous-local.ndeploy.json";
const candidateArchive = resolve(process.env.CALENDAR_UPGRADE_ARCHIVE ?? "apps/calendar/calendar.v0.5.0.neutron");

test("confirmed and live-hold Rendezvous calendar state survives Calendar 0.2.0 to 0.5.0", async ({ browser }) => {
  test.setTimeout(360_000);
  const aliceRuntime = resolveLocalNeutronRuntime({ configPath, nodeIndex: 0 });
  const bobRuntime = resolveLocalNeutronRuntime({ configPath, nodeIndex: 1 });
  const aliceContext = await browser.newContext({ timezoneId: "America/Chicago" });
  const bobContext = await browser.newContext({ timezoneId: "America/Chicago" });
  let alicePrincipal: string | undefined;
  let bobPrincipal: string | undefined;
  let aliceStopped = false;
  const suffix = String(Date.now());
  const confirmedTitle = `Upgrade confirmed ${suffix}`;
  const holdTitle = `Upgrade hold ${suffix}`;
  try {
    const alice = await signInAndAuthorize(aliceContext, aliceRuntime); alicePrincipal = alice.principal;
    const bob = await signInAndAuthorize(bobContext, bobRuntime); bobPrincipal = bob.principal;
    const aliceRendezvous = await openApp(alice.page, "rendezvous");
    const bobRendezvous = await openApp(bob.page, "rendezvous");

    const confirmedStart = futureLocalTime(1, 14, 0);
    await sendSingleOption(aliceRendezvous, bobRuntime.canisterId, confirmedTitle, confirmedStart);
    const bobConfirmed = await receiveProposal(bobRendezvous, confirmedTitle);
    await bobConfirmed.getByRole("radio").check();
    await bobConfirmed.getByRole("button", { name: "Accept selected time" }).click();
    await expect(bobConfirmed.getByText("Scheduled", { exact: true })).toBeVisible({ timeout: 60_000 });

    const holdStart = futureLocalTime(2, 15, 0);
    await sendSingleOption(aliceRendezvous, bobRuntime.canisterId, holdTitle, holdStart);
    const bobHold = await receiveProposal(bobRendezvous, holdTitle);
    await setCanisterRunning(aliceRuntime, false); aliceStopped = true;
    await bobHold.getByRole("radio").check();
    await bobHold.getByRole("button", { name: "Accept selected time" }).click();

    const beforeCalendar = await openApp(bob.page, "calendar");
    await expect(beforeCalendar.locator(".fc-event--rendezvous").filter({ hasText: confirmedTitle })).toBeVisible({ timeout: 60_000 });
    await expect(beforeCalendar.locator(".fc-event--hold").filter({ hasText: holdTitle })).toBeVisible({ timeout: 60_000 });

    const actor = await developerActor(bobRuntime);
    const beforeRuntime = await actor.kernel_runtime_info();
    const beforeApp = beforeRuntime.apps.find((app) => app.scope.app_id === "calendar");
    expect(Number(beforeApp?.version)).toBe(200);
    await uploadCandidate(bob.page);
    await bob.page.reload({ waitUntil: "domcontentloaded" });
    const afterRuntime = await actor.kernel_runtime_info();
    const afterApp = afterRuntime.apps.find((app) => app.scope.app_id === "calendar");
    expect(Number(afterApp?.version)).toBe(500);
    const afterCalendarMemory = afterRuntime.memories.find((memory) => memory.id === "calendar");
    expect(Number(afterCalendarMemory?.version)).toBe(4);
    expect(String(afterApp?.scope.installation_uid)).toBe(String(beforeApp?.scope.installation_uid));
    const beforeCalendarMemory = beforeRuntime.memories.find((memory) => memory.id === "calendar");
    const beforeMemories = beforeRuntime.memories.filter((memory) => memory.id !== "calendar").map(memoryIdentity);
    const afterMemories = afterRuntime.memories.filter((memory) => memory.id !== "calendar").map(memoryIdentity);
    expect(afterMemories).toEqual(expect.arrayContaining(beforeMemories));
    expect(afterRuntime.memories).toHaveLength(beforeRuntime.memories.length);
    expect(String(afterCalendarMemory?.owner)).toBe(String(beforeCalendarMemory?.owner));
    expect(String(afterCalendarMemory?.schema)).not.toBe(String(beforeCalendarMemory?.schema));

    const upgraded = await openApp(bob.page, "calendar");
    await expect(upgraded.locator(".fc-event--rendezvous").filter({ hasText: confirmedTitle })).toBeVisible({ timeout: 60_000 });
    await expect(upgraded.locator(".fc-event--hold").filter({ hasText: holdTitle })).toBeVisible({ timeout: 60_000 });
    await searchAndOpen(upgraded, confirmedTitle);
    await expect(upgraded.getByText("Scheduled through Rendezvous")).toBeVisible();
    await searchAndOpen(upgraded, holdTitle);
    await expect(upgraded.getByText("Tentative Rendezvous hold")).toBeVisible();
    await expect(upgraded.getByRole("button", { name: "Open meeting in Rendezvous" })).toBeVisible();
  } finally {
    if (aliceStopped) await setCanisterRunning(aliceRuntime, true);
    if (alicePrincipal) await revoke(aliceRuntime, alicePrincipal);
    if (bobPrincipal) await revoke(bobRuntime, bobPrincipal);
    await aliceContext.close();
    await bobContext.close();
  }
});

type Runtime = ReturnType<typeof resolveLocalNeutronRuntime>;

async function signInAndAuthorize(context: BrowserContext, runtime: Runtime) {
  await context.credentials.install();
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  await page.goto(localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl));
  await signInWithLocalInternetIdentity({ page, context, loginSelector: '[data-tid="login-button"]', localHost: runtime.gatewayUrl });
  const principalNode = page.locator('[data-tid="principal"]');
  await expect(principalNode).toBeVisible();
  const principal = (await principalNode.textContent())?.trim();
  if (!principal) throw new Error(`Internet Identity did not return a principal for ${runtime.nodeLabel}`);
  await (await developerActor(runtime)).kernel_authorized_recover(Principal.fromText(principal));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-tid="launcher-open"]')).toBeVisible({ timeout: 60_000 });
  return { page, principal };
}

async function revoke(runtime: Runtime, principal: string) {
  await (await developerActor(runtime)).kernel_authorized_rem(Principal.fromText(principal));
}

function developerActor(runtime: Runtime) {
  return createKernelActor({ canisterId: runtime.canisterId, host: runtime.gatewayUrl, identity: localIdentityFromSeed(runtime.developerIdentitySeed), fetchRootKey: true });
}

function memoryIdentity(memory: { id: string; owner: string; version: bigint | number; schema: string }) {
  return { id: memory.id, owner: memory.owner, version: String(memory.version), schema: memory.schema };
}

async function openApp(page: Page, appId: "calendar" | "rendezvous"): Promise<FrameLocator> {
  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator(`[data-tid="launcher-tile-${appId}-main"]`).click();
  const frame = page.frameLocator(`[data-app-id="${appId}"][data-tile-id="main"]`).last();
  await expect(frame.getByRole("heading", { name: appId === "calendar" ? "Calendar" : "Rendezvous", exact: true })).toBeVisible({ timeout: 60_000 });
  if (appId === "calendar") await expect(frame.getByText("Loading your calendar…")).toHaveCount(0, { timeout: 60_000 });
  if (appId === "rendezvous") await expect(frame.getByText("Loading negotiations…")).toHaveCount(0, { timeout: 60_000 });
  return frame;
}

async function sendSingleOption(rendezvous: FrameLocator, peer: string, title: string, exact: Date) {
  await rendezvous.getByLabel("Their Rendezvous address").fill(peer);
  await rendezvous.getByLabel("Meeting title").fill(title);
  await rendezvous.getByRole("button", { name: "Choose dates" }).click();
  await rendezvous.getByRole("button", { name: "Find available times" }).click();
  await expect(rendezvous.getByRole("heading", { name: "Choose exact options" })).toBeVisible({ timeout: 60_000 });
  await rendezvous.getByLabel("Add a specific time").fill(localInput(exact));
  await rendezvous.getByRole("button", { name: "Check and add" }).click();
  await expect(rendezvous.getByText("1 of 16 selected")).toBeVisible({ timeout: 60_000 });
  await rendezvous.getByRole("button", { name: "Review 1 option" }).click();
  await rendezvous.getByRole("button", { name: "Send proposal" }).click();
  await expect(rendezvous.getByRole("heading", { name: title })).toBeVisible({ timeout: 60_000 });
}

async function receiveProposal(rendezvous: FrameLocator, title: string) {
  await expect.poll(async () => {
    await rendezvous.getByRole("button", { name: "Refresh" }).click();
    return rendezvous.getByRole("heading", { name: title }).count();
  }, { timeout: 60_000 }).toBe(1);
  return rendezvous.locator("article.negotiation").filter({ hasText: title });
}

async function searchAndOpen(calendar: FrameLocator, title: string) {
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
  await expect(dialog.getByRole("heading", { name: "Update application" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-tid="install-compiled"]')).toBeVisible({ timeout: 180_000 });
  await page.locator('[data-tid="install-accept"]').click();
  await expect(page.locator('[data-tid="install-progress"]')).toBeVisible();
  await expect(page.locator('[data-tid="install-progress"]')).not.toBeVisible({ timeout: 180_000 });
  await expect(page.locator('[data-tid="install-error"]')).not.toBeVisible();
}

async function setCanisterRunning(runtime: Runtime, running: boolean) {
  const target = Principal.fromText(runtime.canisterId);
  const agent = await HttpAgent.create({ host: runtime.gatewayUrl, identity: localIdentityFromSeed(runtime.developerIdentitySeed), verifyQuerySignatures: false });
  await agent.fetchRootKey();
  const actor = Actor.createActor<{ start_canister: ActorMethod<[{ canister_id: Principal }], undefined>; stop_canister: ActorMethod<[{ canister_id: Principal }], undefined> }>(() => IDL.Service({ start_canister: IDL.Func([IDL.Record({ canister_id: IDL.Principal })], [], []), stop_canister: IDL.Func([IDL.Record({ canister_id: IDL.Principal })], [], []) }), { agent, canisterId: Principal.managementCanister(), effectiveCanisterId: target });
  if (running) await actor.start_canister({ canister_id: target });
  else await actor.stop_canister({ canister_id: target });
}

function futureLocalTime(days: number, hour: number, minute: number) {
  const value = new Date(); value.setDate(value.getDate() + days); value.setHours(hour, minute, 0, 0); return value;
}
function localInput(date: Date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
