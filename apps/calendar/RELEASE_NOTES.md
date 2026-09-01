# Calendar release notes

## 0.5.0 — unpublished candidate

- Adds bounded local `.ics` import in a killable worker with explicit preview
  categories, per-series selection, deterministic source/UID matching, and
  diagnostics for unsupported scheduling data.
- Supports VEVENT UTC, floating, all-day, TZID, RRULE, RDATE, EXDATE,
  RECURRENCE-ID, SEQUENCE, SUMMARY, DESCRIPTION, LOCATION, STATUS, and TRANSP
  within reviewed byte/component/property/series/occurrence limits.
- Commits the selected preview atomically through one revision-guarded backend
  mutation. Durable bounded receipts reconcile interrupted responses and allow
  safe undo only while affected series retain their imported revisions.
- Adds privacy-minimal Agent attachment tools for preview, commit, status, and
  undo. Raw source bytes, notes, and locations are not returned to model text.
- Advances Calendar memory to schema v4 through an explicit v3-to-v4 migration;
  the released v1/v2 lineage and locked v3 bytes remain unchanged.
- Qualifies the exact package through a live browser import/undo flow, an
  in-product Calendar 0.2.0-to-0.5.0 upgrade, and a two-Neutron Rendezvous
  regression preserving confirmed meetings and live holds on both peers.

Calendar 0.5.0 remains unpublished until the remaining release checklist and
manual interoperability/Agent acceptance gates are complete and the owner
explicitly authorizes publication.

## 0.4.0 — unpublished P1 foundation

- Adds managed-memory schema v3 for bounded ICS import provenance, reminder
  offsets, and bulk-operation undo receipts.
- Migrates Calendar v2 data without changing existing series, occurrences,
  preferences, revisions, or identifiers. All new P1 collections start empty.
- Retains the complete v1-to-v2 lineage and adds the deterministic v2-to-v3
  edge so an installed Calendar can upgrade without reinstalling or losing
  Rendezvous-owned meetings.

Calendar 0.4.0 was retained as a separately tested migration foundation and was
not published. Calendar 0.5.0 supersedes it with the import/undo implementation.

## 0.3.0 — unpublished candidate

- Uses one saved IANA time zone consistently for the calendar grid, editor,
  recurrence materialization, search results, upcoming events, and scheduling
  preferences. Daylight-saving gaps and folds are detected instead of silently
  shifting an event.
- Adds bounded authoritative event search with text, date, source,
  busy/free, status, and recurrence filters.
- Adds RFC 5545 iCalendar (`.ics`) exports for one event, the visible range, or
  the bounded calendar. Calendar can save each snapshot privately through the
  optional Files app for owner-controlled download, with a copy-data fallback
  when Files is unavailable or declined. Private details and live tentative
  holds are opt-in; expired holds and cancelled occurrences are excluded.
- Adds a resident Calendar service with scoped semantic tools for Neutron Agent:
  status, search, get/list, free-time lookup, create, update, delete, and an
  owner-reviewed export action.
- Adds configurable calendar-grid increments and before/after availability
  buffers.
- Preserves the released `calendar` managed-memory schema at version 2 and adds
  no memory root or backend capability. No Calendar-data migration runs during this release.
  Automated qualification covers clean initialization and a reviewed in-product
  upgrade from the exact 0.2.0 package while preserving installation identity,
  the existing memory roots, stored instants, recurrence, all-day state,
  busy/free state, location, and notes.

Calendar 0.3.0 remains unpublished until the production release checklist is
completed and the owner explicitly authorizes publication.
