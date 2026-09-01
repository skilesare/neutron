# Calendar release notes

## 0.4.0 — in development

- Adds managed-memory schema v3 for bounded ICS import provenance, reminder
  offsets, and bulk-operation undo receipts.
- Migrates Calendar v2 data without changing existing series, occurrences,
  preferences, revisions, or identifiers. All new P1 collections start empty.
- Retains the complete v1-to-v2 lineage and adds the deterministic v2-to-v3
  edge so an installed Calendar can upgrade without reinstalling or losing
  Rendezvous-owned meetings.

Calendar 0.4.0 is not ready for publication until the remaining P1 import,
undo, reminder, interoperability, privacy, and release gates are complete.

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
