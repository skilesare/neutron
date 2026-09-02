#!/usr/bin/env node
import {mkdir, readFile, stat} from "node:fs/promises";
import {basename, resolve} from "node:path";
import {stdin, stdout} from "node:process";
import {createInterface} from "node:readline/promises";
import {chromium} from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const config = JSON.parse(await readFile(resolve(root, "submission/hackathon-entry.json"), "utf8"));
const absolute = (path) => resolve(root, path);
const portal = "https://4576f-3aaaa-aaaam-ajgpq-cai.icp0.io/";
const profile = resolve(root, ".playwright/hackathon-profile");
const checkOnly = process.argv.includes("--check");
const inspectOnly = process.argv.includes("--inspect");

if ((await stat(absolute(config.package))).size > 1_900_000) throw new Error("Package exceeds 1.9 MB");
if ((await stat(absolute(config.icon))).size > 100_000) throw new Error("Icon exceeds 100 KB");
if (config.screenshots.length > 6) throw new Error("Portal accepts no more than six screenshots");
for (const shot of config.screenshots) {
  if ((await stat(absolute(shot))).size > 400_000) throw new Error(`${shot} exceeds 400 KB`);
}

if (checkOnly) {
  console.log("Portal asset checks passed.");
  process.exit(0);
}

await mkdir(profile, {recursive: true});
const browser = await chromium.launchPersistentContext(profile, {headless: false, viewport: {width: 1440, height: 960}});
const page = browser.pages()[0] ?? await browser.newPage();
await page.goto(portal, {waitUntil: "domcontentloaded"});
if (inspectOnly) {
  await page.goto(`${portal}#/profile/entries`, {waitUntil: "domcontentloaded"});
  await page.getByRole("heading", {name: /Your apps/i}).waitFor({timeout: 60_000});
  const addLink = page.getByRole("button", {name: /^Add link$/i});
  if (await addLink.count()) {
    await addLink.click();
    await page.waitForTimeout(250);
  }
  const controls = await page.locator("input, textarea, button").evaluateAll((nodes) => nodes.map((node) => ({
    tag: node.tagName.toLowerCase(),
    type: node.getAttribute("type"),
    name: node.getAttribute("name"),
    accept: node.getAttribute("accept"),
    multiple: node.hasAttribute("multiple"),
    ariaLabel: node.getAttribute("aria-label"),
    placeholder: node.getAttribute("placeholder"),
    text: node.textContent?.trim().replace(/\s+/g, " ").slice(0, 120) ?? "",
    nearby: node.parentElement?.textContent?.trim().replace(/\s+/g, " ").slice(0, 200) ?? "",
  })));
  console.log(JSON.stringify(controls, null, 2));
  await browser.close();
  process.exit(0);
}
console.log("Sign in with Internet Identity, enable Hacker, set the reward wallet, and accept the own-work consent.");
console.log("Then return here and press Enter. The script fills and uploads the draft but never submits it.");
const prompt = createInterface({input: stdin, output: stdout});
await prompt.question("");

await page.goto(`${portal}#/profile/entries`, {waitUntil: "domcontentloaded"});
await page.getByRole("heading", {name: /Your apps/i}).waitFor({timeout: 60_000});
const requiredField = async (locator, description, value) => {
  if (!value) throw new Error(`Missing ${description} in submission/hackathon-entry.json`);
  if (await locator.count() !== 1) throw new Error(`Expected one ${description} field, found ${await locator.count()}`);
  await locator.fill(value);
  if (await locator.inputValue() !== value) throw new Error(`${description} was not populated correctly`);
};

await requiredField(page.getByPlaceholder("What are you building?"), "Project", config.title);
await requiredField(page.getByPlaceholder("tidy_notes"), "App ID", config.slug);
await requiredField(page.getByPlaceholder("A few lines for the judges."), "Summary", config.summary);
await requiredField(
  page.locator('input[type="url"]:not([aria-label="Link URL"])'),
  "Project link",
  config.sourceUrl,
);

if (config.demoUrl) {
  await page.getByRole("button", {name: /^Add link$/i}).click();
  await requiredField(page.getByLabel("Link label").last(), "extra-link label", "Demo video");
  await requiredField(page.getByLabel("Link URL").last(), "extra-link URL", config.demoUrl);
}

const uploadAndVerify = async (locator, paths, description) => {
  if (await locator.count() !== 1) throw new Error(`Expected one ${description} upload, found ${await locator.count()}`);
  await locator.setInputFiles(paths);
  console.log(`${description} selected: ${(Array.isArray(paths) ? paths : [paths]).map((path) => basename(path)).join(", ")}`);
};

await uploadAndVerify(
  page.locator('input[type="file"][accept*=".neutron"]'),
  absolute(config.package),
  "Neutron package",
);
await page.getByText(basename(config.package), {exact: false}).waitFor({timeout: 30_000});
await page.getByRole("button", {name: /Clear package/i}).waitFor({timeout: 30_000});
console.log(`Neutron package confirmed by portal: ${basename(config.package)}`);

await uploadAndVerify(
  page.locator('input[type="file"][accept="image/*"]:not([multiple])'),
  absolute(config.icon),
  "Icon",
);
await page.getByText(/Change icon/i).waitFor({timeout: 30_000});
console.log("Icon confirmed by portal.");

await uploadAndVerify(
  page.locator('input[type="file"][accept="image/*"][multiple]'),
  config.screenshots.map(absolute),
  "Screenshots",
);
await page.getByText(new RegExp(`${config.screenshots.length}/6`)).waitFor({timeout: 30_000});
console.log(`${config.screenshots.length}/6 screenshots confirmed by portal.`);

await page.screenshot({path: absolute("submission-assets/portal-filled-draft.png"), fullPage: true});
console.log(`Draft filled and package verified in-browser: ${basename(config.package)}`);
console.log("Review every field in the browser; click Submit app yourself.");
console.log("Press Enter here after review to close the browser.");
await prompt.question("");
prompt.close();
await browser.close();
