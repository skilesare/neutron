import Blob "mo:core/Blob";
import V3 "../backend/memory/calendar/v3";
import V4 "../backend/memory/calendar/v4";
import Migration "../backend/memory/calendar/v3_to_v4";

let old = V3.init();
let series : V3.EventSeries = { id = 7; revision = 4; title = "Imported"; notes = "Private"; location = "Room"; color = "sage"; availability = #busy; kind = #timed; source = #owner; time_zone = "UTC"; recurrence = null; created_at_ns = 1; updated_at_ns = 2 };
let occurrence : V3.Occurrence = { id = 9; revision = 2; series_id = 7; recurrence_key = "once"; start_ns = 10; end_ns = 20; status = #normal; title_override = null; notes_override = null; location_override = null };
let provenance : V3.ImportProvenance = { series_id = 7; source_namespace = "ics:test"; external_uid = "event"; sequence = 3; content_digest = Blob.fromArray([1, 2, 3]) };
let snapshot : V3.SeriesSnapshot = { series; occurrences = [occurrence]; provenance = ?provenance; reminders = [] };
old.revision := 12; old.next_series_id := 8; old.next_occurrence_id := 10; old.series := [series]; old.occurrences := [occurrence]; old.import_provenance := [provenance];
old.bulk_receipts := [{ batch_id = Blob.fromArray([1]); preview_digest = Blob.fromArray([2]); committed_revision = 12; created_at_ns = 3; changes = [#created({ series_id = 7 }), #replaced(snapshot), #deleted(snapshot)]; undone_at_revision = null }];

let migrated : V4.Mem = Migration.migrate(old);
assert (migrated.revision == 12 and migrated.next_series_id == 8 and migrated.next_occurrence_id == 10);
assert (migrated.series == old.series and migrated.occurrences == old.occurrences and migrated.preferences == old.preferences);
assert (migrated.import_provenance == old.import_provenance and migrated.reminders == old.reminders);
assert (migrated.bulk_receipts.size() == 1 and migrated.bulk_receipts[0].changes.size() == 3);
switch (migrated.bulk_receipts[0].changes[0]) { case (#created(value)) assert (value.series_id == 7 and value.expected_series_revision == 4); case (_) assert false };
switch (migrated.bulk_receipts[0].changes[1]) { case (#replaced(value)) assert (value.before.series.id == 7 and value.expected_series_revision == 4); case (_) assert false };

let clean = V4.init();
assert (clean.revision == 0 and clean.series == [] and clean.bulk_receipts == []);
