# Calendar 0.6.8: a real, private calendar for your Neutron

We have submitted a substantially upgraded version of **Calendar** to the
Neutron hackathon.

Our goal was not to build another calendar-shaped demo. We wanted Calendar to
feel like an application someone could actually use: familiar calendar views,
recurring events, time-zone-correct editing, reminders, import/export, natural
language Agent actions, and private composition with other Neutron apps.

Calendar is still a standalone app. It installs on the stock Neutron Kernel and
does not require Rendezvous, Contacts, Files, or Agent. Those apps add useful
workflows when installed, but Calendar remains independently useful.

## What is better in 0.6.8?

### A full calendar interface

Calendar now has Month, Week, Day, and responsive Agenda views. You can click or
drag across the grid to create an event, then drag an event to move it or resize
its edge to change its duration. Events support:

- timed and all-day scheduling;
- titles, notes, locations, and colors;
- Busy or Free availability;
- daily, weekly, monthly, and yearly repetition;
- repeat-by-count or repeat-through-date limits; and
- editing or deleting one occurrence without changing the rest of its series.

The saved IANA time zone is used consistently by the grid, editor, recurrence
preview, search, and upcoming list. Changing the display time zone changes how
an instant is presented; it does not silently move the stored event. Calendar
also warns about daylight-saving gaps and ambiguous local times.

### Real iCalendar import and export

Calendar can now exchange standard `.ics` files with Google Calendar, Outlook,
Apple Calendar, and other iCalendar software.

You can export one event, the visible range, or the complete bounded calendar.
Before exporting, choose whether to include titles, notes, and locations or
produce a privacy-minimal Busy-only copy. Live tentative Rendezvous holds are
excluded unless you explicitly include them.

If the Files app is installed, Calendar can privately save the prepared file in
`/Workspace/Calendar Exports/`; open Files and choose **Download**. If Files is
not installed, use **Copy iCalendar data** and save the exact text with the
displayed `.ics` filename.

Import is deliberately review-first. Select a file under **Import iCalendar**
and Calendar shows which series would be created, updated, left unchanged,
skipped, or treated as conflicts. Nothing changes merely because you selected a
file. Choose the entries you want and then click **Import selected**. The whole
selection commits atomically, and **Undo this import** is available as long as
none of the affected events has since been edited.

We validated the generated file independently and imported our four-event test
calendar into the current Google Calendar web interface. Google reported **4 of
4 events imported**, and we visually confirmed the timed, all-day, recurring,
and overridden events on the expected dates.

One distinction is worth making: 0.6.8 exports portable `.ics` snapshots. It
does **not** publish a live subscription URL, so later Calendar changes do not
automatically synchronize into Google or Outlook.

### Resident reminders

An event or series can have one reminder from **At event time** through **1 week
before**. An individual recurring occurrence can inherit the series reminder or
override it. You can even attach your own local reminder to a read-only meeting
confirmed by Rendezvous.

The Neutron tray shows a badge and groups reminders into **Now**, **Next**, and
**Today**. Selecting one opens the exact occurrence in Calendar.

These are honest browser-resident reminders, not push notifications: the
Neutron must be open and its Calendar background active. After a short suspend,
Calendar catches up only inside a 15-minute grace window rather than producing
a storm of stale alerts.

### Natural-language Calendar actions through Agent

With the optional Agent app installed, Calendar exposes bounded semantic tools
for status, search, schedule reads, free-time lookup, create, update, delete,
export preparation, and reviewed import workflows.

To use them:

1. Open Agent and connect your chosen model provider.
2. Enable Agent Mode.
3. When prompted, choose **Allow session** for Calendar.
4. Ask for something concrete, such as “Create a 30-minute event tomorrow at
   3 PM called design review,” “Find my next free 45-minute slot,” or “Move the
   design review to 4 PM.”
5. Review the exact proposed values before allowing a write.

Agent talks to Calendar through typed tools rather than scraping the UI or
guessing backend types. Writes use revision checks, and uncertain outcomes are
reconciled by reading authoritative Calendar state rather than blindly
repeating a mutation. We tested live status plus create, find, update, and
delete against Calendar 0.6.8.

Privacy remains part of the tool contract. Calendar does not dump an entire
calendar or raw `.ics` export into model context, and private event contents
must not be copied into public web-search queries.

### Private composition with Rendezvous

Calendar can also cooperate with our separate Rendezvous app. Select a time and
choose **Find a time with someone** to open Rendezvous with that exact range.
The handoff contains only the proposed start and end—not the Calendar title,
notes, or location. Rendezvous still asks you to choose a peer and review the
proposal.

Other Neutron apps can ask Calendar whether specific candidate times are
available, but Calendar returns only the matching candidates. It never hands
another app your busy intervals or private event details. Confirmed Rendezvous
meetings appear in Calendar and link back to their negotiation.

## How to try it

1. Download
   [`calendar.v0.6.8.neutron`](https://github.com/skilesare/neutron/releases/download/calendar-v0.6.8/calendar.v0.6.8.neutron).
2. Open your Neutron's package installer and install or upgrade Calendar.
3. Open Calendar and set your working hours, time zone, grid increment, and
   meeting buffers under **Scheduling defaults**.
4. Drag across the Week or Day grid to create your first event.
5. Try **Repeat**, **Reminder**, **Search events**, **Import iCalendar**, and
   **Export iCalendar**.
6. If Agent or Rendezvous is installed, try the optional workflows described
   above.

Existing Calendar state is preserved by the normal in-product upgrade path. Do
not reinstall an existing app merely to upgrade it.

## Links

- [60-second Calendar demo](https://github.com/skilesare/neutron/releases/download/calendar-v0.6.8/calendar-demo.mp4)
- [Calendar 0.6.8 release and downloads](https://github.com/skilesare/neutron/releases/tag/calendar-v0.6.8)
- [Source on the `calendar-hackathon` branch](https://github.com/skilesare/neutron/tree/calendar-hackathon/apps/calendar)
- [Week calendar screenshot](https://github.com/skilesare/neutron/blob/calendar-hackathon/submission-assets/calendar/01-week-calendar.jpg)
- [Recurring-series screenshot](https://github.com/skilesare/neutron/blob/calendar-hackathon/submission-assets/calendar/02-recurring-series.jpg)
- [Mobile agenda screenshot](https://github.com/skilesare/neutron/blob/calendar-hackathon/submission-assets/calendar/05-mobile-agenda.jpg)
- [iCalendar export screenshot](https://github.com/skilesare/neutron/blob/calendar-hackathon/submission-assets/calendar/06-ics-export.jpg)
- [iCalendar import preview screenshot](https://github.com/skilesare/neutron/blob/calendar-hackathon/submission-assets/calendar/07-ics-import-preview.jpg)
- [Reminder tray screenshot](https://github.com/skilesare/neutron/blob/calendar-hackathon/submission-assets/calendar/08-reminder-tray.jpg)

We would especially appreciate feedback on recurring-event editing, provider
interoperability, reminder behavior, and the Agent permission flow. If you try
Calendar, let us know what would make it useful enough to become your everyday
personal calendar—and if you like where it is going, please support it in the
current hackathon round.
