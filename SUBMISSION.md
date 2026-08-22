# Calendar submission runbook

Calendar is the week-one Neutron hackathon entry. It is a standalone app with
no required app dependencies and installs on the stock Kernel.

## Submission copy

**Title:** Calendar

**Short pitch:** A full-featured calendar inside your personal Neutron.

**Summary:** Calendar provides month, week, day, and agenda views; drag and
resize; recurring series and exceptions; all-day events; busy/free state;
colors, notes, locations, timezone-aware editing, responsive layouts, and
bounded availability queries without exposing private event details.

**Source:** https://github.com/skilesare/neutron/tree/calendar-hackathon

**Demo video after release:**
https://github.com/skilesare/neutron/releases/download/calendar-v0.2.0/calendar-demo.mp4

Machine-readable portal values are in `submission/hackathon-entry.json`.

## Candidate artifact

Upload `apps/calendar/calendar.v0.2.0.neutron`. Calendar is independently
useful and requires neither Contacts nor Rendezvous. Those apps can optionally
compose with its bounded availability interface in a separate submission.

## Verification

```sh
npm install
npm --workspace neutron-calendar test
npm run submission:calendar:screenshots
npm run submission:calendar:video
npm run submission:calendar:release
npm run submission:calendar:portal -- --check
```

The release command is a dry run unless `--publish` and the printed exact
confirmation variable are both supplied. The portal command's `--check` mode
is headless and non-mutating. Interactive mode waits for the owner to complete
Internet Identity/Profile setup, fills the draft, uploads assets, and leaves
the final **Submit app** click to the owner.

## Demo assets

The five portal screenshots are real Playwright captures covering week and
month layouts, recurrence, event details, and the mobile agenda. The 60-second
Remotion project in `submission-video/` uses those captures and is fully
captioned, so it works without audio.

## Final sequence

1. Review the Calendar-only diff and commit on `calendar-hackathon`.
2. Push that branch.
3. Publish the guarded GitHub release containing the package and demo video.
4. Run `npm run submission:calendar:portal`, complete portal authentication,
   and return to the terminal so the script can fill the draft.
5. Review every field and upload, then click **Submit app** manually.

## Human checklist

- [x] Calendar works as a standalone app on the stock Kernel.
- [x] Package and icon fit the portal limits.
- [x] Five real-product screenshots fit the portal limits.
- [x] Calendar-only Remotion source and cover render successfully.
- [ ] Final branch is reviewed and pushed.
- [ ] GitHub release and public demo-video link exist.
- [ ] Hacker role, reward wallet, and consent are configured.
- [ ] Portal entry is manually reviewed and submitted.
