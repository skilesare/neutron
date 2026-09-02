# Calendar interoperability guide

Calendar 0.6.8 produces standard `.ics` files for one event, the visible range,
or the complete bounded calendar. It does not publish a subscription URL.

## Prepare and download a file

1. In Calendar, choose whether to include titles, notes, and locations. Leave
   that option off for a Busy-only projection.
2. Choose **Export event**, **Export visible range**, or **Export calendar**.
3. If Files is installed, approve the write and open the saved file under
   `/Workspace/Calendar Exports/`, then download it. Otherwise copy the prepared
   iCalendar text and save it as plain UTF-8 text with the displayed `.ics`
   filename.
4. Treat the resulting file as sensitive when details are enabled. Anyone who
   receives it can read the exported contents.

Exports are snapshots. Importing the same UID again may update a prior imported
copy depending on the destination product, but Calendar does not push later
changes to it. Cancelled occurrences and expired holds are excluded. Live
tentative Rendezvous holds are excluded unless explicitly enabled.

## Google Calendar file import

Use Google Calendar's current desktop/web import surface, choose the downloaded
`.ics` file, select the destination calendar, and review the imported events.
Verify timed and all-day events, Busy/Free state, non-ASCII text, a DST-crossing
series, and an overridden occurrence. Google's UI and mapping can change, so
record the test date, browser, account surface, and observed differences.

## Outlook file import

Use Outlook's current web calendar file-upload/import surface, choose the
downloaded `.ics` file and destination calendar, then perform the same review.
Record the exact Outlook product surface because new Outlook, classic Outlook,
and Outlook on the web can differ.

## Subscription from URL

There is no Calendar subscription URL in 0.6.8. Calendar cannot add certified
assets while preserving the released installation capability shape, and no
Kernel change is permitted. Do not paste a local Neutron URL into Google or
Outlook and describe it as a supported feed.

A future separately installed publisher would need all of the following before
release: default-off disclosure modes, an opaque random bearer URL, rotation and
deletion semantics, stale-projection reconciliation, privacy review, and live
Google **From URL** plus Outlook **Subscribe from web** tests. Provider polling
can take hours, and disabling a feed must be tested rather than assumed to revoke
cached copies.

## Qualification record

| Date | Surface | Result |
| --- | --- | --- |
| 2026-09-01 | Automated RFC 5545 serializer/parser qualification | Passed deterministic fixtures, UTF-8 folding, recurrence-instance projection, Busy-only redaction, and `ical.js` parsing. |
| Pending | Current Google Calendar web file import | Manual owner/account test required. |
| Pending | Current Outlook web file import | Manual owner/account test required. |
| Not applicable | Google/Outlook URL subscription | Withheld: Calendar 0.6.8 exposes no feed URL. |
