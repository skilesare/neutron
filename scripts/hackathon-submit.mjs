#!/usr/bin/env node
import {readFile, stat, mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {createInterface} from "node:readline/promises";
import {stdin, stdout} from "node:process";
import {chromium} from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const config = JSON.parse(await readFile(resolve(root, "submission/hackathon-entry.json"), "utf8"));
const absolute = (path) => resolve(root, path);
const portal = "https://4576f-3aaaa-aaaam-ajgpq-cai.icp0.io/";
const profile = resolve(root, ".playwright/hackathon-profile");
const checkOnly = process.argv.includes("--check");

if ((await stat(absolute(config.package))).size > 1_900_000) throw new Error("Package exceeds 1.9 MB");
if ((await stat(absolute(config.icon))).size > 100_000) throw new Error("Icon exceeds 100 KB");
if (config.screenshots.length > 6) throw new Error("Portal accepts no more than six screenshots");
for (const shot of config.screenshots) if ((await stat(absolute(shot))).size > 400_000) throw new Error(`${shot} exceeds 400 KB`);

if (checkOnly) {
  console.log("Portal asset checks passed.");
  process.exit(0);
}

await mkdir(profile, {recursive: true});

const browser = await chromium.launchPersistentContext(profile, {headless: false, viewport: {width: 1440, height: 960}});
const pages = browser.pages();
const page = pages[0] ?? await browser.newPage();
await page.goto(portal, {waitUntil: "domcontentloaded"});
console.log("Sign in with Internet Identity, enable Hacker, set the reward wallet, and accept the own-work consent.");
console.log("Then return here and press Enter. The script will fill and upload, but will NOT submit.");
const prompt = createInterface({input: stdin, output: stdout});
await prompt.question("");

await page.goto(`${portal}#/profile/entries`, {waitUntil: "domcontentloaded"});
await page.getByRole("heading", {name: /Your apps/i}).waitFor({timeout: 60_000});

const project = page.locator('input[placeholder="What are you building?"]');
const appId = page.locator('input[placeholder="tidy_notes"]');
const summary = page.locator('textarea[placeholder="A few lines for the judges."]');
const projectLink = page.locator('input[type="url"][placeholder="https://…"]');
await project.fill(config.title);
await appId.fill(config.slug);
await summary.fill(config.summary);
await projectLink.fill(config.sourceUrl);
if (config.demoUrl) {
  await page.getByRole("button", {name: /Add link/i}).click();
  await page.getByLabel("Link label").last().fill("Demo video");
  await page.getByLabel("Link URL").last().fill(config.demoUrl);
}

const packageInput = page.locator('input[type="file"][accept*=".neutron"]');
const screenshotInput = page.locator('input[type="file"][multiple]');
const iconInput = page.locator('input[type="file"][accept*="image"]:not([multiple])');
await packageInput.setInputFiles(absolute(config.package));
await iconInput.setInputFiles(absolute(config.icon));
// The portal removes the screenshot input after all six slots are occupied, so
// upload these last instead of retaining an index across reactive re-renders.
await screenshotInput.setInputFiles(config.screenshots.map(absolute));

for (const [name, field, expected] of [
  ["Project", project, config.title],
  ["App ID", appId, config.slug],
  ["Summary", summary, config.summary],
  ["Project link", projectLink, config.sourceUrl],
  ["Demo video", page.getByLabel("Link URL").last(), config.demoUrl],
]) {
  if (expected && await field.inputValue() !== expected) throw new Error(`${name} was not filled exactly`);
}

await page.screenshot({path: absolute("submission-assets/portal-filled-draft.png"), fullPage: true});
console.log("Draft filled. Review every field in the browser. The script intentionally did not click Submit app.");
console.log("Leave this process running while you review; press Enter here when you are finished to close it.");
await prompt.question("");
prompt.close();
await browser.close();
