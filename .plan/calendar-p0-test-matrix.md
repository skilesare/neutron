# Calendar P0 regression and acceptance matrix

This matrix is the minimum continuous test surface for Calendar 0.3.0. “Automated”
means the repository must contain a deterministic test. “Manual” supplements but
never replaces the automated gate.

| Area | Required evidence | Gate |
| --- | --- | --- |
| Manifest/package | Format-3 validation, method schema, exact release version, package size, license notices | Automated |
| Memory | Clean v2 initialization and restoration of released v2 representative state | Automated |
| Historical migration | Existing v1-to-v2 migration remains byte/source unchanged and passes | Automated |
| One-time events | Create, read, update, move, resize, delete, stale rejection | Automated + Playwright |
| Recurrence | Daily/weekly/monthly/yearly, count/until, series/occurrence edits and deletes | Automated + Playwright |
| All-day | Exclusive end and DST-safe local dates | Automated |
| Availability | Busy/Free, working days/hours, increments, before/after buffers | Automated |
| Rendezvous | Holds, expiry, confirm/release, read-only confirmed event, no metadata leakage | Automated + Playwright |
| Time zones | UTC, Chicago, New York, London, Kolkata; gap/fold; saved zone drives all UI | Automated + Playwright |
| Search | Full authoritative range, filters, pagination, capacity, stale cursor, private access | Automated + Playwright |
| ICS event export | Required properties, escaping, UTF-8 folding, CRLF, stable UID/SEQUENCE | Automated |
| ICS recurrence | DST-correct recurrence and exceptions imported by Google and Outlook | Automated fixtures + manual evidence |
| ICS range/full export | Bounds, disclosure, expired-hold exclusion, deterministic bytes | Automated + Playwright |
| ICS file delivery | Owner-approved optional Files write, exact saved content, open-Files handoff, and copy-data fallback without a new Calendar capability/root | Automated + Playwright |
| Agent reads | Status, search, get, schedule, free-time with explicit schemas | Automated qualification |
| Agent writes | Create/update/delete, expected revisions, unknown-outcome reconciliation | Automated qualification |
| Agent web workflow | Public research followed by owner-intended Calendar write; no private web query | Manual + deterministic fake model |
| Accessibility | Keyboard create/edit/export/search, focus restoration, labels, error announcements | Playwright |
| Responsive UI | Week/month/day/agenda and editor usable at narrow and desktop sizes | Playwright screenshots |
| Upgrade | State-preserving install from exact Calendar 0.2.0 archive | PocketIC/Playwright |
| Security | Unauthorized calls fail, logout/update invalidates endpoints, no secrets in logs/exports | Automated |

## Baseline recorded 2026-08-31

- Upstream merge: `8e63fd6` over `infu/neutron` `ccf8595`.
- Calendar 0.2.0 release archive:
  - size: 766,354 bytes
  - SHA-256: `e097e9c955e78569675baebc7bcc38138d082e8874695aed01dbba4a96a10817`
- Source/frontend tests: 19 passed.
- Memory restoration: passed.
- Domain suites: availability, domain, v2 series, and v1-to-v2 migration passed.
- Baseline manifest validation and frontend build: passed.

## Current P0 evidence recorded 2026-08-31

- Complete workspace test command: passed (46 Bun tests, memory restoration,
  and the full Motoko validation/availability/domain/series/search/migration
  suite).
- Clean installed-package Playwright: 2 passed, including saved-zone behavior
  across the editor, recurrence preview, calendar grid, and upcoming list.
- Exact released-asset 0.2.0 to 0.3.0 reviewed in-product upgrade: passed after
  rejecting a prior run against mismatched local bytes. The immutable GitHub
  asset was freshly downloaded and verified at 766,354 bytes with SHA-256
  `e097e9c955e78569675baebc7bcc38138d082e8874695aed01dbba4a96a10817`;
  the passing run preserved installation UID, memory inventory, absolute
  instants, timed details, recurrence/free state, an overridden occurrence,
  all-day state, location, and notes. A second two-Neutron upgrade test created
  a confirmed meeting through real Rendezvous calls, forced an unresolved live
  hold, and preserved both through Bob's in-product upgrade while retaining the
  installation UID and memory inventory (1 passed, 34.9 seconds).
- Candidate archive: 428,234 bytes,
  SHA-256 `30b0d9b00572e48235a586abc6a2d3704976c907971017d92a670b52dc158cbe`.
- Offered source: 451,300 bytes,
  SHA-256 `402fbfffbcb4d35ef3984a8e8e45588470497805e3a4d7f9d3ef41f2add2ce80`.
- A real reduced-motion, 430px-wide keyboard test creates an event, searches it,
  and restores focus to the editor. The installed export test approves the
  Calendar-to-Files `write` permission, verifies the exact private path, opens
  Files, and inspects the saved RFC 5545 contents including the created event.
- Authorization/logout test: passed. Revoking the active principal removes the
  Calendar tile and background, and logout removes the principal/session UI.
- Source/privacy audit: passed. Production Calendar code has no application log
  sink, privacy-mode ICS excludes private details and signaling/auth metadata,
  and all frontend/Agent authority is self-scoped. Package-record paths and
  digests, 27 content-addressed Motoko entries, memory lock, license, and source
  offer were decoded and byte-verified.
- Calendar/Agent co-install gate: passed. Calendar and Agent 0.3.9 residents are
  ready together, both launcher entries are present, and Agent reaches its
  OpenRouter connection screen without stopping Calendar. The owner runbook is
  `.plan/calendar-p0-owner-acceptance.md`.
- Exact 0.2.0 → 0.3.0 in-product upgrade passes with unchanged installation UID
  and memory inventory. This specifically proves the optional Files design
  avoids the production incompatibility caused by adding certified-assets to an
  already-installed Calendar scope.
- Remaining acceptance work: Google/Outlook manual import, live Agent 0.3.9,
  final artifact/reproducibility review, commit/push, and explicit publication
  approval.

## Continuous execution rule

After each feature slice, run the closest unit/domain tests immediately. Before
marking a phase complete, run the entire Calendar source/frontend, memory, and
domain suite. Before either release gate, run every row above and attach the
exact command/result evidence to the workplan.
