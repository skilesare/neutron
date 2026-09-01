import Array "mo:core/Array";
import Blob "mo:core/Blob";
import Nat8 "mo:core/Nat8";
import Nat64 "mo:core/Nat64";
import Runtime "mo:core/Runtime";
import Calendar "../backend/main";
import Memory "../backend/memory/calendar/v4";
import TestEnvironment "TestEnvironment";

func bytes(size : Nat, seed : Nat8) : Blob { Blob.fromArray(Array.tabulate<Nat8>(size, func(index) { seed + Nat8.fromNat(index % 7) })) };
let batch1 = bytes(16, 1);
let batch2 = bytes(16, 21);
let digest1 = bytes(32, 41);
let digest2 = bytes(32, 61);
let preview1 = bytes(32, 81);
let preview2 = bytes(32, 101);
let start : Nat64 = 1_800_000_000_000_000_000;
let hour : Nat64 = 3_600_000_000_000;

func occurrence(key : Text, title : Text, offset : Nat64) : Calendar.ImportOccurrenceInputV1 {
    { recurrence_key = key; start_ns = start + offset; end_ns = start + offset + hour; status = #normal; title; notes = "Plain text notes"; location = "Room 1" }
};

func item(uid : Text, sequence : Nat64, digest : Blob, existing : ?Nat64, expected : ?Nat64, title : Text) : Calendar.ImportSeriesInputV1 {
    { external_uid = uid; sequence; content_digest = digest; existing_series_id = existing; expected_series_revision = expected; availability = #busy; kind = #timed; time_zone = "UTC"; occurrences = [occurrence("20270115T100000Z", title, 0)] }
};

let memory = Memory.init();
let calendar = Calendar.Init(TestEnvironment.make(memory));

// The whole batch is validated before state changes.
let invalidRequest : Calendar.ImportCommitRequestV1 = {
    expected_revision = 0; batch_id = batch1; preview_digest = preview1; source_namespace = "ics:test";
    series = [item("duplicate", 1, digest1, null, null, "One"), item("duplicate", 1, digest2, null, null, "Two")];
};
let #err(invalid) = calendar.calendar_import_commit_v1(invalidRequest) else Runtime.trap("duplicate import accepted");
assert (invalid.code == "invalid" and calendar.calendar_status().revision == 0);
assert (memory.series == [] and memory.occurrences == [] and memory.import_provenance == [] and memory.bulk_receipts == []);

let createRequest : Calendar.ImportCommitRequestV1 = {
    expected_revision = 0; batch_id = batch1; preview_digest = preview1; source_namespace = "ics:test";
    series = [item("event@example.test", 1, digest1, null, null, "Imported one")];
};
let #committed(created) = calendar.calendar_import_commit_v1(createRequest) else Runtime.trap("create import failed");
assert (created.committed_revision == 1 and created.change_count == 1);
assert (calendar.calendar_status().event_count == 1 and memory.series[0].title == "Imported one");
let #already_committed(replayed) = calendar.calendar_import_commit_v1(createRequest) else Runtime.trap("idempotent replay was not reconciled");
assert (replayed.committed_revision == 1 and calendar.calendar_status().revision == 1);
let #committed(status) = calendar.calendar_bulk_status_v1({ batch_id = batch1; preview_digest = preview1 }) else Runtime.trap("receipt status missing");
assert (status.change_count == 1 and status.undone_at_revision == null);
let #digest_mismatch(_) = calendar.calendar_bulk_status_v1({ batch_id = batch1; preview_digest = preview2 }) else Runtime.trap("digest mismatch not reported");

let index = calendar.calendar_import_index_v1({ source_namespace = "ics:test"; external_uids = ["event@example.test", "missing"] });
assert (index.revision == 1 and index.entries.size() == 1);
assert (index.entries[0].series_id == 1 and index.entries[0].series_revision == 1 and index.entries[0].sequence == 1);

let updateRequest : Calendar.ImportCommitRequestV1 = {
    expected_revision = 1; batch_id = batch2; preview_digest = preview2; source_namespace = "ics:test";
    series = [item("event@example.test", 2, digest2, ?1, ?1, "Imported two")];
};
let #committed(updated) = calendar.calendar_import_commit_v1(updateRequest) else Runtime.trap("update import failed");
assert (updated.committed_revision == 2 and memory.series[0].revision == 2 and memory.series[0].title == "Imported two");
let #undone(undone) = calendar.calendar_bulk_undo_v1({ batch_id = batch2; preview_digest = preview2 }) else Runtime.trap("update undo failed");
assert (undone.revision == 3 and memory.series[0].revision == 1 and memory.series[0].title == "Imported one");
assert (memory.import_provenance[0].sequence == 1 and memory.import_provenance[0].content_digest == digest1);
let #already_undone(again) = calendar.calendar_bulk_undo_v1({ batch_id = batch2; preview_digest = preview2 }) else Runtime.trap("undo replay was not idempotent");
assert (again.revision == 3);

// A later occurrence edit advances the owning series revision and blocks undo.
let batch3 = bytes(16, 121);
let preview3 = bytes(32, 141);
let createSecond : Calendar.ImportCommitRequestV1 = {
    expected_revision = 3; batch_id = batch3; preview_digest = preview3; source_namespace = "ics:test";
    series = [item("second@example.test", 1, digest2, null, null, "Second")];
};
let #committed(_) = calendar.calendar_import_commit_v1(createSecond) else Runtime.trap("second create failed");
let secondOccurrence = calendar.calendar_series_occurrences_v2({ series_id = 2; offset = 0; limit = 10 }).occurrences[0];
let #ok(edited) = calendar.calendar_occurrence_update_v2({ occurrence_id = secondOccurrence.id; expected_occurrence_revision = secondOccurrence.revision; start_ns = secondOccurrence.start_ns + hour; end_ns = secondOccurrence.end_ns + hour; title_override = ?"Owner edit"; notes_override = null; location_override = null }) else Runtime.trap("owner edit failed");
assert (edited.series_revision == 2);
let #err(conflict) = calendar.calendar_bulk_undo_v1({ batch_id = batch3; preview_digest = preview3 }) else Runtime.trap("conflicting undo was accepted");
assert (conflict.code == "undo_conflict" and memory.series.size() == 2);

// Receipt retention is deterministic: pre-load the bounded durable state, then
// prove one real commit evicts only the oldest receipt and retains the newest.
let oldestBatch = bytes(16, 150);
memory.bulk_receipts := Array.tabulate<Memory.BulkReceipt>(20, func(index) {
    {
        batch_id = bytes(16, Nat8.fromNat(150 + index));
        preview_digest = bytes(32, Nat8.fromNat(180 + index));
        committed_revision = Nat64.fromNat(index);
        created_at_ns = Nat64.fromNat(index);
        changes = [];
        undone_at_revision = null;
    }
});
let latestBatch = bytes(16, 220);
let latestPreview = bytes(32, 221);
let retentionRequest : Calendar.ImportCommitRequestV1 = {
    expected_revision = calendar.calendar_status().revision;
    batch_id = latestBatch;
    preview_digest = latestPreview;
    source_namespace = "ics:retention";
    series = [item("retained@example.test", 1, digest1, null, null, "Retained receipt")];
};
let #committed(_) = calendar.calendar_import_commit_v1(retentionRequest) else Runtime.trap("receipt retention import failed");
assert (memory.bulk_receipts.size() == 20);
let #not_found(_) = calendar.calendar_bulk_status_v1({ batch_id = oldestBatch; preview_digest = bytes(32, 180) }) else Runtime.trap("oldest receipt was not evicted");
let #committed(latest) = calendar.calendar_bulk_status_v1({ batch_id = latestBatch; preview_digest = latestPreview }) else Runtime.trap("latest retained receipt missing");
assert (latest.change_count == 1);
