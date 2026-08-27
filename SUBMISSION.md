# Rendezvous submission runbook

Rendezvous is the Neutron hackathon entry. Contacts and Calendar are app
dependencies. Direct calls use the owner's upstream Kernel 0.3.17 release; no
custom Kernel fork is required.

## Submission copy

**Title:** Rendezvous

**Short pitch:** Private peer-to-peer scheduling for sovereign personal clouds.

**Summary:** Each person's Calendar filters availability locally; only selected
candidate times cross a paid, caller-bound Neutron route. Contacts supplies
locally trusted peer names, holds and revision checks prevent double-booking,
and Neutron's tile-scoped browser capability lets confirmed participants
connect directly with WebRTC.

**Source:** https://github.com/skilesare/neutron/tree/rendezvous-hackathon

**Demo:** https://github.com/skilesare/neutron/releases/download/rendezvous-v0.3.1/rendezvous-demo.mp4

The machine-readable portal values are in `submission/hackathon-entry.json`.

## Exact candidate artifacts

Install in this order on an isolated review Neutron:

1. `apps/kernel/kernel.v0.3.17.neutron` — owner's upstream Kernel release
2. `apps/contacts/contacts.v0.3.1.neutron`
3. `apps/calendar/calendar.v0.2.0.neutron`
4. `apps/rendezvous/rendezvous.v0.3.1.neutron`

```text
73562b715b3e61d319e7e8c8aa9f953ac01e81f1dc113afded64f2ce0da4896b  apps/kernel/kernel.v0.3.17.neutron
19591c8db038db92c182b70ce0761e855efc1e7e7f37d3b1503866baa11d097a  apps/contacts/contacts.v0.3.1.neutron
8e95eb974ed2025b94a4be21611ee79d5aa5c44a7ba394b7c46fd4db08db15c1  apps/calendar/calendar.v0.2.0.neutron
52e663f56daba68fb7a38a3be11186acde0516dd82c97b52c0352ec7c535816f  apps/rendezvous/rendezvous.v0.3.1.neutron
19ad9b022484985e7d6be110c3d2814855068c6ae020c6c2b83574c35ab63199  submission-assets/rendezvous-demo.mp4
```

Rendezvous is 835,451 bytes, below the 1.9 MB portal package limit. All six
selected screenshots are below 81 KB. `npm run submission:rendezvous:release`
rejects any byte drift before publication.

## What the demo proves

- Alice chooses exact proposal times; the app does not randomly schedule.
- Bob sees Alice's locally trusted Contacts name and exact Neutron principal.
- Each Calendar privately revalidates availability and both owners explicitly
  confirm the selected time.
- Holds, revisions, durable commands, and exact retries protect against stale
  state, conflicts, uncertain delivery, and duplicate execution.
- Confirmed participants explicitly start devices inside the visible
  Rendezvous tile and connect browser-to-browser. Calendar data and contact
  labels do not enter signaling.
- There is no Rendezvous service canister, shared account system, shared
  calendar database, or meeting-media server.

## Verification

```sh
npm install
npm --workspace neutron-calendar test
npm --workspace neutron-rendezvous test
npm --workspace neutron-kernel run package
npm run test:e2e:rendezvous:fresh
npm run test:e2e:calendar-upgrade:fresh
npm run test:e2e:submission-install:fresh
npm run submission:rendezvous:screenshots
npm run submission:rendezvous:video
npm run submission:rendezvous:release
npm run submission:rendezvous:portal -- --check
```

The release command is a dry run by default. Publishing additionally requires
`--publish`, the exact `RENDEZVOUS_RELEASE_CONFIRM` value printed by the dry
run, and explicit owner authorization.

The portal command's `--check` mode is headless and non-mutating. Without that
flag it opens a persistent headed Playwright browser, waits for the owner to
complete Internet Identity/Profile setup, fills the draft, uploads assets, and
leaves the final **Submit app** click to the owner.

## Media capability and limitations

Rendezvous 0.3.1 declares API-1 `browser_permissions` for camera and microphone
on tile `main`. Kernel 0.3.17 discloses the capability during install and grants
it only to that exact isolated tile origin. Devices remain off until a user
clicks **Start camera & microphone**. Calendar receives neither permission.

The current WebRTC path has no STUN/TURN relay and is only claimed to connect
when host ICE candidates are mutually reachable. It is a direct-connect
preview, not production conferencing. Calendar supports bounded local
recurrence but does not sync external calendars or send email notifications.

Rendezvous keeps persistent memory schema v2 and its released v1-to-v2
migration lineage. The v0.3.1 release changes app/frontend bytes without
inventing a memory migration or resetting installed data.

## Release and portal sequence

1. Review the diff, memory evidence, test results, and final artifact hashes.
2. Commit and push `rendezvous-hackathon`.
3. Create the GitHub `rendezvous-v0.3.1` release with four archives and MP4.
4. Run the portal assistant against the existing Rendezvous entry.
5. Review every field and upload, then submit manually.
6. Confirm moderator approval and the updated public demo link.

Production catalog publication is a separate durable release operation and is
not implied by the hackathon GitHub release or portal resubmission.
