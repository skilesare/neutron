# Calendar P0/P1 implementation workplan

Status: P0 and P1 import/undo/reminder implementation and automated Calendar qualification complete through 0.6.6; the subscription-feed decision and manual interoperability/Agent acceptance remain release gates
Created: 2026-08-31
App branch: `calendar-hackathon`
Current production Calendar release: 0.2.0 (`version` `200`)
Unpublished P0 candidate: Calendar 0.3.0 (`version` `300`)
Unpublished import candidate: Calendar 0.5.0 (`version` `500`), `calendar` schema v4
Unpublished reminder candidate: Calendar 0.6.6 (`version` `606`), `calendar` schema remains v4
Current production Calendar memory: `calendar` schema v2
Current working Kernel baseline: 0.3.22
Upstream synchronized for implementation: `infu/neutron` `ccf8595`
Latest upstream Agent at planning time: 0.3.9, including opt-in OpenRouter web tools

This is the execution plan for Calendar P0 and P1 product work. It is written
for an LLM coding agent that may begin with no conversational context. Work the
checkboxes in order. Do not publish production packages merely because a build
passes; the release gates near the end are mandatory.

## 1. Product objective

Turn Calendar 0.2.0 from a strong private scheduling foundation into a useful,
interoperable Neutron calendar that:

1. exports standards-based iCalendar data;
2. imports `.ics` files through a reviewable, atomic workflow;
3. can be searched and operated safely by both its owner and Neutron Agent;
4. handles time zones and scheduling preferences honestly;
5. optionally exposes a revocable calendar-subscription URL;
6. provides upcoming-event reminders through Neutron's resident/tray model; and
7. makes bulk changes reversible without weakening Calendar/Rendezvous privacy.

P0 is the first releasable increment. P1 builds on P0 and may be released
separately. Do not combine release numbers or schema changes casually.

## 2. Scope

### P0 — Calendar 0.3.0 target

- Correct time-zone behavior and complete the existing scheduling-preference UI.
- Export one event, one selected range, or the whole calendar as `.ics`.
- Add bounded backend event search and owner-facing search/filter UI.
- Add a resident Calendar endpoint with semantic, Agent-friendly read/write
  tools over the existing Calendar authority.
- Merge the current upstream Agent so natural-language workflows can use Agent
  0.3.9's opt-in web search and then call Calendar tools.
- Preserve the released `calendar` memory root at schema v2 and add no P0 memory
  root or backend capability. The production Kernel cannot add certified-assets
  to Calendar while retaining its 0.2 installation scope. Optional file delivery
  must therefore use the existing Files app through an owner-approved frontend
  tool call. Never edit the released calendar v2 schema or migration lineage.

### P1 — successive Calendar 0.4.0+ candidates

- Import `.ics` with parse diagnostics, preview, deduplication, bounded atomic
  commit, and no silent partial success.
- Add a default-off, revocable certified `.ics` subscription feed with
  Busy/Free, titles-and-times, and full-detail disclosure modes.
- Add resident/tray reminders and an upcoming-event badge.
- Add durable bounded bulk-operation receipts and safe undo.
- Add memory schema v3 and an explicit v2-to-v3 migration for the P1 foundation.
- Add schema v4 and an explicit v3-to-v4 migration when import undo needs
  revision-aware receipt preimages. Never edit or relabel the locked v3 source.

### Explicit non-goals for P0/P1

- Google OAuth, Microsoft OAuth, Google Calendar API, or Microsoft Graph sync.
- Two-way cloud synchronization or external conflict resolution.
- Multiple local calendars, shared editable calendars, CalDAV, email invites,
  RSVP processing, or attendee mail delivery.
- OS/browser push notifications. P1 reminders use the Neutron tray and work only
  while the authorized Neutron frontend/background is running.
- Sending private Calendar contents to OpenRouter web search. Agent web search is
  only for public internet information.
- Any Kernel source, manifest, package, or sandbox-policy change. Calendar must
  use only capabilities already supported by the current production Kernel.

## 3. Existing architecture and invariants

Read these before changing code:

- `AGENTS.md`
- `apps/calendar/README.md`
- `apps/calendar/neutron.json`
- `apps/calendar/neutron.lock.json`
- `apps/calendar/src/index.tsx`
- `apps/calendar/src/recurrence.ts`
- `apps/calendar/backend/main.mo`
- `apps/calendar/backend/Availability.mo`
- `apps/calendar/backend/AvailabilityV2.mo`
- `apps/calendar/backend/Validation.mo`
- every file under `apps/calendar/backend/memory/calendar/`
- `doc/memory-migrations-and-uninstall.md`
- `doc/app-method-access-and-call-consent.md`
- `doc/kernel-app-communication.md`
- `doc/app-tray.md`
- `doc/kernel-http-v2-and-certified-assets.md`
- upstream `apps/agent/README.md` and
  `apps/agent/src/openrouter_web_tools.ts`

Binding invariants:

- Calendar managed memory is private and authoritative. Never publish an ICS
  feed unless the owner explicitly enables it and chooses its disclosure mode.
- Existing released schema files and migrations are immutable history. Never
  edit v1, v2, or `v1_to_v2.mo` after release.
- Rendezvous receives only bounded availability answers and explicitly handed
  scheduling ranges. Do not expose private event metadata through availability.
- Rendezvous-owned confirmed events remain read-only in Calendar.
- UTC nanoseconds remain authoritative. Local wall time and an IANA time-zone ID
  define recurrence intent.
- All-day end dates are exclusive.
- Calendar mutations use expected revisions and fail on stale state.
- Imported or Agent-created bulk operations are bounded and atomic.
- A transport failure after a state-changing tool call is not automatically
  retry-safe. Provide read/status reconciliation methods.
- Do not rebuild or republish Calendar 0.2.0 with different bytes.
- Every changed production package needs a strictly higher app release version.

## 4. Known defects to fix during P0

The existing `display_time_zone` setting is misleading:

- the UI formats dates in the browser timezone;
- FullCalendar is not configured from the saved preference;
- new series use `detectedZone` rather than the saved preference; and
- backend validation checks only text length, not whether the value is a usable
  IANA timezone.

The backend also stores `slot_increment_minutes`, `buffer_before_minutes`, and
`buffer_after_minutes`, but the UI does not expose them. FullCalendar's
`slotDuration` and `snapDuration` are hardcoded to 15 minutes.

The current UI fetches a buffered window of as much as 366 days and up to 2,000
occurrences. Search must not pretend that this loaded subset is the full
calendar.

## 5. Delivery strategy

Use independently versioned increments:

- Calendar 0.3.0: P0, memory remains v2.
- Calendar 0.4.0: P1 memory foundation, memory advances to v3.
- Calendar 0.5.0: P1 import/undo, memory advances to v4.
- Future reminder or companion-feed package-byte changes require another
  strictly higher release version; never fold different bytes into 0.5.0.

If both increments are implemented before any production publication, still
retain two logical commits and test gates. Publication may ship only the higher
release if repository policy permits skipping 0.3.0, but the v2-to-v3 migration
and exact final version must remain valid. Never publish two different byte
archives under the same version.

## 6. Phase 0 — synchronize and establish a baseline

- [x] Confirm all worktrees and branches with `git worktree list`, `git status`,
  and `git branch -vv`. Preserve unrelated user changes.
- [x] Fetch `upstream/main` and record its exact commit in this file.
- [x] Merge current upstream into `calendar-hackathon`; preserve Calendar files
  and submission assets that do not exist upstream.
- [x] Resolve root `package.json` and `package-lock.json` by retaining both the
  upstream workspaces/scripts and Calendar workspace/scripts. Never resolve the
  lockfile by deleting either Calendar or upstream apps.
- [x] Confirm the merge includes Agent 0.3.9 or later and its opt-in web tools.
- [x] Run the unchanged Calendar baseline:
  - `npm --workspace neutron-calendar run validate`
  - build `neutron-design-system`, then Calendar
  - `bun test apps/calendar/test`
  - `npm --workspace neutron-calendar run test:memory`
  - `npm --workspace neutron-calendar run test:domain`
- [x] Record baseline package size and exact Calendar 0.2.0 release SHA-256.
  Do not overwrite the release artifact.
- [x] Add a P0 test matrix before implementation so every existing behavior is
  explicitly preserved.

Exit gate: clean upstream merge; all existing Calendar tests pass; no Calendar
schema, manifest version, or release artifact changed.

Phase 0 evidence (2026-08-31):

- Authoritative implementation worktree: repository root on
  `calendar-hackathon` at
  `/Users/afat/Dropbox/development/Rivvir/neutron_demo`.
- `calendar-hackathon` merged `upstream/main` at `ccf8595` without Calendar
  source conflicts. The merge commit is `8e63fd6`.
- Root workspace and lockfile retain both `neutron-calendar` and upstream
  `neutron-blast`; Agent manifest version is `309`, and
  `apps/agent/src/openrouter_web_tools.ts` is present.
- Baseline validation/build, 19 Bun tests, memory restoration, availability,
  Calendar domain, v2 series, and v1-to-v2 migration tests all passed.
- Immutable GitHub Calendar 0.2.0 asset: 766,354 bytes,
  SHA-256 `e097e9c955e78569675baebc7bcc38138d082e8874695aed01dbba4a96a10817`.
- Regression matrix: `.plan/calendar-p0-test-matrix.md`.
- Rendezvous remains protected on `rendezvous-hackathon`; Calendar commits must
  use explicit paths and must never stage the untracked Rendezvous app/media
  visible while this Calendar-only branch is checked out.

## 7. Phase 1 — P0 time-zone and scheduling-preference correctness

### 7.1 Time-zone model

- [x] Add a pure frontend timezone module. It must:
  - validate names using `Intl.DateTimeFormat` rather than accepting arbitrary
    text as an effective zone;
  - expose a supported-zone list using `Intl.supportedValuesOf("timeZone")`
    with a bounded fallback for browsers that lack it;
  - convert between UTC instants and local editor fields in the selected zone;
  - distinguish DST gaps from folds and require a deterministic resolution;
  - never silently fall back to the browser zone after a preference was saved.
- [x] Replace the free-text timezone input with a searchable IANA timezone
  selector. Clearly label the browser-detected timezone as a suggestion.
- [x] Configure FullCalendar and every displayed date/time formatter from the
  saved `display_time_zone`.
- [x] Use the saved timezone when creating or changing a series.
- [x] On a timezone preference change, do not shift existing authoritative UTC
  instants. It changes presentation/default recurrence intent only.
- [x] Preserve the current recurrence DST gap/fold warnings.

### 7.2 Complete scheduling preferences

- [x] Add controls for scheduling increment, buffer before, and buffer after.
- [x] Bind FullCalendar `slotDuration` and `snapDuration` to the saved increment.
- [x] Validate values in both frontend and backend using the existing bounds.
- [x] Explain that buffers affect availability suggestions, not visible event
  duration or the ability to create an owner event.
- [x] Add unsaved-change indication and disable Save until preferences are valid.

### 7.3 Tests

- [x] Unit-test UTC/local conversion in at least UTC, America/Chicago,
  America/New_York, Europe/London, and Asia/Kolkata.
- [x] Test spring-forward gaps, fall-back folds, all-day dates, and timezone
  changes after events exist.
- [x] Test 5, 15, 30, 60, and 120 minute increments and maximum buffers.
- [x] Add Playwright coverage proving the grid, editor, recurrence, and upcoming
  list display the same saved timezone.

Exit gate: saved timezone controls all presentation and new-series recurrence;
no regression in existing Calendar/Rendezvous behavior.

Phase 1 implementation evidence (automated portion, 2026-08-31):

- `src/time_zone.ts` uses browser `Intl` validation and deterministic earlier
  resolution for folds; gaps normalize forward with the existing warning path.
- FullCalendar runs on UTC display markers translated at every API boundary so
  standard FullCalendar can render an arbitrary saved IANA zone without adding
  a large timezone plugin. Authoritative UTC nanoseconds are unchanged.
- `Validation.validTimeZone` rejects malformed identifiers at the canister
  boundary; browser `Intl` remains the authority for whether an IANA name exists.
- The installed-package Playwright scenario runs with the browser deliberately
  set to America/Los_Angeles, saves Asia/Kolkata and Europe/London, and proves
  the editor, recurrence preview, Upcoming list, week grid, and saved increment
  agree. Both Calendar Playwright scenarios pass together in a clean local
  Neutron (2 passed, 59.1 seconds).

## 8. Phase 2 — P0 iCalendar export

### 8.1 Serializer

- [x] Add a small pure serializer, preferably `apps/calendar/src/ics.ts`. Do not
  add a large calendar dependency without package-size and license review.
- [x] Implement RFC 5545 escaping for backslash, comma, semicolon, and newlines.
- [x] Emit CRLF line endings and fold content lines at 75 octets without splitting
  UTF-8 code points.
- [x] Emit `VCALENDAR`, `VERSION:2.0`, a Neutron `PRODID`, and `CALSCALE:GREGORIAN`.
- [x] Emit stable `UID`, deterministic `DTSTAMP`, monotonic `SEQUENCE`, inclusive
  start/exclusive end, summary, description, location, and transparency.
- [x] Never include owner principal, authorization data, feed token, installation
  UID, or Rendezvous negotiation secrets in exported content.
- [x] Define stable UIDs from non-secret, stable Calendar data and the public
  canister identity. Document the privacy tradeoff. UIDs must not change between
  exports of the same event.
- [x] Preserve recurrence and exceptions. Before finalizing encoding, implement
  fixtures for both of these strategies and choose the one that Google and
  Outlook accept consistently:
  - master `RRULE` plus `EXDATE`/`RECURRENCE-ID`; or
  - exact bounded UTC `RDATE` materialization.
  Do not ship recurrence that shifts wall time across DST.
- [x] Encode cancelled occurrences so a later subscription revision removes or
  cancels them correctly.
- [x] Export tentative holds only when explicitly requested. The default export
  excludes expired holds and includes confirmed Rendezvous meetings without
  negotiation/signaling metadata.

### 8.2 State-preserving file delivery without a Kernel change

- [x] Add “Export event” to the event editor.
- [x] Add an Integrations/Export panel with “Export visible range” and “Export
  calendar.”
- [x] Retain the browser `Blob` implementation only as serializer/unit-test
  evidence. Do not use iframe-originated download as the installed delivery
  path: Kernel 0.3.22 correctly omits `allow-downloads` from app tiles.
- [x] Prove with the exact 0.2.0 package that adding certified-assets to retained
  Calendar scope is rejected by the production compiler. Do not change Kernel,
  reinstall Calendar, rotate its scope, or strand existing Calendar data.
- [x] Generate the complete bounded ICS snapshot in the owner tile and keep it
  only in volatile tile state.
- [x] Call the existing Files resident `write` tool at
  `app:files:background` after the Kernel shows the normal cross-app permission
  dialog. Save privately under `/Workspace/Calendar Exports/<safe-name>.ics`
  with `text/calendar; charset=utf-8`.
- [x] Treat Files as optional. If it is missing, unavailable, or permission is
  denied, retain the prepared snapshot in the current tile and expose
  **Copy iCalendar data** so the owner can save the exact plain-text bytes as
  the displayed `.ics` filename.
- [x] Add **Open Files** after a successful handoff and explain that the owner
  selects the file there to download or share it.
- [x] Never send the ICS body to Agent/model context, web search, application
  logs, telemetry, or Rendezvous. Files receives only the exact owner-approved
  export snapshot, never Calendar's database or authority.
- [x] Show exactly what will be exported and whether private details are included.
- [x] Keep one-event export usable on narrow/mobile layouts.

### 8.3 Tests

- [x] Add golden files for timed, all-day, free, recurring, overridden,
  cancelled, Unicode, escaped-text, and Rendezvous events.
- [x] Round-trip fixtures through at least one independent permissively licensed
  iCalendar parser used only in tests, or a maintained validation tool.
- [x] Test deterministic bytes for unchanged state.
- [x] Test line folding by UTF-8 bytes, CRLF output, stable UID, and SEQUENCE.
- [ ] Manually import fixtures into current Google Calendar and Outlook web.
  Record results and screenshots under a non-package test-evidence directory.

Exit gate: one-event, range, and full exports import correctly into Google and
Outlook; recurring times remain correct across DST.

Phase 2 implementation evidence (automated portion, 2026-08-31):

- `src/ics.ts` emits deterministic RFC 5545 data with CRLF, UTF-8-safe 75-octet
  folding, stable non-secret UIDs, exclusive all-day ends, privacy modes, and
  explicit hold/cancellation handling.
- `ical.js` independently parses the timed, all-day, free, cancelled, Unicode,
  escaped-text, and Rendezvous fixtures. A deterministic golden matrix also
  covers multi-occurrence recurrence, overridden events, tentative holds, and
  confirmed Rendezvous state; five ICS tests pass. Manual Google and Outlook
  web imports remain intentionally open.
- Real installed-package evidence corrected two architecture assumptions.
  Direct tile downloads are blocked by the current sandbox, and the exact
  production 0.2.0 update rejects adding certified-assets while retaining
  Calendar's installation scope. The state-preserving remedy is an ordinary
  owner-approved write to optional Files, with an in-memory copy fallback.
  The browser test verifies the saved Files path and the actual ICS contents.
  Kernel remains unchanged.

## 9. Phase 3 — P0 bounded backend search and UI filtering

- [x] Add a query such as `calendar_search_v1`; choose the final name once and
  retain it. Inputs must include bounded query text, optional time window,
  source/status/Busy-Free filters, cursor/offset, and limit.
- [x] Search authoritative series and occurrences, not only the loaded UI range.
- [x] Normalize case deterministically without locale-dependent backend behavior.
- [x] Bound query bytes, scan work, result count, and returned text. Maximum page
  should not exceed 100 results.
- [x] Return the Calendar revision and a continuation. A changed revision makes
  an older continuation stale and forces restart.
- [x] Do not expose search through `internal:apps`; owner/Agent access must travel
  through normal Kernel-regulated tools.
- [x] Add a debounced search field and filters for source, Busy/Free, date range,
  recurring, and Rendezvous.
- [x] Selecting a result opens the existing editor or Rendezvous details.
- [x] Add empty, loading, stale, truncated, and error states.
- [x] Test Unicode, maximum lengths, pagination, stale continuation, hidden
  cancelled/expired holds, and calendars at configured capacity.

Exit gate: the owner can find events outside the currently rendered year and
search results never bypass privacy or revision checks.

Phase 3 implementation evidence (2026-08-31):

- The backend scans at most 2,000 authoritative occurrences per call, returns
  at most 100 matches, carries revision/continuation state, rejects stale or
  malformed continuations, and hides cancelled and expired-hold occurrences.
- Search crosses the generic Neutron self-call bridge as one bounded, strict
  hex-UTF-8 wire value. This avoids an installed-runtime icblast record encoder
  defect while keeping typed filters internal. Unit tests cover Unicode and
  malformed transport values.
- Installed-package Playwright caught and fixed the live bridge's omitted
  absent-option representation (`undefined` rather than `null` or `[]`). The
  screenshot scenario now creates events and reopens them through authoritative
  search successfully.

## 10. Phase 4 — P0 semantic Calendar tools for Agent

### 10.1 Resident architecture

- [x] Add `apps/calendar/public/service.html` and
  `apps/calendar/src/service.ts`.
- [x] Declare one ordinary `background` endpoint in `neutron.json`. Do not add
  persistent browser storage unless a concrete resident state requirement is
  documented; backend memory remains authoritative.
- [x] Use `exposeTool` with explicit JSON input/output schemas, descriptions,
  read/write effects, timeouts, and bounded values.
- [x] Wrap backend calls; do not make Agent construct Motoko variants or UTC
  nanoseconds directly.
- [x] Accept RFC 3339 timestamps plus explicit IANA timezone where local wall
  time is relevant. Return RFC 3339 plus stable IDs and revisions.

### 10.2 Required tools

- [x] `calendar.status` — read revision, counts, timezone, and capabilities.
- [x] `calendar.search_events` — bounded read using Phase 3 search.
- [x] `calendar.get_event` — read one series plus requested occurrence.
- [x] `calendar.list_schedule` — bounded range read.
- [x] `calendar.find_free_time` — bounded owner-only suggestions without leaking
  unrelated event details.
- [x] `calendar.create_event` — create one reviewed one-time or recurring event.
- [x] `calendar.update_event` — expected-revision update with explicit scope.
- [x] `calendar.delete_event` — expected-revision delete with explicit scope.
- [x] `calendar.export_event` — return a bounded attachment or an owner-openable
  export action; never dump an entire private calendar into model text.

### 10.3 Agent safety and tests

- [x] Tool descriptions must tell Agent to search the public web without private
  Calendar contents and then pass only owner-requested public facts into a
  Calendar preview/create call.
- [x] State-changing tools must expose reconciliation instructions and must not
  claim retry safety after unknown dispatch.
- [x] Add service tests following `apps/contacts/src/service.ts` and its tests.
- [x] Add deterministic Agent qualification using a local driver/fake model; CI
  must not depend on OpenRouter or a real API key.
- [ ] Manually verify with Agent 0.3.9:
  - create a simple event from natural language;
  - find an event;
  - web-search a public event, preview the exact proposed Calendar values, and
    add it only after owner intent is clear;
  - deny an unrelated permission request;
  - reconcile an injected ambiguous write failure.

Exit gate: Agent can reliably inspect and mutate Calendar through semantic
tools without being taught Calendar-specific logic inside Agent itself.

Phase 4 implementation evidence (automated portion, 2026-08-31):

- Nine semantic tools are registered from the Calendar background endpoint and
  use only scoped `querySelf`/`updateSelf` authority.
- Handler-level tests cover normalized reads, privacy-minimal free-time output,
  create/delete dispatch, revision-scoped mutation, and invalid series edits.
- Deterministic fake-model qualification creates and finds an event and proves
  an ambiguous write is reconciled without retry. Real Agent 0.3.9 interaction
  checks remain open because they require an owner-driven browser session.

## 11. P0 release gate — Calendar 0.3.0

- [x] Confirm managed-memory schema remains v2 and restoration is tested.
- [x] Increase `apps/calendar/neutron.json` release version from `200` to `300`.
- [x] Keep production `update_source` equal to
  `233tv-xiaaa-aaaay-aacta-cai` when preparing a production package.
- [x] Update README, NOTICE/third-party notices, method schemas, lock lineage,
  release notes, screenshots, and package-size expectations.
- [x] Run the complete Calendar package command and all app-specific tests.
- [x] Test a clean install and a state-preserving upgrade from exact production
  Calendar 0.2.0 with representative one-time, recurring, exception, all-day,
  free, hold, and confirmed Rendezvous data.
- [x] Verify upgrade does not alter stored data merely because the display
  timezone implementation changed.
- [ ] Review the final `.neutron` archive, offered-source artifact, SHA-256, and
  size. Re-run from a clean checkout to test reproducibility where supported.
- [ ] STOP before `npm run updates:publish`. Production publication requires an
  explicit owner decision and the complete `AGENTS.md` publish/no-op receipt
  workflow.

P0 release-gate evidence (updated 2026-09-01):

- `npm --workspace neutron-calendar test` passes: package/validation, 46 Bun
  tests, memory restoration, and every Motoko validation, availability, domain,
  series, search, and v1-to-v2 migration program.
- Candidate package: 428,234 bytes; SHA-256
  `30b0d9b00572e48235a586abc6a2d3704976c907971017d92a670b52dc158cbe`;
  backend app entry
  `1061f46c56ab213263720d20cd6e17a5cab7d334d97c942fdc68abf5722e03e8`.
  Matching offered source: 451,300 bytes; SHA-256
  `402fbfffbcb4d35ef3984a8e8e45588470497805e3a4d7f9d3ef41f2add2ce80`.
  The package record identifies Calendar version 300, production update source,
  use-only application license, unchanged Calendar v2 memory lineage, and the
  digest-addressed source offer.
- Clean installed-package `calendar-p0-gates.spec.ts`: 4 passed in 23.8s. It
  covers narrow keyboard create/search/edit, owner-approved Calendar-to-Files
  ICS save and content inspection, authorization removal/logout, and Calendar +
  Agent 0.3.9 resident coexistence.
- Exact released Calendar 0.2.0 archive: 766,354 bytes; SHA-256
  `e097e9c955e78569675baebc7bcc38138d082e8874695aed01dbba4a96a10817`.
  The reviewed in-product 0.2.0 → 0.3.0 upgrade passed in 28.9s. It retained the
  installation UID and exact memory inventory and preserved timed details,
  absolute instants, a weekly/free series, an overridden occurrence, location,
  notes, and an all-day event.
- The separate two-Neutron Rendezvous upgrade fixture remains available to
  re-run against the final bytes; its assertions now require the same unchanged
  memory inventory rather than a removed export root. No Rendezvous source or
  media is part of the Calendar change set.
- Source/privacy tests prove Calendar has no application logging sink,
  privacy-mode ICS excludes private and signaling/auth metadata, and Agent export
  returns only an owner-openable action rather than model-visible ICS.
- Disposable PocketIC fixtures alone use reinstall for clean initialization.
  The production-shaped upgrade uses the in-product update action and never
  reinstalls state. Manual Google/Outlook import, live owner-driven Agent checks,
  final reproducibility review, commit/push, and explicit publication approval
  remain. Nothing has been published.

## 12. Phase 5 — P1 memory schema v3 design and migration

The owner directed P1 implementation to continue while the external/manual P0
checks remain open. Those checks still block release; they do not idle local
implementation and automated qualification.

- [x] Copy the immutable v2 types into a new
  `backend/memory/calendar/v3.mo`; never edit v2.
- [x] Add only fields required by accepted P1 features. Expected additions:
  - import provenance: external UID, sequence, and last imported digest;
  - bounded reminder offsets;
  - subscription preference/status only if a separately installed feed
    companion is approved; that companion owns all locator, bearer, certified
    publication, and reconciliation state;
  - bounded bulk-operation/undo receipts.
- [x] Keep feed bearer material out of public views, logs, Agent results, and
  exported ICS bodies.
- [x] Add `v2_to_v3.mo` with a deterministic bounded migration.
- [x] Existing series migrate with no import provenance, no reminders, feed
  disabled, and an empty undo journal.
- [x] Add `2 -> 3` to `neutron.json`, update backend usage, and regenerate the
  lock only through the normal package workflow.
- [x] Test clean v3 initialization, exact production v2 restoration followed by
  migration, maximum-size representative migration, and semantic equality of
  every pre-existing event and preference.

Exit gate: v2 data migrates exactly; feed is off by default; no v1/v2 source was
modified.

Phase 5 evidence (2026-09-01):

- `v3.mo` preserves the complete v2 event/preference model and adds only
  namespaced import provenance, one-offset reminder records, and bounded-shape
  bulk undo receipts. No subscription locator, bearer token, or publisher state
  is stored because no companion publisher has been approved.
- `v2_to_v3.mo` transfers every existing field directly and initializes all
  three P1 collections empty. Immutable v1, v2, and v1-to-v2 sources retain
  their released hashes.
- Generated schema v3 hash:
  `837ec1952dd080b3fc418c2bbd332bb0d79f16345b2f02a97c60622f9530c916`;
  migration 2-to-3 hash:
  `2fdf59e28dfb0654092b452a495f24a1678b62a74d61059885a157abacda6818`.
- The complete Calendar package/unit/domain suite passes, including clean v3,
  representative semantic equality, and configured maximum-capacity migration
  for 2,000 series and 10,000 occurrences.
- The in-product Playwright upgrade from the exact 0.2.0 archive to 0.4.0 passed
  in 30.1 seconds. It advanced Calendar memory v2 to v3 while retaining the
  installation UID, non-Calendar memory inventory, timed/all-day data,
  recurrence, exceptions, Busy/Free state, location, notes, and UTC instants.
  Reinstall was used only to initialize the disposable 0.2.0 fixture.
- The two-Neutron Rendezvous fixture also passed in 53.3 seconds using the
  canonical Calendar-branch 0.4.0 archive. Confirmed meetings and a deliberately
  interrupted live hold survived v2-to-v3 on both peers, remained identifiable
  as Rendezvous events, and retained their Calendar/Rendezvous handoff actions.
  `calendar-hackathon` remains the authoritative Calendar package builder; the
  combined branch is an integration/test branch and must not publish an
  independently rebuilt Calendar package under the same version.

## 13. Phase 6 — P1 ICS import, preview, atomic commit, and undo

### 13.1 Input and parser

- [x] Accept a `.ics` browser file/Neutron attachment with an explicit media type
  and a maximum size no greater than 1 MiB.
- [x] Parse locally in a killable/bounded worker if parsing untrusted input can
  otherwise block the UI.
- [x] Enforce limits for bytes, lines, properties, components, recurrence
  expansion, text, and resulting operations before backend mutation.
- [x] Support the exported P0 subset first: VEVENT, UTC/date values, TZID,
  RRULE/RDATE, EXDATE, RECURRENCE-ID, UID, SEQUENCE, SUMMARY, DESCRIPTION,
  LOCATION, STATUS, and TRANSP.
- [x] Reject or explicitly report unsupported scheduling semantics. Never silently
  reinterpret attendees, organizers, alarms, or arbitrary extensions.
- [x] Prevent formula/HTML/script interpretation; all values are plain text.

### 13.2 Preview and deduplication

- [x] Produce a deterministic preview categorized as create, update, unchanged,
  conflict, duplicate, skipped, and invalid.
- [x] Match imported events by source namespace plus UID, never title alone.
- [x] Use SEQUENCE and content digest to avoid overwriting a newer local/imported
  revision without explicit conflict resolution.
- [x] Show date/time, timezone resolution, recurrence count, details disclosure,
  and the exact number of backend mutations.
- [x] Let the owner select/deselect individual proposed items.
- [x] Agent gets compact preview summaries, not the complete private calendar.

### 13.3 Atomic commit and undo

- [x] Add one bounded `calendar_import_commit_v1`/bulk backend mutation using the
  current calendar revision and a deterministic preview digest.
- [x] Limit one batch to a reviewed safe count, initially at most 250 event-series
  operations and at most 2,000 resulting occurrences.
- [x] Validate the complete batch before changing memory. Any invalid or stale
  item rejects the whole batch.
- [x] Persist a bounded receipt containing enough preimage to undo that exact
  batch, but no raw source file or redundant unbounded content.
- [x] Add `calendar_bulk_status_v1` so an ambiguous caller can reconcile by batch
  ID/digest without retrying blindly.
- [x] Add `calendar_bulk_undo_v1`; require the current affected revisions to match
  the receipt. If later edits conflict, refuse undo and explain which items block
  it. Never overwrite later owner changes.
- [x] Bound receipt count and bytes. Define deterministic oldest-receipt eviction.
- [x] Add owner UI and semantic Agent tools for preview, commit, status, and undo.

### 13.4 Tests

- [x] Fuzz parser boundaries and malformed line folding/encoding.
- [x] Test duplicates, stale sequences, conflicting local edits, cancellations,
  DST, all-day exclusivity, recurrence expansion limits, atomic rejection,
  unknown-outcome reconciliation, undo success, and undo conflict.
- [x] Round-trip P0 export -> P1 import -> export with semantic equivalence.

Exit gate: import never partially mutates state and every accepted bulk commit is
reconcilable and conditionally undoable.

Phase 6 evidence (2026-09-01):

- Calendar 0.5.0 packages at 477,893 bytes with archive SHA-256
  `88507a3870aaf7d1cbdd486f4f333fe0896fd8374338de0802ffd30d8afc52d8`.
  The complete Calendar command passed
  60 Bun tests plus memory, validation, availability, recurrence, search,
  import, and migration Motoko programs.
- Locked v3 remains
  `837ec1952dd080b3fc418c2bbd332bb0d79f16345b2f02a97c60622f9530c916`.
  Schema v4 is
  `0551792bd3569af90f86832b883bb379841ffee86cdb6aa2c57ab14677f3b66f`;
  migration 3-to-4 is
  `920591286652dbaffcc523c353d477aaf11e5aaa210b02795b3c87ed727354a7`.
- A live Kernel/Playwright flow passed file selection, preview, binary-sidecar
  self calls, atomic commit, authoritative search, receipt display, safe undo,
  and absence after undo in 7.9 seconds.
- The exact production Calendar 0.2.0 fixture upgraded in-product to 0.5.0/v4
  in 40.8 seconds with installation identity and representative owner state
  preserved. Reinstall was used only to initialize the disposable old fixture.
- The two-Neutron Calendar/Rendezvous fixture passed in 38.2 seconds using the
  canonical Calendar-branch archive. Confirmed meetings and an interrupted live
  hold survived 0.2.0-to-0.5.0 on Alice and Bob with handoff actions intact.

## 14. Phase 7 — P1 resident reminders and tray

- [x] Add a Calendar tray only after the Calendar background exists.
- [x] Add reminder controls to series and occurrence editors. Start with zero or
  one reminder offset per event unless product requirements justify more.
- [x] The resident queries the next bounded window, schedules browser timers, and
  recomputes after startup, resume, state revision invalidation, clock change,
  and timezone change.
- [x] Missed timers must not fire a storm after a long suspension. Define a small
  grace window and mark older reminders missed.
- [x] Set the tray badge to the number of actionable due reminders, capped by the
  Kernel contract.
- [x] Tray shows Now, Next, and Today; actions open the event or Rendezvous and
  support bounded snooze/dismiss state if included in v3.
- [x] Explain honestly that no reminder fires while Neutron is closed or the
  background is unavailable. Do not call this push notification.
- [x] Test lifecycle reload, logout, app update, timezone change, duplicate timer
  prevention, missed reminders, badge clearing, tray accessibility, and narrow
  viewport behavior.

Exit gate: reminders are deterministic, non-duplicating, and honest about their
browser-resident lifecycle.

Phase 7 implementation and automated evidence (2026-09-01):

- Calendar 0.6.6 adds bounded series defaults and occurrence overrides using the
  existing v4 `reminders` collection. No schema or migration bytes changed.
  Offsets are limited to zero through seven days, records to 4,000, and one
  schedule page to 200; cancelled occurrences and live holds are suppressed.
- The owner editor supports one reminder for owner events and read-only confirmed
  Rendezvous meetings. Mutations retain revision checks, and partial event/reminder
  failure is reported explicitly instead of claiming atomic success.
- The resident uses one coalesced refresh promise, a seven-day lookahead,
  15-minute resume grace, 60-second recovery polling, revision invalidation,
  saved-timezone projection, and a Kernel badge capped at 99. No browser or OS
  push behavior is claimed.
- The tray provides keyboard-dismissable Now, Next, and Today sections. Exact
  navigation uses the Kernel-compatible bounded route
  `reminder/<series-id>/<occurrence-id>`; JSON is intentionally not used because
  `workspace.open_tile` accepts only a 64-character lowercase route token.
  Snooze/dismiss was not added because the approved v3/v4 design stores only one
  reminder offset and no snooze state.
- The focused 420px Playwright acceptance passed in 10.7 seconds after proving
  durable save, reload, resident recovery, badge, tray, a second reload,
  exact-event deep link, delete, and title-specific tray cleanup.
- The final 0.6.6 Calendar release command passed in 24.9 seconds: package, 66 Bun
  tests, memory restoration, every Motoko domain test, and v1-to-v2,
  v2-to-v3, and v3-to-v4 migration tests.
- A freshly reinstalled production Calendar 0.2.0 fixture passed the reviewed
  in-product update to Calendar 0.6.6 with representative state,
  installation identity, and schema-v4 memory intact.
- The focused reminder acceptance was extended and passed against 0.6.6 in 10.9 seconds.
  It changes and saves the IANA display zone while one reminder remains due,
  proves the badge remains exactly one across two reloads (no duplicate timer),
  clears the event/reminder, then logs out through the Kernel tray and verifies
  both Calendar's resident frame and tray button are removed.
- The dedicated two-Neutron fixture was reset to its declared Calendar 0.2.0
  baseline, then the exact 0.6.6 Calendar/Rendezvous upgrade regression passed in 56.9
  seconds. It created a confirmed meeting and an interrupted live hold before
  upgrading both Alice and Bob to 0.6.6, preserving installation identity,
  schema-v4 Calendar memory, every non-Calendar memory, both projections, and
  the Rendezvous handoff action. The fixture now selects an authoritative
  currently-free suggestion instead of assuming a fixed wall time is unused.
- The broader Rendezvous browser suite then ran against both upgraded Neutrons:
  15 passed and one opt-in local-II diagnostic was skipped in 2.6 minutes.
  Coverage includes reload restoration, mobile Calendar, recurrence CRUD,
  drag/resize and stale rollback, Contacts, exact proposals, counteroffers,
  confirmation, busy-slot rejection, and retry idempotence.

## 15. Phase 8 — P1 subscription-feed architecture decision

Calendar cannot add or remove `certified_assets` while retaining its existing
installation scope. The exact production-shaped 0.2.0 upgrade test proved that
the Kernel rejects that capability-shape change. P1 therefore must not add
certified assets to the installed Calendar app, must not rotate Calendar into a
new scope, and must not require reinstalling or losing Calendar data.

Before implementing a subscription feed, the owner must explicitly choose one
of these paths:

1. omit subscription and retain ordinary `.ics` export through Files;
2. create a separately installed feed companion app, with its own directory,
   manifest, memory lineage, version, license, release tests, and owner-approved
   cross-app contract; or
3. wait for a future owner-approved Files API that can publish a suitably
   revocable `text/calendar` resource without changing Calendar's capability
   shape.

No path in this plan authorizes a Kernel patch. The remaining tasks in this
phase apply only after the separate publisher architecture is approved.

- [x] Release decision for Calendar 0.6.6: ship ordinary owner-controlled `.ics`
  export and withhold URL subscription. No companion publisher was approved,
  no bearer URL or public Calendar surface exists, and the conditional backlog
  below is not a 0.6.6 release gate.

The following is preserved as a future companion-app backlog, not as unchecked
Calendar 0.6.6 work.

### 15.1 Privacy and capability design

- Default feed state is disabled.
- Add disclosure modes:
  - Busy/Free only: generic title, time, and transparency;
  - titles and times: title/location policy explicitly documented;
  - full details: title, location, and notes with a high-friction warning.
- In the separate publisher, use its supported certified/publication API
  with an opaque random 32-byte keyed locator. Never use a principal or
  predictable series ID as the feed secret.
- Provide Enable, Copy URL, Refresh, Rotate URL, and Disable/Delete controls.
- Rotating deletes the old object before presenting the new URL as active.
  If deletion outcome is uncertain, report uncertainty and do not claim the old
  URL is revoked.
- Treat the URL as a bearer secret. Never send it to Agent model context or
  OpenRouter web tools.

### 15.2 Projection and reconciliation

- Generate feed bytes from authoritative Calendar state using the P0
  serializer and selected disclosure mode.
- Store `published_calendar_revision`, content digest, publication
  revision/tag, and feed status in the companion's memory. Calendar v3 stores
  only owner preferences and non-secret status needed by the approved contract.
- Calendar mutation success must not be rolled back merely because feed
  publication fails. Mark the feed stale and provide a bounded idempotent refresh
  operation.
- Define bounded companion-app status and refresh tools so resident/UI can
  reconcile stale or unknown publication outcomes without exposing bearer
  material to Calendar, Agent, or web-search tools.
- Refresh after create/update/delete/import/undo/reservation/confirm/release,
  with coalescing so one bulk commit causes one feed projection.
- Exclude expired holds and all negotiation/signaling secrets.

### 15.3 MIME compatibility decision gate

Any approved separate publisher must prove that its public response has the
calendar-client semantics required below. The existing Calendar package cannot
serve this feed itself.

- Test the exact certified URL with current Google Calendar “From URL” and
  Outlook “Subscribe from web.” Record status, redirects, MIME, filename/path,
  initial import, update polling, cancellation, and revocation behavior.
- If both accept the current response reliably, document the evidence and
  ship the subscription feature.
- If either rejects it, omit the subscription feed from P1. Do not patch,
  fork, or propose a Calendar-coupled Kernel change; keep ordinary `.ics` file
  export through Files.

### 15.4 Tests

- Unit-test every disclosure mode and verify forbidden fields are absent.
- Test enable, refresh, unchanged no-op, stale reconciliation, rotation,
  disable, deletion uncertainty, package upgrade, and uninstall cleanup.
- Test Google and Outlook subscription updates knowing provider polling may
  take hours. Preserve timestamped evidence rather than assuming immediacy.
- Verify anonymous possession of the URL is sufficient and that no other
  public path enumerates or reveals the locator.

Exit gate: feed is default-off, revocable, certified, privacy-reviewed, and
accepted by both target consumers—or P1 ships without the feed.

## 16. P1 final release gate — version strictly above Calendar 0.5.0

- [x] Complete a security/privacy review for ICS import, Agent tools, undo,
  reminder lifecycle, and the bearer subscription URL.
- [x] Increase the final Calendar release version strictly above the current
  0.5.0 import candidate after any reminder/feed package bytes are added.
- [x] Run clean initialization and exact v2-to-v3-to-v4 production migration tests with
  representative and maximum-bound data.
- [x] Run complete Calendar package, frontend, backend, domain, recurrence,
  migration, parser, Agent-tool, tray, certified-asset, Playwright, and upgrade
  suites.
- [x] Verify the final 0.6.6 candidate package size and all third-party licenses.
- [x] Install the final 0.6.6 candidate through a state-preserving in-product upgrade;
  never use reinstall as the production upgrade mechanism.
- [x] Review exact archive/source bytes and SHA-256.
- [ ] STOP before production publication until the owner explicitly authorizes
  it. Then follow `doc/package-updates.md`, publish once, repeat the exact same
  bytes, and require receipt-v2 `batch_id: null` with every selected package and
  offered source `unchanged` on the second run.

Final 0.6.6 artifact evidence (2026-09-01):

- archive: `apps/calendar/calendar.v0.6.6.neutron`, 590,231 bytes,
  SHA-256 `9e60e9f7a1a556e563b66e4884d4d8279fa8f65d48562981a5195387c28009bb`;
- offered source: `c3fd21c9e690deaadc6e233619434c5b2175bc0958552fa1f0871ca2e328d66f.source.v1.msgpack.gz`,
  485,978 bytes, SHA-256
  `c3fd21c9e690deaadc6e233619434c5b2175bc0958552fa1f0871ca2e328d66f`;
- the security/privacy review covers every implemented surface. A bearer feed
  has no runtime or URL in 0.6.6 and is explicitly outside the reviewed release;
- certified-asset/feed tests are not applicable because the capability is
  deliberately absent. All other listed package, parser, Agent, tray,
  Playwright, upgrade, and cross-app suites passed.

## 17. Cross-cutting test matrix

Every phase must preserve:

- clean install;
- state-preserving upgrade from Calendar 0.2.0;
- v1-to-v2 historical migration plus v2-to-v3 and v3-to-v4 migrations where applicable;
- one-time, recurring, overridden, cancelled, all-day, Busy, Free, hold, and
  confirmed Rendezvous events;
- DST gap/fold behavior and non-hour offsets;
- stale revision rejection and drag/resize rollback;
- narrow/mobile and keyboard-only operation;
- reduced-motion behavior;
- authorization failure and logout/update invalidation;
- capacity bounds and actionable error messages;
- no private metadata in availability, logs, public feed modes, Agent web
  queries, or unknown-outcome records.

## 18. Documentation and evidence deliverables

- [x] Update `apps/calendar/README.md` with timezone, search, export/import,
  Agent, reminder, and subscription behavior.
- [x] Document exactly what leaves the Neutron for browser download, OpenRouter
  web search, and a public subscription feed.
- [x] Add an interoperability guide for Google and Outlook covering file import,
  URL subscription, polling delays, disclosure, rotation, and revocation.
- [x] Add screenshots for the prepared export, import preview, and actionable
  tray reminder under `submission-assets/calendar/06-ics-export.jpg` through
  `08-reminder-tray.jpg` using the exact 0.6.6 installed UI.
- [ ] Add an Agent-created event review screenshot only after the real Agent
  0.3.9 acceptance run. Feed privacy controls are not applicable because the
  subscription feed is withheld from 0.6.6.
- [ ] Record the exact Google/Outlook test dates and product surfaces; cloud UI
  behavior is external and can change.
- [x] Keep P0 and P1 release notes distinct.

## 19. Definition of done

P0 is done only when Calendar 0.3.0 is independently releasable, all tests pass,
memory v2 is restored unchanged, `.ics` export imports correctly, timezone
behavior is truthful, authoritative search works, and Agent uses semantic tools.

P1 is done only when its final version is independently releasable, v2 data migrates
through v3 to v4 without loss, ICS imports are previewed/atomic/reconcilable, undo is safe,
tray reminders are lifecycle-correct, and the subscription feed either passes
real Google/Outlook compatibility or is explicitly withheld behind the MIME
decision gate.

Production publication is a separate terminal action and is never implied by
finishing implementation or tests.
