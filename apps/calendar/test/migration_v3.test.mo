import Array "mo:core/Array";
import Blob "mo:core/Blob";
import Nat64 "mo:core/Nat64";
import V2 "../backend/memory/calendar/v2";
import V3 "../backend/memory/calendar/v3";
import Migration "../backend/memory/calendar/v2_to_v3";

func series(id : Nat64) : V2.EventSeries {
    {
        id;
        revision = id + 10;
        title = "Series " # Nat64.toText(id);
        notes = "Private notes";
        location = "Room 1";
        color = "sage";
        availability = if (id % 2 == 0) #busy else #free;
        kind = if (id % 3 == 0) #all_day else #timed;
        source = if (id % 5 == 0) #rendezvous(Blob.fromArray([1, 2, 3])) else #owner;
        time_zone = "America/Chicago";
        recurrence = ?{
            frequency = #weekly;
            interval = 1;
            weekdays_mask = 62;
            month_day = null;
            end = #count(10);
        };
        created_at_ns = id * 100;
        updated_at_ns = id * 100 + 1;
    }
};

func occurrence(id : Nat64, seriesId : Nat64) : V2.Occurrence {
    {
        id;
        revision = id + 20;
        series_id = seriesId;
        recurrence_key = "occurrence:" # Nat64.toText(id);
        start_ns = id * 1_000;
        end_ns = id * 1_000 + 500;
        status = switch (id % 5) {
            case (0) #normal;
            case (1) #overridden;
            case (2) #cancelled;
            case (3) #hold(id * 1_000 + 900);
            case (_) #confirmed;
        };
        title_override = if (id % 2 == 0) ?"Override" else null;
        notes_override = null;
        location_override = if (id % 3 == 0) ?"Elsewhere" else null;
    }
};

let old = V2.init();
old.revision := 77;
old.next_series_id := 4;
old.next_occurrence_id := 7;
old.series := [series(1), series(2), series(3)];
old.occurrences := [
    occurrence(1, 1),
    occurrence(2, 1),
    occurrence(3, 2),
    occurrence(4, 2),
    occurrence(5, 3),
    occurrence(6, 3),
];
old.preferences := {
    day_start_minute = 480;
    day_end_minute = 1_140;
    allowed_weekdays_mask = 127;
    slot_increment_minutes = 30;
    buffer_before_minutes = 15;
    buffer_after_minutes = 20;
    display_time_zone = "Asia/Kolkata";
};

let migrated : V3.Mem = Migration.migrate(old);
assert (migrated.revision == old.revision);
assert (migrated.next_series_id == old.next_series_id);
assert (migrated.next_occurrence_id == old.next_occurrence_id);
assert (migrated.series == old.series);
assert (migrated.occurrences == old.occurrences);
assert (migrated.preferences == old.preferences);
assert (migrated.import_provenance == []);
assert (migrated.reminders == []);
assert (migrated.bulk_receipts == []);

// Exercise the configured production capacity without changing or filtering
// any v2 value. The migration is a bounded field transfer with empty P1 state.
let maximum = V2.init();
maximum.revision := 99;
maximum.next_series_id := 2_001;
maximum.next_occurrence_id := 10_001;
maximum.series := Array.tabulate<V2.EventSeries>(2_000, func(index) {
    series(Nat64.fromNat(index + 1))
});
maximum.occurrences := Array.tabulate<V2.Occurrence>(10_000, func(index) {
    let id = Nat64.fromNat(index + 1);
    occurrence(id, Nat64.fromNat(index % 2_000 + 1))
});

let maximumMigrated : V3.Mem = Migration.migrate(maximum);
assert (maximumMigrated.series.size() == 2_000);
assert (maximumMigrated.occurrences.size() == 10_000);
assert (maximumMigrated.series[1_999] == maximum.series[1_999]);
assert (maximumMigrated.occurrences[9_999] == maximum.occurrences[9_999]);
assert (maximumMigrated.import_provenance.size() == 0);
assert (maximumMigrated.reminders.size() == 0);
assert (maximumMigrated.bulk_receipts.size() == 0);

let clean = V3.init();
assert (clean.revision == 0);
assert (clean.next_series_id == 1 and clean.next_occurrence_id == 1);
assert (clean.series == [] and clean.occurrences == []);
assert (clean.import_provenance == [] and clean.reminders == [] and clean.bulk_receipts == []);
