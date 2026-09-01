import { Principal } from "@dfinity/principal";
import { expect, test, type Browser, type BrowserContext, type FrameLocator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { createKernelActor, localIdentityFromSeed } from "../../packages/neutron-provision/src/kernel.ts";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { signInWithLocalInternetIdentity } from "./local-ii.ts";

const configPath = process.env.NEUTRON_NDEPLOY_CONFIG ?? "calendar-submission-local.ndeploy.json";

test("Calendar create, search, and edit are keyboard operable at narrow width", async ({ browser }) => {
  test.setTimeout(240_000);
  const session = await authorizedSession(browser, { reducedMotion: "reduce", viewport: { width: 430, height: 900 } });
  try {
    const calendar = await openCalendar(session.page);
    const title = calendar.getByLabel("Title", { exact: true });
    const eventTitle = `Keyboard proof ${Date.now()}`;
    const start = new Date(Date.now() + 4 * 60 * 60 * 1000);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 45 * 60 * 1000);

    const blockTime = calendar.getByRole("button", { name: "Block time", exact: true });
    await blockTime.focus();
    await blockTime.press("Enter");
    await expect(title).toBeFocused();
    await expect(title).toHaveValue("Busy");
    await title.fill(eventTitle);
    await calendar.getByLabel("Starts", { exact: true }).fill(localInput(start));
    await calendar.getByLabel("Ends", { exact: true }).fill(localInput(end));
    const add = calendar.getByRole("button", { name: "Add to calendar" });
    await add.focus();
    await add.press("Enter");
    await expect(title).toHaveValue("", { timeout: 60_000 });

    const search = calendar.getByRole("searchbox", { name: "Words" });
    await search.focus();
    await search.fill(eventTitle);
    const result = calendar.locator(".search-results button").filter({ hasText: eventTitle }).first();
    await expect(result).toBeVisible({ timeout: 60_000 });
    await result.focus();
    await result.press("Enter");
    await expect(title).toBeFocused();
    await expect(title).toHaveValue(eventTitle);

    expect(await calendar.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  } finally {
    await closeAuthorizedSession(session);
  }
});

test("Calendar prepares a valid ICS file and saves it through optional Files", async ({ browser }) => {
  test.setTimeout(240_000);
  const session = await authorizedSession(browser);
  try {
    const calendar = await openCalendar(session.page);
    const eventTitle = `ICS download proof ${Date.now()}`;
    const start = new Date(Date.now() + 6 * 60 * 60 * 1000);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    await calendar.getByRole("button", { name: "Block time", exact: true }).click();
    await calendar.getByLabel("Title", { exact: true }).fill(eventTitle);
    await calendar.getByLabel("Starts", { exact: true }).fill(localInput(start));
    await calendar.getByLabel("Ends", { exact: true }).fill(localInput(end));
    await calendar.getByRole("button", { name: "Add to calendar" }).click();
    await expect(calendar.getByLabel("Title", { exact: true })).toHaveValue("", { timeout: 60_000 });

    const exporting = calendar.getByRole("button", { name: "Export calendar", exact: true }).click();
    const permission = session.page.locator('[data-tid="frontend-tool-dialog"]');
    await expect(permission).toBeVisible({ timeout: 60_000 });
    await expect(permission).toContainText("calendar/tile");
    await expect(permission).toContainText("app:files:background");
    await expect(permission).toContainText("write");
    await permission.locator('[data-tid="frontend-tool-approve-session"]').click();
    await exporting;

    const pathInput = calendar.getByLabel("Saved privately in Files");
    await expect(pathInput).toHaveValue("/Workspace/Calendar Exports/neutron-calendar.ics", { timeout: 60_000 });
    await expect(calendar.locator("output.calendar-message")).toContainText("Saved", { timeout: 60_000 });
    await calendar.getByRole("button", { name: "Open Files" }).click();
    const files = session.page.frameLocator('[data-app-id="files"][data-tile-id="files"]').last();
    await expect(files.locator(".files-v2-app")).toBeVisible({ timeout: 60_000 });
    const folder = files.locator('[role="treeitem"][data-path="/Workspace/Calendar Exports"]');
    await expect(folder).toBeVisible({ timeout: 60_000 });
    if (await folder.getAttribute("aria-expanded") !== "true") await folder.click();
    const savedFile = files.locator('[role="treeitem"][data-path="/Workspace/Calendar Exports/neutron-calendar.ics"]');
    await expect(savedFile).toBeVisible({ timeout: 60_000 });
    await savedFile.click();
    const editor = files.getByRole("textbox", { name: "Edit neutron-calendar.ics" });
    await expect(editor).toHaveValue(/BEGIN:VCALENDAR/u, { timeout: 60_000 });
    await expect(editor).toHaveValue(new RegExp(`SUMMARY:${eventTitle}`, "u"));
    await expect(editor).toHaveValue(/END:VCALENDAR/u);
  } finally {
    await closeAuthorizedSession(session);
  }
});

test("Calendar previews, atomically imports, reconciles, and safely undoes an ICS file", async ({ browser }) => {
  test.setTimeout(240_000);
  const session = await authorizedSession(browser);
  try {
    const calendar = await openCalendar(session.page);
    const title = `Imported proof ${Date.now()}`;
    const uid = `proof-${Date.now()}@calendar.test`;
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Calendar E2E//EN", "BEGIN:VEVENT", `UID:${uid}`, "SEQUENCE:1", "DTSTART:20270115T160000Z", "DTEND:20270115T170000Z", `SUMMARY:${title}`, "DESCRIPTION:Imported without exposing raw bytes to the backend parser", "LOCATION:Review room", "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
    await calendar.getByLabel("Choose `.ics` file").setInputFiles({ name: "proof.ics", mimeType: "text/calendar", buffer: Buffer.from(body) });
    const preview = calendar.getByRole("region", { name: "Import preview for proof.ics" });
    await expect(preview).toBeVisible({ timeout: 60_000 });
    await expect(preview).toContainText(title);
    await expect(preview).toContainText("create · 1 occurrence");
    await expect(preview.getByText("1 backend mutation selected")).toBeVisible();
    await preview.getByRole("button", { name: "Import 1 selected" }).click();
    await expect(calendar.getByText(/Import committed/u)).toBeVisible({ timeout: 60_000 });
    const search = calendar.getByRole("searchbox", { name: "Words" });
    await search.fill(title);
    await expect(calendar.locator(".search-results button").filter({ hasText: title }).first()).toBeVisible({ timeout: 60_000 });
    await calendar.getByRole("button", { name: "Undo this import" }).click();
    await expect(calendar.getByText("Import undone")).toBeVisible({ timeout: 60_000 });
    await search.fill(`${title} no-match`); await search.fill(title);
    await expect(calendar.locator(".search-results button").filter({ hasText: title })).toHaveCount(0, { timeout: 60_000 });
  } finally {
    await closeAuthorizedSession(session);
  }
});

test("authorization removal and logout remove Calendar owner surfaces", async ({ browser }) => {
  test.setTimeout(240_000);
  const session = await authorizedSession(browser);
  try {
    await openCalendar(session.page);
    await session.actor.kernel_authorized_rem(Principal.fromText(session.principal));
    session.authorized = false;
    await session.page.reload({ waitUntil: "domcontentloaded" });
    await expect(session.page.getByRole("heading", { name: "Not authorized" })).toBeVisible({ timeout: 60_000 });
    await expect(session.page.locator('[data-app-id="calendar"]')).toHaveCount(0);
    await expect(session.page.locator('[data-tid="app-background-frame"][data-app-id="calendar"]')).toHaveCount(0);

    await session.page.locator('[data-tid="logout-button"]').click();
    await expect(session.page.locator('[data-tid="login-button"]')).toBeVisible({ timeout: 60_000 });
    await expect(session.page.locator('[data-tid="principal"]')).toHaveCount(0);
  } finally {
    await closeAuthorizedSession(session);
  }
});

test("Calendar resident and Agent 0.3.9 start together for live owner qualification", async ({ browser }) => {
  test.setTimeout(240_000);
  const session = await authorizedSession(browser);
  try {
    const runtimeInfo = await session.actor.kernel_runtime_info();
    const installedVersion = (appId: string) => Number(runtimeInfo.apps.find((app) => app.scope.app_id === appId)?.version);
    expect(installedVersion("calendar")).toBe(606);
    expect(installedVersion("agent")).toBe(309);
    expect(installedVersion("files")).toBe(403);
    expect(Number(runtimeInfo.memories.find((memory) => memory.id === "calendar")?.version)).toBe(4);

    const calendarBackground = session.page.locator('[data-tid="app-background-frame"][data-app-id="calendar"]');
    const agentBackground = session.page.locator('[data-tid="app-background-frame"][data-app-id="agent"]');
    await expect(calendarBackground).toHaveAttribute("data-resident-launch", "ready", { timeout: 60_000 });
    await expect(agentBackground).toHaveAttribute("data-resident-launch", "ready", { timeout: 60_000 });

    await session.page.locator('[data-tid="launcher-open"]').click();
    await expect(session.page.locator('[data-tid="launcher-tile-calendar-main"]')).toBeVisible();
    await session.page.locator('[data-tid="launcher-tile-agent-chat"]').click();
    const agent = session.page.frameLocator('[data-app-id="agent"][data-tile-id="chat"]').last();
    await expect(agent.getByRole("button", { name: "Connect to OpenRouter" })).toBeVisible({ timeout: 60_000 });
    await expect(calendarBackground).toHaveAttribute("data-resident-launch", "ready");
  } finally {
    await closeAuthorizedSession(session);
  }
});

type Runtime = ReturnType<typeof resolveLocalNeutronRuntime>;
type Session = {
  actor: Awaited<ReturnType<typeof createKernelActor>>;
  authorized: boolean;
  context: BrowserContext;
  page: Page;
  principal: string;
  runtime: Runtime;
};

async function authorizedSession(
  browser: Browser,
  options: Parameters<Browser["newContext"]>[0] = { viewport: { width: 1440, height: 1000 } },
): Promise<Session> {
  const runtime = resolveLocalNeutronRuntime({ configPath });
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await context.credentials.install();
  await page.goto(localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl));
  await signInWithLocalInternetIdentity({ page, context, loginSelector: '[data-tid="login-button"]', localHost: runtime.gatewayUrl });
  const principalNode = page.locator('[data-tid="principal"]');
  await expect(principalNode).toBeVisible();
  const principal = (await principalNode.textContent())?.trim();
  if (!principal) throw new Error("Internet Identity did not return a principal");
  const actor = await createKernelActor({ canisterId: runtime.canisterId, host: runtime.gatewayUrl, identity: localIdentityFromSeed(runtime.developerIdentitySeed), fetchRootKey: true });
  await actor.kernel_authorized_recover(Principal.fromText(principal));
  await page.reload({ waitUntil: "domcontentloaded" });
  return { actor, authorized: true, context, page, principal, runtime };
}

async function closeAuthorizedSession(session: Session) {
  if (session.authorized) await session.actor.kernel_authorized_rem(Principal.fromText(session.principal));
  await session.context.close();
}

async function openCalendar(page: Page): Promise<FrameLocator> {
  await expect(page.locator('[data-tid="launcher-open"]')).toBeVisible({ timeout: 60_000 });
  await page.locator('[data-tid="launcher-open"]').click();
  await page.locator('[data-tid="launcher-tile-calendar-main"]').click();
  const frame = page.frameLocator('[data-app-id="calendar"][data-tile-id="main"]').last();
  await expect(frame.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(frame.getByText("Loading your calendar…")).toHaveCount(0, { timeout: 60_000 });
  return frame;
}

function localInput(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
