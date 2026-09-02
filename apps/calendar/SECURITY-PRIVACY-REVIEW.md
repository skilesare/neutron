# Calendar 0.6.8 security and privacy review

Review date: 2026-09-02

Scope: the unpublished Calendar 0.6.8 candidate, including iCalendar import and
export, Agent tools, bulk undo, browser-resident reminders, and the existing
Rendezvous availability contract. A public subscription feed is not present in
this release and is therefore not represented as reviewed or available.

## Result

No release-blocking issue was found in the implemented 0.6.8 scope. Calendar
keeps one managed `calendar` root at schema v4, uses only self-scoped frontend
and Agent calls, and adds no Kernel or certified-assets capability. Publication
still requires the production process and explicit owner authorization.

## Trust boundaries and findings

| Boundary | Data permitted to cross | Controls and residual risk |
| --- | --- | --- |
| Calendar backend to its tile/resident/tray | Owner event data needed by that surface | Kernel-scoped self calls, bounded pages, revision guards, and owner authorization. The tray receives title/time/source/status/offset, but never notes or location. |
| Calendar to installed Rendezvous | Candidate starts, reservations, confirmations, and releases | Availability returns only caller-supplied starts that remain free. It never returns busy intervals, titles, notes, or locations. |
| Calendar to Files | One owner-prepared `.ics` snapshot | Requires the ordinary reviewed cross-app write. Files receives only the selected projection, not Calendar memory. An export with details enabled is intentionally sensitive. |
| Calendar to Agent/model context | Bounded semantic tool arguments/results | Tool outputs can include the event fields the owner asked Agent to read or change. Export returns an owner action, never raw `.ics`. Import preview returns compact UID/title/start/count/category summaries, never raw bytes, notes, or locations. Private Calendar text must not be copied into web-search queries. Identifier inputs accept decimal strings or safe nonnegative JSON integers and normalize to strings before canister calls; unsafe numeric values are rejected. |
| Browser-selected import to Calendar | One file, at most 1 MiB | Parsing occurs in a killable local worker with line/property/component/text/series/occurrence limits. Scheduling messages, attendees, organizers, alarms, and attachments are rejected or diagnosed. Selecting a file is non-mutating. |
| Calendar to a public subscription URL | Nothing | No feed, token, public route, or certified Calendar object exists in 0.6.8. A future companion publisher requires its own threat model and real Google/Outlook qualification. |

## Mutation and recovery review

- Event, preference, reminder, import, and undo writes use expected revisions.
- Import commits one bounded selected batch. Durable batch ID/digest receipts
  reconcile ambiguous responses without blind retry.
- Undo restores exact preimages only while every affected imported series still
  has the committed revision; later owner edits are never overwritten.
- Event and reminder saves are separate mutations. The UI reports partial
  failure explicitly and does not claim atomicity.
- Reminder scheduling coalesces refreshes, caps reads, maintains one timer, and
  suppresses catch-up outside a 15-minute grace window. Logout clears Kernel
  tray state and removes the resident surface.

## Data minimization and logging

- Busy-only exports replace private fields and exclude signaling metadata.
- Expired holds and cancelled occurrences are omitted from exports and reminder
  schedules. Live holds require an explicit export opt-in.
- Production Calendar paths contain no `console`, Motoko debug print, or
  `debug_show` logging sink. Tests assert this invariant.
- Stable export UIDs omit principals, authorization data, installation IDs, and
  private text. Two exports from the same Calendar can still be correlated by
  UID; this is documented behavior required for importer reconciliation.

## Verification evidence

- `npm --workspace neutron-calendar test`: package plus 69 Bun tests, all
  Motoko domain tests, memory restoration, and v1→v2→v3→v4 migrations passed.
- Focused reminder acceptance: passed at 420 px with reload, timezone change,
  exact badge count, tray navigation/cleanup, and logout cleanup.
- Exact owner-fixture in-product Calendar 0.6.7→0.6.8 upgrade: passed in 32.7
  seconds with installation identity, memory ownership/schema v4, and the exact
  Agent-created event preserved.
- Post-upgrade Calendar 0.6.8, Agent 0.3.9, and Files 0.4.3 resident readiness:
  passed in 8.0 seconds with the already-connected Agent state recognized.
- Standard in-product Calendar 0.2.0→0.6.8 upgrade: passed in 36.0 seconds with
  timed, recurring, overridden, all-day, location, notes, availability,
  installation identity, unrelated memories, and the v2→v4 transition
  preserved.
- Focused 0.6.8 reminder/tray browser acceptance: passed in 11.6 seconds with
  reload, time-zone change, exact badge count, tray navigation/cleanup, and
  logout cleanup.
- Focused 0.6.7 reminder/tray browser acceptance passed with reload, timezone
  change, exact badge count, tray navigation/cleanup, and logout cleanup.
- Fresh two-Neutron Calendar/Rendezvous 0.2.0→0.6.8 upgrade: passed in 1.1
  minutes on Alice and Bob with confirmed meeting, interrupted live hold,
  installation identities, memory ownership, and schema-v4 state preserved.
- Full upgraded Rendezvous suite against Calendar 0.6.8: 15 passed in 3.0
  minutes; one opt-in diagnostic skipped.

## Deferred risks

- Google Calendar and Outlook are external products. Manual file-import
  qualification remains required and must record the date and product surface.
- There are no background or OS push notifications. Reminders cannot fire while
  Neutron or its Calendar resident is unavailable.
- A bearer subscription feed is deliberately withheld. Do not reuse this review
  as approval for a future public publisher.
