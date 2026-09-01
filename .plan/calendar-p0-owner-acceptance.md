# Calendar 0.3.0 owner acceptance

Status: automated installed-package and upgrade gates pass; Google/Outlook and
live Agent owner acceptance remain.

Use this sheet only after the automated P0 gates in
`calendar-p0-p1-workplan.md` are green. Preserve screenshots and notes beneath
`submission-assets/calendar/p0-acceptance/<YYYY-MM-DD>/`; do not place account
credentials, API keys, principals, private event details, or downloaded browser
profiles in the repository.

## Local fixture

- URL: `http://mmvz6-g7777-77775-qaacq-cai.localhost:8000/`
- Installed apps: Calendar 0.3.0, Agent 0.3.9, and Files
- Kernel: unchanged production baseline 0.3.22
- Config: `calendar-submission-local.ndeploy.json`

If login shows **Not authorized**, copy the displayed principal and authorize it
from the implementation worktree:

```sh
npm run provision -- calendar-submission-local.ndeploy.json authorize <PRINCIPAL>
```

Reload after authorization. Use a dedicated test Google calendar and a dedicated
test Outlook calendar so imported fixtures can be deleted without touching
personal data.

## A. Calendar-to-Files delivery gate

Do not substitute a fixture copied from the repository when claiming the app
delivery path works.

1. Open Calendar and create a uniquely named event.
2. Open it through **Search events**.
3. Activate **Export event** with the keyboard.
4. Review the Kernel cross-app permission for Calendar tile →
   `app:files:background` → `write`, then approve it for the session.
5. Require Calendar to show the safe filename, byte count, and private Files
   path under `/Workspace/Calendar Exports/`.
6. Activate **Open Files**, select the saved `.ics`, and require the exact
   `BEGIN:VCALENDAR`, one `VEVENT`, and event title in its text editor.
7. Choose **Download** in Files and require one `.ics` browser download. Calendar
   itself must not gain download or popup authority.
8. Repeat after denying the Files permission. Require Calendar to preserve a
   volatile prepared export and make **Copy iCalendar data** work without
   claiming it saved a file.
9. Repeat with **Include titles, notes, and locations** off; require `Busy` and
   absence of the private title, notes, and location.

Evidence: Files path, download filename, byte size, SHA-256, permission dialog,
denial fallback, and screenshots of Calendar/Files controls and browser
download. Never commit a file containing real private details.

## B. Google Calendar file import

Google's current official desktop flow is **Settings → Import & Export → Select
file from your computer → choose destination calendar → Import**:
<https://support.google.com/calendar/answer/37118?hl=EN>

Import an app-downloaded full Calendar matrix containing:

- one timed event with Unicode, escaped punctuation, notes, and location;
- one all-day event with an exclusive end date;
- one Free event;
- a weekly series spanning a DST transition;
- one overridden recurring occurrence;
- one confirmed Rendezvous event; and
- no expired or unselected tentative holds.

Require successful import, correct local times, correct all-day dates, Free/Busy
transparency, recurrence count, exception time, notes/location, and no duplicate
events after one import. Record Google's reported processed count and screenshot
the imported series and exception. Imported files are snapshots, not sync.

## C. Outlook web file import

Microsoft's current official flow is **Calendar → Add calendar → Upload from
file → Browse → choose destination calendar → Import**:
<https://support.microsoft.com/en-US/Outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web>

Import a fresh copy of the same app-downloaded matrix into a dedicated Outlook
calendar. Require the same time, all-day, transparency, recurrence, exception,
Unicode, notes/location, and exclusion checks as Google. Record the imported
count, Outlook surface/account type, timezone setting, and screenshots.

## D. Live Agent 0.3.9 qualification

1. Open Agent and connect the owner's OpenRouter account through the Kernel
   connection flow. Never paste or commit an API key into Calendar, a test, or a
   screenshot.
2. Select a tool-capable model. Keep web access off initially.
3. Prompt: `Create a private event tomorrow at 9 AM for one hour titled Agent
   simple proof.` Require a Calendar permission review, one committed event, and
   no duplicate after searching for it.
4. Prompt: `Find my Agent simple proof event.` Require the exact authoritative
   Calendar result.
5. Enable web access. Prompt: `Find the official Internet Computer principals
   documentation URL. Do not send any Calendar contents to web search. Propose,
   but do not create, a 30-minute event tomorrow at 2 PM titled Review IC
   principals docs with only the public URL in notes.` Verify the proposal.
6. Prompt: `Create exactly that proposed event.` Review the Calendar write and
   require exactly one event.
7. Trigger and deny one unrelated permission request. Require no Calendar
   mutation and a clear denial response.
8. Confirm the Agent transcript and Kernel audit surfaces contain no OpenRouter
   credential, raw private Calendar export, or hidden tool transport identifier.

The injected ambiguous-write/reconciliation case remains automated in
`apps/calendar/test/agent_qualification.test.ts`; do not manufacture a live
network failure against an account merely to repeat it.

## Evidence record

| Check | Date/time and timezone | Surface/version | Result | Evidence path | Notes |
| --- | --- | --- | --- | --- | --- |
| Calendar-to-Files download |  | Calendar 0.3.0 / Files / Kernel 0.3.22 / browser | pending |  |  |
| Privacy-mode download |  | Kernel / browser | pending |  |  |
| Google file import |  | Google Calendar web | pending |  |  |
| Outlook file import |  | Outlook web | pending |  |  |
| Agent simple create/search |  | Agent 0.3.9 / model | pending |  |  |
| Agent web research then reviewed create |  | Agent 0.3.9 / model | pending |  |  |
| Permission denial |  | Agent 0.3.9 / Kernel | pending |  |  |
