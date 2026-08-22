#!/usr/bin/env node
import {mkdir, readFile, stat} from "node:fs/promises";
import {resolve} from "node:path";
import {stdin, stdout} from "node:process";
import {createInterface} from "node:readline/promises";
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
console.log("Sign in with Internet Identity, enable Hacker, set the reward wallet, and accept the own-work consent.");
console.log("Then return here and press Enter. The script fills and uploads the draft but never submits it.");
const prompt = createInterface({input: stdin, output: stdout});
await prompt.question("");

await page.goto(`${portal}#/profile/entries`, {waitUntil: "domcontentloaded"});
await page.getByRole("heading", {name: /Your apps/i}).waitFor({timeout: 60_000});
const fill = async (label, value) => {
  if (!value) return;
  const field = page.getByLabel(label).first();
  if (await field.count()) await field.fill(value);
};
await fill(/^Title/i, config.title);
await fill(/Slug|download/i, config.slug);
await fill(/Summary/i, config.summary);
await fill(/Primary link|Project URL|Source/i, config.sourceUrl);
await fill(/Demo|Video/i, config.demoUrl);

const fileInputs = page.locator('input[type="file"]');
for (let index = 0; index < await fileInputs.count(); index += 1) {
  const input = fileInputs.nth(index);
  const accept = (await input.getAttribute("accept")) ?? "";
  const multiple = await input.getAttribute("multiple");
  if (accept.includes(".neutron")) await input.setInputFiles(absolute(config.package));
  else if (multiple !== null) await input.setInputFiles(config.screenshots.map(absolute));
  else if (accept.match(/image/i)) await input.setInputFiles(absolute(config.icon));
}

await page.screenshot({path: absolute("submission-assets/portal-filled-draft.png"), fullPage: true});
console.log("Draft filled. Review every field in the browser; click Submit app yourself.");
console.log("Press Enter here after review to close the browser.");
await prompt.question("");
prompt.close();
await browser.close();
