#!/usr/bin/env node
import {createHash} from "node:crypto";
import {readFile, stat} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {resolve} from "node:path";

const root = resolve(import.meta.dirname, "..");
const tag = "rendezvous-v0.3.0";
const target = "rendezvous-hackathon";
const publish = process.argv.includes("--publish");
const files = [
  "apps/kernel/kernel.v0.3.13.neutron",
  "apps/contacts/contacts.v0.3.1.neutron",
  "apps/calendar/calendar.v0.2.0.neutron",
  "apps/rendezvous/rendezvous.v0.3.0.neutron",
  "submission-assets/rendezvous-demo.mp4",
];

const expected = new Map([
  [files[0], "fd62a090014de2636c8b9774aa327f7cc95f20d4f1922c1d30990cb5082b1488"],
  [files[1], "19591c8db038db92c182b70ce0761e855efc1e7e7f37d3b1503866baa11d097a"],
  [files[2], "8e95eb974ed2025b94a4be21611ee79d5aa5c44a7ba394b7c46fd4db08db15c1"],
  [files[3], "85a6893c2bed02c20ff45a8c15560a5a9c3432967a6cc6d0f8e8504a7c78840f"],
  [files[4], "1cdf152366cae15536b8d9b5f6a2967c107ca88ce37ca685af5f1ce2b9f7baaa"],
]);

for (const file of files) {
  const bytes = await readFile(resolve(root, file));
  const digest = createHash("sha256").update(bytes).digest("hex");
  const size = (await stat(resolve(root, file))).size;
  const expectedDigest = expected.get(file);
  if (expectedDigest && digest !== expectedDigest) throw new Error(`${file} changed: ${digest}`);
  console.log(`${digest}  ${file}  ${size} bytes`);
}

const rendezvousSize = (await stat(resolve(root, files[3]))).size;
if (rendezvousSize > 1_900_000) throw new Error("Rendezvous exceeds the portal's 1.9 MB package limit");

if (!publish) {
  console.log(`\nChecks passed. To create the GitHub release intentionally:\nRENDEZVOUS_RELEASE_CONFIRM=${tag} npm run submission:rendezvous:release -- --publish`);
  process.exit(0);
}
if (process.env.RENDEZVOUS_RELEASE_CONFIRM !== tag) throw new Error(`Set RENDEZVOUS_RELEASE_CONFIRM=${tag} to publish`);

const existing = spawnSync("gh", ["release", "view", tag, "--repo", "skilesare/neutron"], {cwd: root, stdio: "ignore"});
if (existing.status === 0) throw new Error(`GitHub release ${tag} already exists; refusing to replace it`);

const result = spawnSync("gh", [
  "release", "create", tag,
  ...files,
  "--repo", "skilesare/neutron",
  "--target", target,
  "--title", "Rendezvous 0.3.0 — Neutron hackathon candidate",
  "--notes-file", "submission/RELEASE_NOTES.md",
], {cwd: root, stdio: "inherit"});
if (result.status !== 0) process.exit(result.status ?? 1);
