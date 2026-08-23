# Rendezvous submission runbook

Rendezvous is the Neutron hackathon entry. Contacts and Calendar are required
app dependencies. The direct-media preview also requires the attached custom
Kernel 0.3.13; obtain organizer approval before presenting that Kernel as an
ordinary installable app submission.

## Submission copy

**Title:** Rendezvous

**Short pitch:** Private peer-to-peer scheduling for sovereign personal clouds.

**Summary:** Each person's Calendar filters availability locally; only selected
candidate times cross a paid, caller-bound Neutron route. Contacts supplies
locally trusted peer names, holds and revision checks prevent double-booking,
and an experimental Kernel-brokered WebRTC surface connects confirmed
participants directly in the browser.

**Source:** https://github.com/skilesare/neutron/tree/rendezvous-hackathon

**Demo video after release:**
https://github.com/skilesare/neutron/releases/download/rendezvous-v0.3.0/rendezvous-demo.mp4

The machine-readable portal values are in `submission/hackathon-entry.json`.

## Exact candidate artifacts

Install in this order on an isolated review Neutron:

1. `apps/kernel/kernel.v0.3.13.neutron` — custom Kernel replacement
2. `apps/contacts/contacts.v0.3.1.neutron`
3. `apps/calendar/calendar.v0.2.0.neutron`
4. `apps/rendezvous/rendezvous.v0.3.0.neutron`

```text
fd62a090014de2636c8b9774aa327f7cc95f20d4f1922c1d30990cb5082b1488  apps/kernel/kernel.v0.3.13.neutron
19591c8db038db92c182b70ce0761e855efc1e7e7f37d3b1503866baa11d097a  apps/contacts/contacts.v0.3.1.neutron
8e95eb974ed2025b94a4be21611ee79d5aa5c44a7ba394b7c46fd4db08db15c1  apps/calendar/calendar.v0.2.0.neutron
85a6893c2bed02c20ff45a8c15560a5a9c3432967a6cc6d0f8e8504a7c78840f  apps/rendezvous/rendezvous.v0.3.0.neutron
1cdf152366cae15536b8d9b5f6a2967c107ca88ce37ca685af5f1ce2b9f7baaa  submission-assets/rendezvous-demo.mp4
```

Rendezvous is 933,992 bytes. The 78,757-byte icon and all six selected
screenshots fit the portal limits audited on 2026-08-23: one package up to
1.9 MB, one icon up to 100 KB, and up to six screenshots at 400 KB each.
The custom Kernel archive is 2,035,320 bytes and is therefore a release/review
artifact, not the portal's Rendezvous package upload.

## What the demo proves

- Alice chooses exact proposal times; the app does not randomly schedule.
- Bob sees Alice's locally trusted Contacts name and exact Neutron principal.
- Each Calendar privately revalidates availability and both owners explicitly
  confirm the selected time.
- Holds, revisions, durable commands, and exact retries protect against stale
  state, conflicts, uncertain delivery, and duplicate execution.
- Confirmed participants can approve a nonce-origin media iframe and connect
  browser-to-browser. Calendar data and contact labels do not enter signaling.
- There is no Rendezvous service canister, shared account system, or shared
  calendar database.

## Verification

From the repository root:

```sh
npm install
npm --workspace neutron-calendar test
npm --workspace neutron-rendezvous test
MOTOKO_TEST=public_ingress_service_test.mo,backend_calls_test.mo npm --workspace neutron-kernel exec -- bun test/motoko/run.ts
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
flag it opens a persistent headed Playwright browser, waits while the owner
completes Internet Identity/Profile setup, fills the draft, uploads assets, and
leaves the final **Submit app** click to the owner.

## Demo assets

The six portal screenshots configured in `submission/hackathon-entry.json`
show the sent proposal, verified sender identity, both confirmed Calendars,
meeting detail, and direct video connection. Regenerate them from a freshly
installed Alice/Bob fleet with:

```sh
npm run submission:rendezvous:screenshots
```

The 60-second Remotion project lives in `submission-video/` and renders to
`submission-assets/rendezvous-demo.mp4`. It uses real product screenshots and
is captioned so it works without audio.

## Release and portal sequence

1. Get an explicit organizer answer on whether the custom Kernel/media preview
   is eligible. If not, submit the stock-Kernel-compatible v0.2.1 scheduling
   app and describe direct media as future work.
2. Review `git diff`, commit, and push `rendezvous-hackathon`.
3. Create the GitHub release with the four archives and demo MP4.
4. Run `npm run submission:rendezvous:portal`, complete Internet Identity,
   Hacker role, wallet, and consent, then return to the terminal.
5. Review every auto-filled field and uploaded asset in the browser. Click
   **Submit app** manually.
6. Confirm moderation approval before the portal's final-hour content freeze.

## Compatibility and limitations

Rendezvous 0.3.0 declares the experimental `media_sessions` capability, so it
does not install on upstream Kernel 0.3.12. Kernel 0.3.13 is a deliberate core
change implementing owner-approved, revocable, ephemeral media authority; it
is not a forked network or a centralized meeting server.

The current WebRTC path has no STUN/TURN relay and is only claimed to connect
when host ICE candidates are mutually reachable. This is a hackathon preview,
not a production conferencing service. Calendar supports bounded local
recurrence but does not sync external calendars or send email notifications.

## Final human checklist

- [x] Public source branch exists.
- [x] Final Rendezvous package is under the portal limit.
- [x] LLM-generated product icon is under 100 KB.
- [x] Six current real-product screenshots are under 400 KB each.
- [x] 60-second demo video renders from repository sources.
- [x] Release and portal automation have non-mutating check modes.
- [ ] Organizer approves the custom Kernel/media capability for judging.
- [ ] Final changes are reviewed, committed, and pushed.
- [ ] GitHub release and public demo-video link exist.
- [ ] Hacker role, reward wallet, and consent are configured.
- [ ] Portal entry is manually reviewed, submitted, and moderator-approved.
