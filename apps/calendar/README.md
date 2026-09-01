# Calendar

Calendar is a standalone, full-featured calendar for one Neutron owner. It
stores event titles, notes, location, display color, Busy/Free state,
recurrence, and tentative holds in its own managed `calendar` memory roots. No
consumer receives that memory. It has no app dependencies and installs on the
stock Neutron Kernel.

The owner tile provides real day, week, month, and list views. Owners can create,
inspect, edit, move, resize, and delete timed or all-day events. Daily, weekly,
monthly, and yearly recurrence is materialized as bounded local occurrences;
individual occurrences or entire series can be changed or removed. UTC
nanoseconds remain authoritative while recurrence is generated in the owner's
saved IANA time zone, including explicit DST gap/fold warnings. Calendar uses
the saved zone consistently in its grid, editor, recurrence preview, search,
and upcoming list; changing the display zone never changes stored instants. Count and inclusive
end-date termination are exact up to 730 occurrences; larger series are
explained and rejected instead of silently truncated.

Scheduling settings also control the grid increment and the before/after
buffers used by availability suggestions. Buffers do not change visible event
duration and do not prevent the owner from creating an event.

When Rendezvous is also installed, a fresh timed selection or existing owner event can open it with that
exact range prefilled. The handoff contains only the bounded start/end
timestamps: no title, notes, location, or attendee crosses app boundaries.
Rendezvous still requires the owner to choose a peer and review the proposal.
Confirmed Rendezvous events are read-only in Calendar and link back to the
matching local negotiation.

Installed apps receive exactly four synchronous `internal:apps` functions:
`calendar_availability_v1`, `calendar_reserve_v1`, `calendar_confirm_v1`, and
`calendar_release_v1`. Availability filters caller-supplied starts; it never
returns busy intervals or private event metadata. Reservations are idempotent by
a 16-byte external ID. The owner UI uses v2 source-bound self calls for sorted
range queries and series/occurrence CRUD; bounded migration converts v1 events
to non-recurring v2 series. Authoritative search is separately bounded by input
bytes, result count, scan work, and Calendar revision, so it can find events
outside the rendered window without treating a frontend cache as complete.

## iCalendar export

The owner can export one event, the visible range, or the complete bounded
calendar as an RFC 5545 `.ics` download. Exports use CRLF line endings,
UTF-8-safe 75-octet folding, escaped text, exclusive all-day end dates, stable
UIDs, deterministic timestamps and sequences, and explicit Busy/Free status.
Private details are optional. Live holds are excluded unless the owner opts in;
expired holds and Rendezvous negotiation/signaling data are never exported.

Calendar intentionally exports each bounded recurrence occurrence as an
independent `VEVENT`. This preserves the exact authoritative instances and
exceptions—including local-wall-time behavior across DST—without asking an
importer to reproduce Calendar's recurrence rules. A stable UID is derived from
the non-secret series ID, recurrence key, and public Calendar canister ID. This
lets an importer correlate repeated exports, but someone who already has two
files from the same Calendar can also correlate those event identifiers. UIDs
contain no principal, authorization data, installation UID, or private event
text.

The serializer has deterministic golden tests and is independently parsed by
`ical.js` during qualification.

Because an installed app tile is intentionally not allowed to start browser
downloads, Calendar hands the generated snapshot to the existing Files app as
`/Workspace/Calendar Exports/<name>.ics`. The owner reviews the ordinary
cross-app write permission, then opens Files to download or share the file.
Files is optional: when it is unavailable or the owner declines the handoff,
Calendar retains the prepared snapshot only in the current tile and offers a
copy action so it can be saved manually as plain-text `.ics`. Clearing or
closing the tile drops that prepared copy.

This design is intentionally state-preserving. Calendar 0.2.0 did not declare
certified-assets capability, and the production Kernel correctly refuses to add
or remove that capability while retaining an installation scope. Calendar 0.3
therefore keeps the released `calendar` memory root and capability shape
unchanged, requires no Kernel modification, and remains independently
installable. Files supplies the optional file/download boundary without gaining
access to Calendar's stored event database.

## iCalendar import

The owner can choose a `.ics` file up to 1 MiB and review it before Calendar
changes any state. Parsing runs locally in a killable worker with explicit
limits on lines, properties, components, event series, text fields, recurrence
expansion, and resulting occurrences. Calendar supports the same core VEVENT
surface used by its exports, including UTC, floating and all-day values, TZID,
RRULE/RDATE, EXDATE, RECURRENCE-ID, UID, SEQUENCE, SUMMARY, DESCRIPTION,
LOCATION, STATUS, and TRANSP. Scheduling METHOD files, attendees, organizers,
attachments, request status, and alarms are rejected or reported instead of
being silently reinterpreted.

Preview groups entries as create, update, unchanged, conflict, duplicate,
skipped, or invalid. Imported series are matched by normalized source namespace
plus UID—not by title—and SEQUENCE plus a deterministic content digest prevents
older or conflicting data from overwriting newer state. The owner can select
individual creates and updates and sees the exact backend mutation count.

One revision-guarded call validates and commits the complete selected batch, up
to 250 series and 2,000 occurrences. Any stale or invalid item rejects the whole
batch. Calendar retains the 20 newest bounded receipts so an interrupted caller
can reconcile a batch ID and digest without retrying blindly. Undo restores the
exact preimage only when no affected series has been edited since; otherwise it
lists the conflicting series and leaves every later owner change intact.

## Neutron Agent tools

Calendar declares an ordinary resident endpoint with bounded semantic tools for
status, authoritative search, event reads, schedule listing, free-time lookup,
creation, expected-revision updates/deletes, and an owner-openable export
action. Every backend operation uses the Kernel-scoped self-call client. Agent
does not receive raw Motoko variants or nanoseconds, and export never dumps an
entire private calendar into model context. Tool instructions explicitly keep
private Calendar data out of public web-search requests and require read/search
reconciliation after an ambiguous write outcome.

The resident also exposes attachment-aware import preview, commit, status, and
undo tools. The `.ics` bytes are delivered directly to Calendar and parsed
locally. Agent receives only compact UID/title/start/count/category summaries;
raw file contents, notes, locations, unrelated events, batch bytes, and private
Calendar storage are not placed in model text. Preview tokens expire after ten
minutes.

## Resident reminders and tray

Each series can have one reminder from the event time through seven days
before it. A recurring occurrence can inherit that series reminder or replace
it with its own offset. Confirmed Rendezvous meetings are read-only as events,
but the owner can still attach a local Calendar reminder. Reminder records stay
in Calendar's existing schema-v4 memory and are removed with their occurrence
or series.

The background reads a bounded seven-day due window and maintains one
coalesced browser timer plus a one-minute recovery poll. It recomputes after
startup, page resume, connectivity recovery, Calendar revision invalidation,
and saved-time-zone changes. A reminder is actionable only from its due time
through a 15-minute grace window, preventing a long-suspended browser from
emitting a catch-up storm. The tray badge is capped at 99 and its projection
contains only event title, source, status, time, and offset—never notes or
location. Tray sections show Now, Next, and Today, and an item opens that exact
Calendar occurrence.

These are browser-resident tray reminders, not push notifications. Nothing
fires while the Neutron is closed or its background is unavailable. On restart,
Calendar reconstructs the schedule from durable reminders and only catches up
inside the documented grace window.

## Data leaving Calendar

- A browser file import enters Calendar only after the owner selects it. The
  bounded local parser sees the raw bytes; Agent receives only the documented
  compact preview when the import starts from an attachment.
- An export leaves Calendar only as the owner-prepared projection sent to Files
  or copied from the tile. Downloading or sharing the resulting file is an owner
  action.
- When the owner asks Agent to use Calendar, the bounded semantic tool result can
  enter the configured model context. Calendar never sends raw `.ics` export
  bytes to that context, and its tool contract prohibits putting private event
  text into public web-search queries.
- Calendar 0.6.6 exposes no public subscription feed, bearer URL, or certified
  Calendar object.

See [INTEROPERABILITY.md](INTEROPERABILITY.md) for Google and Outlook file
import guidance and the explicit subscription decision, and
[SECURITY-PRIVACY-REVIEW.md](SECURITY-PRIVACY-REVIEW.md) for the reviewed trust
boundaries and residual risks.

Key bounds: 2,000 stored occurrences, 730 occurrences/series, 100 search
results/page, 2,000 scanned occurrences/search call, 32 availability
candidates/request, 15–480 minute meetings, a 31-day availability horizon,
160-byte titles and 4,096-byte notes. Files text-write limits independently
bound an optional saved export to 512 KiB.

From the repository root:

```sh
npm --workspace neutron-calendar test
```

The package pipeline validates, builds, locks managed memory, creates method
schemas, runs recurrence/domain/migration suites, and produces
`apps/calendar/calendar.v0.6.6.neutron`.
