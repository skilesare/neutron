#!/usr/bin/env node
import {createHash} from "node:crypto";
import {readFile, stat} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {resolve} from "node:path";

const root = resolve(import.meta.dirname, "..");
const tag = "rendezvous-v0.3.1";
const target = "rendezvous-hackathon";
const publish = process.argv.includes("--publish");
const files = [
  "apps/kernel/kernel.v0.3.17.neutron",
  "apps/contacts/contacts.v0.3.1.neutron",
  "apps/calendar/calendar.v0.2.0.neutron",
  "apps/rendezvous/rendezvous.v0.3.1.neutron",
  "submission-assets/rendezvous-demo.mp4",
];

const expected = new Map([
  [files[0], "73562b715b3e61d319e7e8c8aa9f953ac01e81f1dc113afded64f2ce0da4896b"],
  [files[1], "19591c8db038db92c182b70ce0761e855efc1e7e7f37d3b1503866baa11d097a"],
  [files[2], "8e95eb974ed2025b94a4be21611ee79d5aa5c44a7ba394b7c46fd4db08db15c1"],
  [files[3], "52e663f56daba68fb7a38a3be11186acde0516dd82c97b52c0352ec7c535816f"],
  [files[4], "19ad9b022484985e7d6be110c3d2814855068c6ae020c6c2b83574c35ab63199"],
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
  "--title", "Rendezvous 0.3.1 — Neutron hackathon candidate",
  "--notes-file", "submission/RELEASE_NOTES.md",
], {cwd: root, stdio: "inherit"});
if (result.status !== 0) process.exit(result.status ?? 1);
