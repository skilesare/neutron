#!/usr/bin/env node
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {readFile, stat} from "node:fs/promises";
import {resolve} from "node:path";

const root = resolve(import.meta.dirname, "..");
const tag = "calendar-v0.6.8";
const target = "calendar-hackathon";
const publish = process.argv.includes("--publish");
const files = [
  "apps/calendar/calendar.v0.6.8.neutron",
  "submission-assets/calendar-demo.mp4",
];

for (const file of files) {
  const bytes = await readFile(resolve(root, file));
  const digest = createHash("sha256").update(bytes).digest("hex");
  const size = (await stat(resolve(root, file))).size;
  console.log(`${digest}  ${file}  ${size} bytes`);
}

if ((await stat(resolve(root, files[0]))).size > 1_900_000) {
  throw new Error("Calendar exceeds the portal's 1.9 MB package limit");
}

if (!publish) {
  console.log(`\nChecks passed. To intentionally publish:\nCALENDAR_RELEASE_CONFIRM=${tag} npm run submission:calendar:release -- --publish`);
  process.exit(0);
}
if (process.env.CALENDAR_RELEASE_CONFIRM !== tag) {
  throw new Error(`Set CALENDAR_RELEASE_CONFIRM=${tag} to publish`);
}

const existing = spawnSync("gh", ["release", "view", tag, "--repo", "skilesare/neutron"], {cwd: root, stdio: "ignore"});
if (existing.status === 0) throw new Error(`GitHub release ${tag} already exists; refusing to replace it`);
const result = spawnSync("gh", [
  "release", "create", tag,
  ...files,
  "--repo", "skilesare/neutron",
  "--target", target,
  "--title", "Calendar 0.6.8 — Neutron hackathon candidate",
  "--notes-file", "submission/RELEASE_NOTES.md",
], {cwd: root, stdio: "inherit"});
if (result.status !== 0) process.exit(result.status ?? 1);
