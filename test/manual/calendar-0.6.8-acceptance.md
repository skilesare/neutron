# Calendar 0.6.8 manual acceptance

Run date: pending

This is the owner-assisted portion of the Calendar release gate. It uses the
exact local fixture in `calendar-submission-local.ndeploy.json`: stock Kernel
0.3.22, Calendar 0.6.8, Agent 0.3.9, and Files 0.4.3. Do not substitute an
unpublished rebuild from the combined branch; `calendar-hackathon` is the
authoritative Calendar package source.

Store screenshots under `test-evidence/calendar-0.6.8/`. That directory is
evidence only and is not part of the Calendar package source closure.

## Start and qualify the fixture

The provisioner supports one supervised localhost gateway on port 8000. If no
supervisor is running for this worktree, start it in a dedicated terminal and
leave that expected long-lived command running:

```sh
node_modules/.bin/bun packages/neutron-provision/src/index.ts calendar-submission-local.ndeploy.json serve
```

If a different worktree already owns port 8000, do not start a competing
gateway. Run the following commands from that owning worktree's committed copy
of `calendar-submission-local.ndeploy.json`; `reinstall` attaches the fixture to
the live supervisor without deleting its other local Neutron canisters.

1. From the selected repository root, install the disposable fixture:

   ```sh
   node_modules/.bin/bun packages/neutron-provision/src/index.ts calendar-submission-local.ndeploy.json reinstall
   ```

2. Verify `status` reports one complete `calendar-demo` deployment:

   ```sh
   node_modules/.bin/bun packages/neutron-provision/src/index.ts calendar-submission-local.ndeploy.json status
   ```

3. Sign in through local Internet Identity, authorize that principal, and open
   Calendar and Agent from the launcher.
4. Confirm Calendar's installed version is 608 and its `calendar` memory is
   schema v4 before collecting evidence.

## Agent 0.3.9 acceptance

Connect OpenRouter only through Agent's visible **Connect to OpenRouter** flow.
Review the Kernel disclosure, choose **Continue**, finish provider authorization,
select a tool-capable model, and enable Agent Mode through its visible owner
consent. The test must not inject a credential or bypass a permission dialog.

Use a unique suffix such as the UTC run timestamp in every event title. For
each prompt, preserve the prompt, final answer, relevant permission dialog, and
the matching authoritative Calendar search result.

0. Before any mutation, verify the 0.6.8 manifest correction directly:

   > Read my Calendar status and report its saved time zone, revision, and event
   > count. Do not use reminder_snapshot unless status fails.

   `status` must succeed without a permission error. Agent may visibly call
   `get_tool_schema`; schema discovery is expected and is not a failure.

1. Natural-language create:

   > Create a Calendar event titled “Agent acceptance <suffix>” tomorrow from
   > 2:00 PM to 2:30 PM in my saved Calendar time zone. Show me the exact values
   > before making the change, and do not use web search.

   Accept only after the title, zone, start, end, and Busy state are visible.
   Search Calendar directly for the exact title afterward.

2. Authoritative find:

   > Find the Calendar event whose exact title is “Agent acceptance <suffix>”.
   > Report its authoritative start, end, time zone, and revision.

   The answer must come from Calendar tools, not conversation memory.

3. Optionally capture `agent-created-event-review.png` as submission collateral
   with the final Agent response and matching Calendar event/editor visible.
   This screenshot is not an acceptance gate. Disconnect OpenRouter after the
   run if this fixture will be shared.

Live Agent web search and denial of unrelated Files access are outside
Calendar/Rendezvous acceptance. Calendar's private-data separation and scoped
self-call behavior are covered by deterministic tests; Files is not maintained
by this project.

Record model ID, Agent version, browser version, run time, and pass/fail details
in the evidence directory. Model output alone is not proof; each mutation must
be reconciled against Calendar. Ambiguous-write injection is not performed in
the credentialed live run because the deployed app intentionally exposes no
fault-control surface. Its required evidence is the passing deterministic
fake-driver qualification in `apps/calendar/test/agent_qualification.test.ts`,
which injects an unknown create outcome and proves status/search reconciliation
without retry.

## Google Calendar file import

Generate the deterministic provider-acceptance file and its independent-parser
report from the unchanged, reviewed Calendar 0.6.6–0.6.8 serializer:

```sh
node_modules/.bin/bun test/manual/generate-calendar-provider-fixture.ts test-evidence/calendar-0.6.8/calendar-provider-import.ics
```

Use the resulting exact file at
`test-evidence/calendar-0.6.8/calendar-provider-import.ics` for both providers.
Its validation report fixes the SHA-256, byte count, expected four events,
Busy/Free counts, CRLF/folding checks, and verifies that cancelled events and
tentative holds were filtered before the credentialed import. Do not edit or
regenerate the file between provider runs.

Current official desktop/web navigation checked 2026-09-01:

- <https://support.google.com/calendar/answer/37118?hl=en>
- Google Calendar → **Settings** → **Import & export** → **Select file from
  your computer** → choose a destination calendar → **Import**.

The deterministic artifact exercises the same detail-enabled Calendar 0.6.8
serializer and exclusion defaults as the installed Files handoff already
covered by `test/e2e/calendar-p0-gates.spec.ts`. Import that exact `.ics` file.
Record the Google product surface, account type, browser/version, time zone,
run time, imported/total count, and screenshots. Verify:

- timed and all-day events;
- Busy and Free transparency;
- Unicode, commas, semicolons, backslashes, and newlines;
- the two materialized DST-crossing occurrences retain their intended local
  wall times;
- an overridden occurrence is represented exactly once;
- cancelled occurrences and expired holds are absent.

Google documents file import as a snapshot and notes that guests and conference
data are not imported. Calendar does not export those scheduling surfaces.

## Outlook web file import

Current official web navigation checked 2026-09-01:

- <https://support.microsoft.com/en-US/Outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web>
- Outlook Calendar → **Add calendar** → **Upload from file** → **Browse** →
  choose the destination calendar → **Import** (or **Import and Save** on a
  work/school surface).

Import the same exact `.ics` bytes used for Google. Record whether the surface
is Outlook.com personal or Outlook on the web work/school, plus browser/version,
time zone, run time, imported/total count, screenshots, and the same semantic
checks above. Microsoft also documents file import as a non-refreshing snapshot.

## Completion record

| Gate | Result | Evidence |
| --- | --- | --- |
| Agent direct status | Passed (2026-09-02) | Owner transcript: UTC, revision 1, one event, 15-minute slots, zero buffers; no fallback or permission error |
| Agent create/find/update/delete | Passed (2026-09-02) | Owner transcript: direct status; create series 2/rev 1; authoritative find; guarded title rev 1→2; re-read; occurrence end rev 2→3; guarded delete; zero-result search; final status rev 5/event count 1 |
| Ambiguous write reconciliation | Passed (automated) | `apps/calendar/test/agent_qualification.test.ts` |
| Google Calendar web import | Passed (2026-09-02) | Provider reported 4 of 4 imported; owner visually confirmed all four exact titles on 2026-09-10, 2026-09-12, 2026-10-26, and 2026-11-02 |
| Outlook web import | Deferred (non-blocking) | Recommended follow-up interoperability evidence |

All hackathon acceptance gates are complete. The Outlook row is recommended
follow-up evidence and does not authorize or block `npm run updates:publish`.
