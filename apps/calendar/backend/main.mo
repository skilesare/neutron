import Array "mo:core/Array";
import Blob "mo:core/Blob";
import Iter "mo:core/Iter";
import Int "mo:core/Int";
import Nat "mo:core/Nat";
import Nat8 "mo:core/Nat8";
import Nat16 "mo:core/Nat16";
import Nat32 "mo:core/Nat32";
import Nat64 "mo:core/Nat64";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Availability "AvailabilityV2";
import Memory "memory/calendar/v4";
import Validation "Validation";

module {
    let MAX_SERIES = 2_000; let MAX_OCCURRENCES = 10_000; let MAX_SERIES_OCCURRENCES = 730; let MAX_RANGE_RESULTS = 2_000; let MAX_SEARCH_SCAN = 2_000;
    let MAX_IMPORT_SERIES = 250; let MAX_IMPORT_OCCURRENCES = 2_000; let MAX_BULK_RECEIPTS = 20; let MAX_BULK_RECEIPT_BYTES = 2_000_000;
    let MAX_REMINDERS = 4_000; let MAX_REMINDER_RESULTS = 200; let MAX_REMINDER_OFFSET_MINUTES : Nat32 = 10_080;
    public type Status = { revision : Nat64; event_count : Nat };
    public type Error = { code : Text; message : Text; revision : Nat64 };
    public type EventView = { id : Nat64; revision : Nat64; start_ns : Nat64; end_ns : Nat64; title : Text; notes : Text; source : Text; status : Text; hold_expires_at_ns : ?Nat64 };
    public type EventResult = { #ok : EventView; #err : Error };
    public type MutationResult = { #ok : { revision : Nat64 }; #err : Error };
    public type ListRequest = { offset : Nat; limit : Nat };
    public type EventPage = { revision : Nat64; total : Nat; events : [EventView] };
    public type CreateRequest = { expected_revision : Nat64; start_ns : Nat64; end_ns : Nat64; title : Text; notes : Text };
    public type UpdateRequest = { id : Nat64; expected_event_revision : Nat64; start_ns : Nat64; end_ns : Nat64; title : Text; notes : Text };
    public type RemoveRequest = { id : Nat64; expected_event_revision : Nat64 };

    public type PreferencesView = { revision : Nat64; day_start_minute : Nat16; day_end_minute : Nat16; allowed_weekdays_mask : Nat8; slot_increment_minutes : Nat16; buffer_before_minutes : Nat16; buffer_after_minutes : Nat16; display_time_zone : Text };
    public type PreferencesSetRequest = { expected_revision : Nat64; day_start_minute : Nat16; day_end_minute : Nat16; allowed_weekdays_mask : Nat8; slot_increment_minutes : Nat16; buffer_before_minutes : Nat16; buffer_after_minutes : Nat16; display_time_zone : Text };
    public type PreferencesResult = { #ok : PreferencesView; #err : Error };

    public type AvailabilityMode = { #busy; #free };
    public type EventKind = { #timed; #all_day };
    public type Frequency = { #daily; #weekly; #monthly; #yearly };
    public type RecurrenceEnd = { #count : Nat16; #until : Nat64 };
    public type RecurrenceRule = { frequency : Frequency; interval : Nat8; weekdays_mask : Nat8; month_day : ?Nat8; end : RecurrenceEnd };
    public type OccurrenceInput = { recurrence_key : Text; start_ns : Nat64; end_ns : Nat64 };
    public type SeriesWrite = { title : Text; notes : Text; location : Text; color : Text; availability : AvailabilityMode; kind : EventKind; time_zone : Text; recurrence : ?RecurrenceRule; occurrences : [OccurrenceInput] };
    public type SeriesCreateRequest = { expected_revision : Nat64; value : SeriesWrite };
    public type SeriesUpdateRequest = { series_id : Nat64; expected_series_revision : Nat64; value : SeriesWrite };
    public type SeriesRemoveRequest = { series_id : Nat64; expected_series_revision : Nat64 };
    public type OccurrenceUpdateRequest = { occurrence_id : Nat64; expected_occurrence_revision : Nat64; start_ns : Nat64; end_ns : Nat64; title_override : ?Text; notes_override : ?Text; location_override : ?Text };
    public type OccurrenceRemoveRequest = { occurrence_id : Nat64; expected_occurrence_revision : Nat64 };
    public type RangeRequest = { start_ns : Nat64; end_ns : Nat64; offset : Nat; limit : Nat };
    public type SeriesView = { id : Nat64; revision : Nat64; title : Text; notes : Text; location : Text; color : Text; availability : AvailabilityMode; kind : EventKind; source : Text; imported : Bool; time_zone : Text; recurrence : ?RecurrenceRule; created_at_ns : Nat64; updated_at_ns : Nat64 };
    public type OccurrenceView = { id : Nat64; revision : Nat64; series_id : Nat64; series_revision : Nat64; recurrence_key : Text; start_ns : Nat64; end_ns : Nat64; title : Text; notes : Text; location : Text; color : Text; availability : AvailabilityMode; kind : EventKind; source : Text; status : Text; time_zone : Text };
    public type RangePage = { revision : Nat64; total : Nat; occurrences : [OccurrenceView] };
    public type SeriesOccurrencesRequest = { series_id : Nat64; offset : Nat; limit : Nat };
    public type SeriesOccurrencesPage = { revision : Nat64; total : Nat; occurrences : [OccurrenceView] };
    public type ExportRequestV1 = { series_id : ?Nat64; occurrence_id : ?Nat64; start_ns : ?Nat64; end_ns : ?Nat64; include_holds : Bool; offset : Nat; limit : Nat };
    public type ExportOccurrenceV1 = { occurrence : OccurrenceView; series_updated_at_ns : Nat64; time_zone : Text };
    public type ExportPageV1 = { revision : Nat64; total : Nat; occurrences : [ExportOccurrenceV1] };
    type SearchRuntimeRequest = { query_text : Text; start_ns : ?Nat64; end_ns : ?Nat64; source : ?Text; availability : ?AvailabilityMode; status : ?Text; recurring : ?Bool; expected_revision : ?Nat64; offset : Nat; limit : Nat };
    public type SearchPageV1 = { revision : Nat64; scanned : Nat; occurrences : [OccurrenceView]; next_offset : ?Nat };
    public type SearchResultV1 = { #ok : SearchPageV1; #stale : { revision : Nat64 }; #invalid : { message : Text; revision : Nat64 } };
    public type SeriesResult = { #ok : SeriesView; #err : Error };
    public type OccurrenceResult = { #ok : OccurrenceView; #err : Error };

    public type ImportIndexRequestV1 = { source_namespace : Text; external_uids : [Text] };
    public type ImportIndexEntryV1 = { external_uid : Text; series_id : Nat64; series_revision : Nat64; sequence : Nat64; content_digest : Blob };
    public type ImportIndexV1 = { revision : Nat64; entries : [ImportIndexEntryV1] };
    public type ImportOccurrenceInputV1 = { recurrence_key : Text; start_ns : Nat64; end_ns : Nat64; status : { #normal; #cancelled }; title : Text; notes : Text; location : Text };
    public type ImportSeriesInputV1 = { external_uid : Text; sequence : Nat64; content_digest : Blob; existing_series_id : ?Nat64; expected_series_revision : ?Nat64; availability : AvailabilityMode; kind : EventKind; time_zone : Text; occurrences : [ImportOccurrenceInputV1] };
    public type ImportCommitRequestV1 = { expected_revision : Nat64; batch_id : Blob; preview_digest : Blob; source_namespace : Text; series : [ImportSeriesInputV1] };
    public type BulkReceiptViewV1 = { batch_id : Blob; preview_digest : Blob; committed_revision : Nat64; created_at_ns : Nat64; change_count : Nat; undone_at_revision : ?Nat64 };
    public type ImportCommitResultV1 = { #committed : BulkReceiptViewV1; #already_committed : BulkReceiptViewV1; #err : Error };
    public type BulkStatusRequestV1 = { batch_id : Blob; preview_digest : Blob };
    public type BulkStatusResultV1 = { #committed : BulkReceiptViewV1; #not_found : { revision : Nat64 }; #digest_mismatch : { revision : Nat64 } };
    public type BulkUndoRequestV1 = { batch_id : Blob; preview_digest : Blob };
    public type BulkUndoResultV1 = { #undone : { revision : Nat64 }; #already_undone : { revision : Nat64 }; #err : Error };

    public type ReminderGetRequestV1 = { series_id : Nat64; occurrence_id : ?Nat64 };
    public type ReminderViewV1 = { revision : Nat64; calendar_revision : Nat64; series_id : Nat64; occurrence_id : ?Nat64; offset_minutes : ?Nat32; inherited : Bool };
    public type ReminderSetRequestV1 = { series_id : Nat64; occurrence_id : ?Nat64; expected_series_revision : Nat64; offset_minutes : ?Nat32 };
    public type ReminderResultV1 = { #ok : ReminderViewV1; #err : Error };
    public type ReminderScheduleRequestV1 = { due_start_ns : Nat64; due_end_ns : Nat64; limit : Nat };
    public type ReminderOccurrenceV1 = { occurrence : OccurrenceView; due_at_ns : Nat64; offset_minutes : Nat32 };
    public type ReminderScheduleV1 = { revision : Nat64; total : Nat; reminders : [ReminderOccurrenceV1] };

    public type AvailabilityRequestV1 = { window_start_ns : Nat64; window_end_ns : Nat64; duration_minutes : Nat32; candidate_starts_ns : [Nat64] };
    public type AvailabilityResultV1 = { revision : Nat64; available_starts_ns : [Nat64] };
    public type ReserveRequestV1 = { external_id : Blob; expected_revision : Nat64; start_ns : Nat64; duration_minutes : Nat32; meeting_label : Text; hold_expires_at_ns : Nat64 };
    public type ReserveResultV1 = { #reserved : { event_id : Nat64; event_revision : Nat64; calendar_revision : Nat64 }; #conflict : { calendar_revision : Nat64 }; #stale : { calendar_revision : Nat64 }; #invalid; #full };
    public type ExternalRequestV1 = { external_id : Blob };
    public type ExternalResultV1 = { #ok : { calendar_revision : Nat64 }; #not_found : { calendar_revision : Nat64 }; #invalid };
    public type AppBackendEnvironment = {
        stable_memory : {
            calendar : Memory.Mem;
        };
    };

    public class Init(env : AppBackendEnvironment) {
        let mem = env.stable_memory.calendar;

        public func /*query*/calendar_status() : Status { { revision = mem.revision; event_count = activeOccurrences().size() } };
        public func /*query*/calendar_list(request : ListRequest) : EventPage {
            let values = activeOccurrences(); let (start, finish) = bounds(request.offset, request.limit, values.size(), Validation.MAX_PAGE);
            { revision = mem.revision; total = values.size(); events = Array.tabulate<EventView>(finish - start, func(index) { legacyView(values[start + index]) }) }
        };
        public func /*query*/calendar_range_v2(request : RangeRequest) : RangePage {
            if (not validRange(request.start_ns, request.end_ns)) return { revision = mem.revision; total = 0; occurrences = [] };
            let values = Array.sort<Memory.Occurrence>(Array.filter<Memory.Occurrence>(activeOccurrences(), func(item) { item.start_ns < request.end_ns and request.start_ns < item.end_ns }), func(left, right) { Nat64.compare(left.start_ns, right.start_ns) });
            let (start, finish) = bounds(request.offset, request.limit, values.size(), MAX_RANGE_RESULTS);
            { revision = mem.revision; total = values.size(); occurrences = Array.tabulate<OccurrenceView>(finish - start, func(index) { occurrenceView(values[start + index]) }) }
        };
        public func /*query*/calendar_series_get_v2(request : { series_id : Nat64 }) : ?SeriesView { switch (findSeries(request.series_id)) { case (?(_, item)) ?seriesView(item); case null null } };
        public func /*query*/calendar_series_occurrences_v2(request : SeriesOccurrencesRequest) : SeriesOccurrencesPage {
            let values = Array.sort<Memory.Occurrence>(Array.filter<Memory.Occurrence>(mem.occurrences, func(item) { item.series_id == request.series_id }), func(left, right) { Nat64.compare(left.start_ns, right.start_ns) });
            let (start, finish) = bounds(request.offset, request.limit, values.size(), MAX_SERIES_OCCURRENCES);
            { revision = mem.revision; total = values.size(); occurrences = Array.tabulate<OccurrenceView>(finish - start, func(index) { occurrenceView(values[start + index]) }) }
        };
        public func /*query*/calendar_export_v1(request : ExportRequestV1) : ExportPageV1 {
            let now = nowNs();
            let values = Array.sort<Memory.Occurrence>(Array.filter<Memory.Occurrence>(mem.occurrences, func(item) {
                let seriesMatches = switch (request.series_id) { case (?id) item.series_id == id; case null true };
                let occurrenceMatches = switch (request.occurrence_id) { case (?id) item.id == id; case null true };
                let rangeMatches = switch (request.start_ns, request.end_ns) {
                    case (?start, ?finish) start < finish and item.start_ns < finish and start < item.end_ns;
                    case (null, null) true;
                    case (_) false;
                };
                let statusMatches = switch (item.status) {
                    case (#hold(expires)) request.include_holds and expires > now;
                    case (_) true;
                };
                seriesMatches and occurrenceMatches and rangeMatches and statusMatches
            }), func(left, right) { Nat64.compare(left.start_ns, right.start_ns) });
            let (start, finish) = bounds(request.offset, request.limit, values.size(), Validation.MAX_PAGE);
            {
                revision = mem.revision;
                total = values.size();
                occurrences = Array.tabulate<ExportOccurrenceV1>(finish - start, func(index) {
                    let item = values[start + index];
                    let view = occurrenceView(item);
                    let ?(_, series) = findSeries(item.series_id) else return { occurrence = view; series_updated_at_ns = 0; time_zone = "UTC" };
                    { occurrence = view; series_updated_at_ns = series.updated_at_ns; time_zone = series.time_zone }
                });
            }
        };
        public func /*query*/calendar_search_v1(wire : Text) : SearchResultV1 {
            let ?request = decodeSearchWire(wire) else return #invalid({ message = "Invalid calendar search transport"; revision = mem.revision });
            switch (request.expected_revision) { case (?expected) if (expected != mem.revision) return #stale({ revision = mem.revision }); case (_) {} };
            if (not validSearchRequest(request)) return #invalid({ message = "Invalid or unbounded calendar search"; revision = mem.revision });
            let needle = Text.toLower(request.query_text);
            let start = if (request.offset > mem.occurrences.size()) mem.occurrences.size() else request.offset;
            let scanFinish = if (start + MAX_SEARCH_SCAN > mem.occurrences.size()) mem.occurrences.size() else start + MAX_SEARCH_SCAN;
            var index = start;
            var values : [OccurrenceView] = [];
            while (index < scanFinish and values.size() < request.limit) {
                let item = mem.occurrences[index];
                if (matchesSearch(item, needle, request)) values := Array.concat(values, [occurrenceView(item)]);
                index += 1;
            };
            #ok({ revision = mem.revision; scanned = index - start; occurrences = values; next_offset = if (index < mem.occurrences.size()) ?index else null })
        };

        public func /*query*/calendar_import_index_v1(request : ImportIndexRequestV1) : ImportIndexV1 {
            if (not validImportNamespace(request.source_namespace) or request.external_uids.size() > MAX_IMPORT_SERIES) return { revision = mem.revision; entries = [] };
            var entries : [ImportIndexEntryV1] = [];
            for (uid in request.external_uids.vals()) {
                if (validImportUid(uid)) {
                    switch (findImportProvenance(request.source_namespace, uid)) {
                        case (?(_, provenance)) {
                            switch (findSeries(provenance.series_id)) {
                                case (?(_, series)) entries := Array.concat(entries, [{ external_uid = uid; series_id = series.id; series_revision = series.revision; sequence = provenance.sequence; content_digest = provenance.content_digest }]);
                                case null {};
                            }
                        };
                        case null {};
                    }
                }
            };
            { revision = mem.revision; entries }
        };

        public func /*query*/calendar_reminder_get_v1(request : ReminderGetRequestV1) : ?ReminderViewV1 {
            let ?(_, series) = findSeries(request.series_id) else return null;
            switch (request.occurrence_id) {
                case (?occurrenceId) {
                    let ?(_, occurrence) = findOccurrence(occurrenceId) else return null;
                    if (occurrence.series_id != series.id) return null;
                    switch (findReminder(series.id, ?occurrenceId)) {
                        case (?reminder) ?reminderView(series, ?occurrenceId, ?reminder.offset_minutes, false);
                        case null switch (findReminder(series.id, null)) {
                            case (?reminder) ?reminderView(series, ?occurrenceId, ?reminder.offset_minutes, true);
                            case null ?reminderView(series, ?occurrenceId, null, false);
                        };
                    }
                };
                case null switch (findReminder(series.id, null)) {
                    case (?reminder) ?reminderView(series, null, ?reminder.offset_minutes, false);
                    case null ?reminderView(series, null, null, false);
                };
            }
        };
        public func /*query*/calendar_reminder_schedule_v1(request : ReminderScheduleRequestV1) : ReminderScheduleV1 {
            if (request.due_start_ns >= request.due_end_ns) return { revision = mem.revision; total = 0; reminders = [] };
            var values : [ReminderOccurrenceV1] = [];
            for (occurrence in mem.occurrences.vals()) {
                switch (occurrence.status) {
                    case (#cancelled or #hold(_)) {};
                    case (_) switch (effectiveReminder(occurrence)) {
                        case (?offset) {
                            let delta = Nat64.fromNat(Nat32.toNat(offset)) * 60_000_000_000;
                            if (occurrence.start_ns >= delta) {
                                let due = occurrence.start_ns - delta;
                                if (due >= request.due_start_ns and due < request.due_end_ns) values := Array.concat(values, [{ occurrence = occurrenceView(occurrence); due_at_ns = due; offset_minutes = offset }]);
                            }
                        };
                        case null {};
                    };
                }
            };
            let sorted = Array.sort<ReminderOccurrenceV1>(values, func(left, right) { Nat64.compare(left.due_at_ns, right.due_at_ns) });
            let (_, finish) = bounds(0, request.limit, sorted.size(), MAX_REMINDER_RESULTS);
            { revision = mem.revision; total = sorted.size(); reminders = Array.tabulate<ReminderOccurrenceV1>(finish, func(index) { sorted[index] }) }
        };
        public func /*update*/calendar_reminder_set_v1(request : ReminderSetRequestV1) : ReminderResultV1 {
            let ?(seriesIndex, series) = findSeries(request.series_id) else return #err(error("not_found", "Series not found", mem.revision));
            if (series.revision != request.expected_series_revision) return #err(error("stale", "Series changed", mem.revision));
            switch (request.occurrence_id) {
                case (?occurrenceId) {
                    let ?(_, occurrence) = findOccurrence(occurrenceId) else return #err(error("not_found", "Occurrence not found", mem.revision));
                    if (occurrence.series_id != series.id) return #err(error("invalid", "Occurrence does not belong to this series", mem.revision));
                };
                case null {};
            };
            switch (request.offset_minutes) { case (?offset) if (offset > MAX_REMINDER_OFFSET_MINUTES) return #err(error("invalid", "Reminder must be between event time and seven days before", mem.revision)); case (_) {} };
            let existing = findReminder(series.id, request.occurrence_id);
            if (existing == null and request.offset_minutes != null and mem.reminders.size() >= MAX_REMINDERS) return #err(error("full", "Reminder capacity reached", mem.revision));
            mem.reminders := Array.filter<Memory.Reminder>(mem.reminders, func(item) { not reminderKeyMatches(item, series.id, request.occurrence_id) });
            switch (request.offset_minutes) { case (?offset) mem.reminders := Array.concat(mem.reminders, [{ series_id = series.id; occurrence_id = request.occurrence_id; offset_minutes = offset }]); case null {} };
            let updated = { series with revision = series.revision + 1; updated_at_ns = nowNs() };
            mem.series := replaceAt(mem.series, seriesIndex, updated); mem.revision += 1;
            #ok(reminderView(updated, request.occurrence_id, request.offset_minutes, false))
        };

        public func /*update*/calendar_import_commit_v1(request : ImportCommitRequestV1) : ImportCommitResultV1 {
            switch (findBulkReceipt(request.batch_id)) {
                case (?(_, receipt)) {
                    if (receipt.preview_digest == request.preview_digest) return #already_committed(receiptView(receipt));
                    return #err(error("batch_conflict", "Batch ID was already used for a different preview", mem.revision));
                };
                case null {};
            };
            if (request.expected_revision != mem.revision) return #err(error("stale", "Calendar changed; refresh the import preview", mem.revision));
            switch (validateImportRequest(request)) { case (?problem) return #err(problem); case null {} };

            var nextSeriesId = mem.next_series_id;
            var nextOccurrenceId = mem.next_occurrence_id;
            var nextSeries = mem.series;
            var nextOccurrences = mem.occurrences;
            var nextProvenance = mem.import_provenance;
            var changes : [Memory.BulkUndoChange] = [];
            let now = nowNs();
            for (input in request.series.vals()) {
                let first = input.occurrences[0];
                switch (input.existing_series_id) {
                    case null {
                        let id = nextSeriesId; nextSeriesId += 1;
                        let created : Memory.EventSeries = {
                            id; revision = 1; title = first.title; notes = first.notes; location = first.location; color = "sage";
                            availability = input.availability; kind = input.kind; source = #owner; time_zone = input.time_zone;
                            recurrence = null; created_at_ns = now; updated_at_ns = now;
                        };
                        let built = importOccurrences(id, input.occurrences, [], nextOccurrenceId);
                        nextOccurrenceId := built.next_id;
                        nextSeries := Array.concat(nextSeries, [created]);
                        nextOccurrences := Array.concat(nextOccurrences, built.values);
                        nextProvenance := Array.concat(nextProvenance, [{ series_id = id; source_namespace = request.source_namespace; external_uid = input.external_uid; sequence = input.sequence; content_digest = input.content_digest }]);
                        let change : Memory.BulkUndoChange = #created({ series_id = id; expected_series_revision = 1 : Nat64 });
                        changes := Array.concat(changes, [change]);
                    };
                    case (?id) {
                        let ?(seriesIndex, current) = findSeriesIn(nextSeries, id) else return #err(error("stale", "An imported series no longer exists", mem.revision));
                        let priorOccurrences = Array.filter<Memory.Occurrence>(nextOccurrences, func(item) { item.series_id == id });
                        let priorProvenance = switch (findImportProvenanceIn(nextProvenance, request.source_namespace, input.external_uid)) { case (?(_, value)) ?value; case null null };
                        let priorReminders = Array.filter<Memory.Reminder>(mem.reminders, func(item) { item.series_id == id });
                        let before : Memory.SeriesSnapshot = { series = current; occurrences = priorOccurrences; provenance = priorProvenance; reminders = priorReminders };
                        let updated : Memory.EventSeries = {
                            current with revision = current.revision + 1; title = first.title; notes = first.notes; location = first.location;
                            availability = input.availability; kind = input.kind; time_zone = input.time_zone; recurrence = null; updated_at_ns = now;
                        };
                        let built = importOccurrences(id, input.occurrences, priorOccurrences, nextOccurrenceId);
                        nextOccurrenceId := built.next_id;
                        nextSeries := replaceAt(nextSeries, seriesIndex, updated);
                        nextOccurrences := Array.concat(Array.filter<Memory.Occurrence>(nextOccurrences, func(item) { item.series_id != id }), built.values);
                        let ?(provenanceIndex, _) = findImportProvenanceIn(nextProvenance, request.source_namespace, input.external_uid) else return #err(error("stale", "Import provenance changed", mem.revision));
                        nextProvenance := replaceAt(nextProvenance, provenanceIndex, { series_id = id; source_namespace = request.source_namespace; external_uid = input.external_uid; sequence = input.sequence; content_digest = input.content_digest });
                        changes := Array.concat(changes, [#replaced({ before; expected_series_revision = updated.revision })]);
                    };
                }
            };
            if (bulkChangesBytes(changes) > MAX_BULK_RECEIPT_BYTES) return #err(error("receipt_too_large", "Import undo preimage exceeds the 2,000,000 byte receipt limit", mem.revision));
            let committedRevision = mem.revision + 1;
            let receipt : Memory.BulkReceipt = { batch_id = request.batch_id; preview_digest = request.preview_digest; committed_revision = committedRevision; created_at_ns = now; changes; undone_at_revision = null };
            mem.next_series_id := nextSeriesId;
            mem.next_occurrence_id := nextOccurrenceId;
            mem.series := nextSeries;
            mem.occurrences := nextOccurrences;
            mem.import_provenance := nextProvenance;
            mem.revision := committedRevision;
            mem.bulk_receipts := appendBoundedReceipt(mem.bulk_receipts, receipt);
            #committed(receiptView(receipt))
        };

        public func /*query*/calendar_bulk_status_v1(request : BulkStatusRequestV1) : BulkStatusResultV1 {
            switch (findBulkReceipt(request.batch_id)) {
                case null #not_found({ revision = mem.revision });
                case (?(_, receipt)) {
                    if (receipt.preview_digest == request.preview_digest) #committed(receiptView(receipt))
                    else #digest_mismatch({ revision = mem.revision })
                };
            }
        };

        public func /*update*/calendar_bulk_undo_v1(request : BulkUndoRequestV1) : BulkUndoResultV1 {
            let ?(receiptIndex, receipt) = findBulkReceipt(request.batch_id) else return #err(error("not_found", "Import receipt not found or expired", mem.revision));
            if (receipt.preview_digest != request.preview_digest) return #err(error("digest_mismatch", "Receipt does not match this preview", mem.revision));
            switch (receipt.undone_at_revision) { case (?revision) return #already_undone({ revision }); case null {} };
            var conflicts : [Text] = [];
            for (change in receipt.changes.vals()) {
                switch (change) {
                    case (#created(value)) switch (findSeries(value.series_id)) { case (?(_, series)) if (series.revision != value.expected_series_revision) conflicts := Array.concat(conflicts, [Nat64.toText(value.series_id)]); case null conflicts := Array.concat(conflicts, [Nat64.toText(value.series_id)]); case (_) {} };
                    case (#replaced(value)) switch (findSeries(value.before.series.id)) { case (?(_, series)) if (series.revision != value.expected_series_revision) conflicts := Array.concat(conflicts, [Nat64.toText(value.before.series.id)]); case null conflicts := Array.concat(conflicts, [Nat64.toText(value.before.series.id)]); case (_) {} };
                    case (#deleted(value)) switch (findSeries(value.series.id)) { case (?_) conflicts := Array.concat(conflicts, [Nat64.toText(value.series.id)]); case null {} };
                }
            };
            if (conflicts.size() > 0) return #err(error("undo_conflict", "Later edits block undo for series " # joinTexts(conflicts, ", "), mem.revision));
            var nextSeries = mem.series; var nextOccurrences = mem.occurrences; var nextProvenance = mem.import_provenance; var nextReminders = mem.reminders;
            for (change in receipt.changes.vals()) {
                switch (change) {
                    case (#created(value)) {
                        nextSeries := Array.filter<Memory.EventSeries>(nextSeries, func(item) { item.id != value.series_id });
                        nextOccurrences := Array.filter<Memory.Occurrence>(nextOccurrences, func(item) { item.series_id != value.series_id });
                        nextProvenance := Array.filter<Memory.ImportProvenance>(nextProvenance, func(item) { item.series_id != value.series_id });
                        nextReminders := Array.filter<Memory.Reminder>(nextReminders, func(item) { item.series_id != value.series_id });
                    };
                    case (#replaced(value)) {
                        let id = value.before.series.id;
                        switch (findSeriesIn(nextSeries, id)) { case (?(index, _)) nextSeries := replaceAt(nextSeries, index, value.before.series); case null nextSeries := Array.concat(nextSeries, [value.before.series]) };
                        nextOccurrences := Array.concat(Array.filter<Memory.Occurrence>(nextOccurrences, func(item) { item.series_id != id }), value.before.occurrences);
                        nextProvenance := Array.filter<Memory.ImportProvenance>(nextProvenance, func(item) { item.series_id != id });
                        switch (value.before.provenance) { case (?prior) nextProvenance := Array.concat(nextProvenance, [prior]); case null {} };
                        nextReminders := Array.concat(Array.filter<Memory.Reminder>(nextReminders, func(item) { item.series_id != id }), value.before.reminders);
                    };
                    case (#deleted(value)) {
                        nextSeries := Array.concat(nextSeries, [value.series]); nextOccurrences := Array.concat(nextOccurrences, value.occurrences);
                        switch (value.provenance) { case (?prior) nextProvenance := Array.concat(nextProvenance, [prior]); case null {} };
                        nextReminders := Array.concat(nextReminders, value.reminders);
                    };
                }
            };
            let revision = mem.revision + 1;
            mem.series := nextSeries; mem.occurrences := nextOccurrences; mem.import_provenance := nextProvenance; mem.reminders := nextReminders; mem.revision := revision;
            mem.bulk_receipts := replaceAt(mem.bulk_receipts, receiptIndex, { receipt with undone_at_revision = ?revision });
            #undone({ revision })
        };

        public func /*update*/calendar_series_create_v2(request : SeriesCreateRequest) : SeriesResult {
            if (request.expected_revision != mem.revision) return #err(error("stale", "Calendar changed", mem.revision));
            switch (validateSeriesWrite(request.value, 0)) { case (?problem) return #err(problem); case null {} };
            let now = nowNs(); let id = mem.next_series_id;
            let item : Memory.EventSeries = { id; revision = 1; title = request.value.title; notes = request.value.notes; location = request.value.location; color = request.value.color; availability = request.value.availability; kind = request.value.kind; source = #owner; time_zone = request.value.time_zone; recurrence = request.value.recurrence; created_at_ns = now; updated_at_ns = now };
            mem.next_series_id += 1; mem.series := Array.concat(mem.series, [item]);
            mem.occurrences := Array.concat(mem.occurrences, materialize(id, request.value.occurrences, [])); mem.revision += 1;
            #ok(seriesView(item))
        };
        public func /*update*/calendar_series_update_v2(request : SeriesUpdateRequest) : SeriesResult {
            let ?(index, current) = findSeries(request.series_id) else return #err(error("not_found", "Series not found", mem.revision));
            if (current.revision != request.expected_series_revision) return #err(error("stale", "Series changed", mem.revision));
            if (current.source != #owner) return #err(error("forbidden", "Rendezvous series cannot be edited here", mem.revision));
            let existing = Array.filter<Memory.Occurrence>(mem.occurrences, func(item) { item.series_id == current.id });
            switch (validateSeriesWrite(request.value, existing.size())) { case (?problem) return #err(problem); case null {} };
            let updated : Memory.EventSeries = { current with revision = current.revision + 1; title = request.value.title; notes = request.value.notes; location = request.value.location; color = request.value.color; availability = request.value.availability; kind = request.value.kind; time_zone = request.value.time_zone; recurrence = request.value.recurrence; updated_at_ns = nowNs() };
            mem.series := replaceAt(mem.series, index, updated);
            let other = Array.filter<Memory.Occurrence>(mem.occurrences, func(item) { item.series_id != current.id });
            let nextOccurrences = materialize(current.id, request.value.occurrences, existing);
            mem.occurrences := Array.concat(other, nextOccurrences);
            mem.reminders := Array.filter<Memory.Reminder>(mem.reminders, func(reminder) {
                reminder.series_id != current.id or reminder.occurrence_id == null or Array.any<Memory.Occurrence>(nextOccurrences, func(item) { reminder.occurrence_id == ?item.id })
            });
            mem.revision += 1;
            #ok(seriesView(updated))
        };
        public func /*update*/calendar_series_remove_v2(request : SeriesRemoveRequest) : MutationResult {
            let ?(index, current) = findSeries(request.series_id) else return #err(error("not_found", "Series not found", mem.revision));
            if (current.revision != request.expected_series_revision) return #err(error("stale", "Series changed", mem.revision));
            if (current.source != #owner) return #err(error("forbidden", "Rendezvous series cannot be deleted here", mem.revision));
            mem.series := removeAt(mem.series, index); mem.occurrences := Array.filter<Memory.Occurrence>(mem.occurrences, func(item) { item.series_id != current.id }); mem.import_provenance := Array.filter<Memory.ImportProvenance>(mem.import_provenance, func(item) { item.series_id != current.id }); mem.reminders := Array.filter<Memory.Reminder>(mem.reminders, func(item) { item.series_id != current.id }); mem.revision += 1; #ok({ revision = mem.revision })
        };
        public func /*update*/calendar_occurrence_update_v2(request : OccurrenceUpdateRequest) : OccurrenceResult {
            let ?(index, current) = findOccurrence(request.occurrence_id) else return #err(error("not_found", "Occurrence not found", mem.revision));
            if (current.revision != request.expected_occurrence_revision) return #err(error("stale", "Occurrence changed", mem.revision));
            let ?(_, owner) = findSeries(current.series_id) else return #err(error("corrupt", "Series missing", mem.revision));
            if (owner.source != #owner) return #err(error("forbidden", "Rendezvous occurrence cannot be edited here", mem.revision));
            if (not validOccurrence(request.start_ns, request.end_ns, current.recurrence_key) or not validOverrides(request.title_override, request.notes_override, request.location_override)) return #err(error("invalid", "Invalid occurrence fields", mem.revision));
            if (overlapsLiveHold(request.start_ns, request.end_ns, ?current.id)) return #err(error("conflict", "Occurrence overlaps a tentative meeting hold", mem.revision));
            let updated : Memory.Occurrence = {
                current with
                revision = current.revision + 1;
                start_ns = request.start_ns;
                end_ns = request.end_ns;
                status = #overridden;
                title_override = keepOverride(request.title_override, current.title_override);
                notes_override = keepOverride(request.notes_override, current.notes_override);
                location_override = keepOverride(request.location_override, current.location_override);
            };
            let ?(seriesIndex, series) = findSeries(current.series_id) else return #err(error("corrupt", "Series missing", mem.revision));
            mem.series := replaceAt(mem.series, seriesIndex, { series with revision = series.revision + 1; updated_at_ns = nowNs() });
            mem.occurrences := replaceAt(mem.occurrences, index, updated); mem.revision += 1; #ok(occurrenceView(updated))
        };
        public func /*update*/calendar_occurrence_remove_v2(request : OccurrenceRemoveRequest) : MutationResult {
            let ?(index, current) = findOccurrence(request.occurrence_id) else return #err(error("not_found", "Occurrence not found", mem.revision));
            if (current.revision != request.expected_occurrence_revision) return #err(error("stale", "Occurrence changed", mem.revision));
            let ?(_, owner) = findSeries(current.series_id) else return #err(error("corrupt", "Series missing", mem.revision));
            if (owner.source != #owner) return #err(error("forbidden", "Rendezvous occurrence cannot be deleted here", mem.revision));
            let ?(seriesIndex, series) = findSeries(current.series_id) else return #err(error("corrupt", "Series missing", mem.revision));
            mem.series := replaceAt(mem.series, seriesIndex, { series with revision = series.revision + 1; updated_at_ns = nowNs() });
            mem.occurrences := replaceAt(mem.occurrences, index, { current with revision = current.revision + 1; status = #cancelled });
            mem.reminders := Array.filter<Memory.Reminder>(mem.reminders, func(item) { item.occurrence_id != ?current.id });
            mem.revision += 1; #ok({ revision = mem.revision })
        };

        public func /*update*/calendar_create(request : CreateRequest) : EventResult {
            if (request.expected_revision != mem.revision) return #err(error("stale", "Calendar changed", mem.revision));
            if (not validOwnerFields(request.start_ns, request.end_ns, request.title, request.notes) or overlapsLiveHold(request.start_ns, request.end_ns, null)) return #err(error("invalid", "Invalid event fields or tentative hold conflict", mem.revision));
            if (mem.series.size() >= MAX_SERIES or mem.occurrences.size() >= MAX_OCCURRENCES) return #err(error("full", "Calendar capacity reached", mem.revision));
            let now = nowNs(); let seriesId = mem.next_series_id; let occurrenceId = mem.next_occurrence_id;
            let series : Memory.EventSeries = { id = seriesId; revision = 1; title = request.title; notes = request.notes; location = ""; color = "sage"; availability = #busy; kind = #timed; source = #owner; time_zone = mem.preferences.display_time_zone; recurrence = null; created_at_ns = now; updated_at_ns = now };
            let occurrence : Memory.Occurrence = { id = occurrenceId; revision = 1; series_id = seriesId; recurrence_key = "once:" # Nat64.toText(occurrenceId); start_ns = request.start_ns; end_ns = request.end_ns; status = #normal; title_override = null; notes_override = null; location_override = null };
            mem.next_series_id += 1; mem.next_occurrence_id += 1; mem.series := Array.concat(mem.series, [series]); mem.occurrences := Array.concat(mem.occurrences, [occurrence]); mem.revision += 1; #ok(legacyView(occurrence))
        };
        public func /*update*/calendar_update(request : UpdateRequest) : EventResult {
            let ?(occurrenceIndex, occurrence) = findOccurrence(request.id) else return #err(error("not_found", "Event not found", mem.revision));
            if (occurrence.revision != request.expected_event_revision) return #err(error("stale", "Event changed", mem.revision));
            let ?(seriesIndex, series) = findSeries(occurrence.series_id) else return #err(error("corrupt", "Series missing", mem.revision));
            if (series.source != #owner) return #err(error("forbidden", "Rendezvous event cannot be edited here", mem.revision));
            if (not validOwnerFields(request.start_ns, request.end_ns, request.title, request.notes) or overlapsLiveHold(request.start_ns, request.end_ns, ?occurrence.id)) return #err(error("invalid", "Invalid event fields or tentative hold conflict", mem.revision));
            let nextOccurrence : Memory.Occurrence = { occurrence with revision = occurrence.revision + 1; start_ns = request.start_ns; end_ns = request.end_ns; status = if (series.recurrence == null) #normal else #overridden };
            let nextSeries : Memory.EventSeries = { series with revision = series.revision + 1; title = request.title; notes = request.notes; updated_at_ns = nowNs() };
            mem.occurrences := replaceAt(mem.occurrences, occurrenceIndex, nextOccurrence); mem.series := replaceAt(mem.series, seriesIndex, nextSeries); mem.revision += 1; #ok(legacyView(nextOccurrence))
        };
        public func /*update*/calendar_remove(request : RemoveRequest) : MutationResult {
            let ?(index, current) = findOccurrence(request.id) else return #err(error("not_found", "Event not found", mem.revision));
            if (current.revision != request.expected_event_revision) return #err(error("stale", "Event changed", mem.revision));
            mem.occurrences := removeAt(mem.occurrences, index);
            mem.reminders := Array.filter<Memory.Reminder>(mem.reminders, func(item) { item.occurrence_id != ?current.id });
            if (not Array.any<Memory.Occurrence>(mem.occurrences, func(item) { item.series_id == current.series_id })) { mem.series := Array.filter<Memory.EventSeries>(mem.series, func(item) { item.id != current.series_id }); mem.import_provenance := Array.filter<Memory.ImportProvenance>(mem.import_provenance, func(item) { item.series_id != current.series_id }); mem.reminders := Array.filter<Memory.Reminder>(mem.reminders, func(item) { item.series_id != current.series_id }) };
            mem.revision += 1; #ok({ revision = mem.revision })
        };

        public func /*query*/calendar_preferences_get() : PreferencesView { preferencesView() };
        public func /*update*/calendar_preferences_set(request : PreferencesSetRequest) : PreferencesResult {
            if (request.expected_revision != mem.revision) return #err(error("stale", "Calendar changed", mem.revision));
            if (not Validation.validPreferences(request.day_start_minute, request.day_end_minute, request.allowed_weekdays_mask, request.slot_increment_minutes, request.buffer_before_minutes, request.buffer_after_minutes, request.display_time_zone)) return #err(error("invalid", "Invalid scheduling preferences", mem.revision));
            mem.preferences := { day_start_minute = request.day_start_minute; day_end_minute = request.day_end_minute; allowed_weekdays_mask = request.allowed_weekdays_mask; slot_increment_minutes = request.slot_increment_minutes; buffer_before_minutes = request.buffer_before_minutes; buffer_after_minutes = request.buffer_after_minutes; display_time_zone = request.display_time_zone }; mem.revision += 1; #ok(preferencesView())
        };
        public func /*query*/calendar_find_free_v1(request : AvailabilityRequestV1) : AvailabilityResultV1 {
            if (not Validation.validDuration(request.duration_minutes) or request.candidate_starts_ns.size() > Validation.MAX_CANDIDATES or not validRange(request.window_start_ns, request.window_end_ns)) return { revision = mem.revision; available_starts_ns = [] };
            { revision = mem.revision; available_starts_ns = Availability.filter(mem.occurrences, mem.series, mem.preferences, nowNs(), request.window_start_ns, request.window_end_ns, request.duration_minutes, request.candidate_starts_ns) }
        };

        public func /*internal:apps*/calendar_availability_v1(request : AvailabilityRequestV1) : AvailabilityResultV1 { { revision = mem.revision; available_starts_ns = Availability.filter(mem.occurrences, mem.series, mem.preferences, nowNs(), request.window_start_ns, request.window_end_ns, request.duration_minutes, request.candidate_starts_ns) } };
        public func /*internal:apps*/calendar_reserve_v1(request : ReserveRequestV1) : ReserveResultV1 {
            if (not validExternalId(request.external_id) or not Validation.validDuration(request.duration_minutes) or not Validation.textWithin(request.meeting_label, Validation.MAX_TITLE_BYTES)) return #invalid;
            switch (findExternal(request.external_id)) { case (?(_, _, occurrence)) { let expectedEnd = Nat64.fromNat(Nat64.toNat(request.start_ns) + Nat32.toNat(request.duration_minutes) * Validation.MINUTE_NS); if (occurrence.start_ns == request.start_ns and occurrence.end_ns == expectedEnd) return #reserved({ event_id = occurrence.id; event_revision = occurrence.revision; calendar_revision = mem.revision }); return #conflict({ calendar_revision = mem.revision }) }; case null {} };
            if (request.expected_revision != mem.revision) return #stale({ calendar_revision = mem.revision });
            if (mem.series.size() >= MAX_SERIES or mem.occurrences.size() >= MAX_OCCURRENCES) return #full;
            if (request.hold_expires_at_ns <= nowNs() or not Availability.slotAvailable(mem.occurrences, mem.series, mem.preferences, nowNs(), request.start_ns, request.duration_minutes)) return #conflict({ calendar_revision = mem.revision });
            let seriesId = mem.next_series_id; let occurrenceId = mem.next_occurrence_id; let now = nowNs();
            let series : Memory.EventSeries = { id = seriesId; revision = 1; title = request.meeting_label; notes = ""; location = ""; color = "violet"; availability = #busy; kind = #timed; source = #rendezvous(request.external_id); time_zone = mem.preferences.display_time_zone; recurrence = null; created_at_ns = now; updated_at_ns = now };
            let occurrence : Memory.Occurrence = { id = occurrenceId; revision = 1; series_id = seriesId; recurrence_key = "meeting:" # Nat64.toText(occurrenceId); start_ns = request.start_ns; end_ns = Nat64.fromNat(Nat64.toNat(request.start_ns) + Nat32.toNat(request.duration_minutes) * Validation.MINUTE_NS); status = #hold(request.hold_expires_at_ns); title_override = null; notes_override = null; location_override = null };
            mem.next_series_id += 1; mem.next_occurrence_id += 1; mem.series := Array.concat(mem.series, [series]); mem.occurrences := Array.concat(mem.occurrences, [occurrence]); mem.revision += 1; #reserved({ event_id = occurrence.id; event_revision = occurrence.revision; calendar_revision = mem.revision })
        };
        public func /*internal:apps*/calendar_confirm_v1(request : ExternalRequestV1) : ExternalResultV1 {
            if (not validExternalId(request.external_id)) return #invalid;
            let ?(_, occurrenceIndex, occurrence) = findExternal(request.external_id) else return #not_found({ calendar_revision = mem.revision });
            switch (occurrence.status) { case (#confirmed) return #ok({ calendar_revision = mem.revision }); case (#hold(expires)) if (expires <= nowNs()) return #not_found({ calendar_revision = mem.revision }); case (_) {} };
            mem.occurrences := replaceAt(mem.occurrences, occurrenceIndex, { occurrence with revision = occurrence.revision + 1; status = #confirmed }); mem.revision += 1; #ok({ calendar_revision = mem.revision })
        };
        public func /*internal:apps*/calendar_release_v1(request : ExternalRequestV1) : ExternalResultV1 {
            if (not validExternalId(request.external_id)) return #invalid;
            let ?(seriesIndex, _, seriesOccurrence) = findExternal(request.external_id) else return #not_found({ calendar_revision = mem.revision });
            mem.series := removeAt(mem.series, seriesIndex); mem.occurrences := Array.filter<Memory.Occurrence>(mem.occurrences, func(item) { item.series_id != seriesOccurrence.series_id }); mem.revision += 1; #ok({ calendar_revision = mem.revision })
        };

        func validateImportRequest(request : ImportCommitRequestV1) : ?Error {
            if (not validImportNamespace(request.source_namespace) or Blob.size(request.batch_id) < 16 or Blob.size(request.batch_id) > 32 or Blob.size(request.preview_digest) != 32) return ?error("invalid", "Invalid import identity or digest", mem.revision);
            if (request.series.size() == 0 or request.series.size() > MAX_IMPORT_SERIES) return ?error("invalid", "Import must contain 1 to 250 selected series", mem.revision);
            var occurrenceCount = 0;
            var seenUids : [Text] = [];
            var createdCount = 0;
            var replacedOccurrences = 0;
            for (input in request.series.vals()) {
                if (not validImportUid(input.external_uid) or Blob.size(input.content_digest) != 32 or Array.any<Text>(seenUids, func(value) { value == input.external_uid })) return ?error("invalid", "Import contains an invalid or duplicate UID", mem.revision);
                seenUids := Array.concat(seenUids, [input.external_uid]);
                occurrenceCount += input.occurrences.size();
                if (input.occurrences.size() == 0 or input.occurrences.size() > MAX_SERIES_OCCURRENCES or occurrenceCount > MAX_IMPORT_OCCURRENCES) return ?error("invalid", "Import occurrence limit exceeded", mem.revision);
                if (not Validation.validTimeZone(input.time_zone)) return ?error("invalid", "Import contains an invalid time zone", mem.revision);
                var previousStart : ?Nat64 = null; var previousKey = "";
                for (occurrence in input.occurrences.vals()) {
                    if (not validOccurrence(occurrence.start_ns, occurrence.end_ns, occurrence.recurrence_key) or occurrence.title.size() == 0 or not Validation.textWithin(occurrence.title, Validation.MAX_TITLE_BYTES) or not Validation.textWithin(occurrence.notes, Validation.MAX_NOTES_BYTES) or not Validation.textWithin(occurrence.location, 512)) return ?error("invalid", "Import contains invalid event fields", mem.revision);
                    switch (previousStart) { case (?start) if (occurrence.start_ns <= start or Text.compare(occurrence.recurrence_key, previousKey) == #equal) return ?error("invalid", "Imported occurrences must be ordered and unique", mem.revision); case (_) {} };
                    previousStart := ?occurrence.start_ns; previousKey := occurrence.recurrence_key;
                };
                switch (input.existing_series_id, input.expected_series_revision, findImportProvenance(request.source_namespace, input.external_uid)) {
                    case (null, null, null) createdCount += 1;
                    case (?id, ?expected, ?(_, provenance)) {
                        if (provenance.series_id != id) return ?error("stale", "Import match changed; refresh the preview", mem.revision);
                        let ?(_, current) = findSeries(id) else return ?error("stale", "Imported series was deleted", mem.revision);
                        if (current.revision != expected) return ?error("stale", "Imported series was edited; refresh the preview", mem.revision);
                        if (input.sequence <= provenance.sequence) return ?error("conflict", "Import is unchanged, ambiguous, or older than stored data", mem.revision);
                        replacedOccurrences += Array.filter<Memory.Occurrence>(mem.occurrences, func(item) { item.series_id == id }).size();
                    };
                    case (_) return ?error("conflict", "Import selection does not match current provenance", mem.revision);
                }
            };
            if (mem.series.size() + createdCount > MAX_SERIES or mem.occurrences.size() - replacedOccurrences + occurrenceCount > MAX_OCCURRENCES) return ?error("full", "Calendar capacity reached", mem.revision);
            null
        };

        func importOccurrences(seriesId : Nat64, inputs : [ImportOccurrenceInputV1], existing : [Memory.Occurrence], initialNextId : Nat64) : { values : [Memory.Occurrence]; next_id : Nat64 } {
            var nextId = initialNextId;
            let first = inputs[0];
            let values = Array.map<ImportOccurrenceInputV1, Memory.Occurrence>(inputs, func(input) {
                let prior = Array.find<Memory.Occurrence>(existing, func(item) { item.recurrence_key == input.recurrence_key });
                let id : Nat64 = switch (prior) { case (?value) value.id; case null { let value = nextId; nextId += 1; value } };
                let revision : Nat64 = switch (prior) { case (?value) value.revision + 1; case null (1 : Nat64) };
                {
                    id; revision; series_id = seriesId; recurrence_key = input.recurrence_key; start_ns = input.start_ns; end_ns = input.end_ns;
                    status = switch (input.status) { case (#normal) #normal; case (#cancelled) #cancelled };
                    title_override = if (input.title == first.title) null else ?input.title;
                    notes_override = if (input.notes == first.notes) null else ?input.notes;
                    location_override = if (input.location == first.location) null else ?input.location;
                }
            });
            { values; next_id = nextId }
        };

        func findImportProvenance(namespace : Text, uid : Text) : ?(Nat, Memory.ImportProvenance) { findImportProvenanceIn(mem.import_provenance, namespace, uid) };
        func findBulkReceipt(batchId : Blob) : ?(Nat, Memory.BulkReceipt) { var index = 0; while (index < mem.bulk_receipts.size()) { if (mem.bulk_receipts[index].batch_id == batchId) return ?(index, mem.bulk_receipts[index]); index += 1 }; null };
        func receiptView(receipt : Memory.BulkReceipt) : BulkReceiptViewV1 { { batch_id = receipt.batch_id; preview_digest = receipt.preview_digest; committed_revision = receipt.committed_revision; created_at_ns = receipt.created_at_ns; change_count = receipt.changes.size(); undone_at_revision = receipt.undone_at_revision } };
        func appendBoundedReceipt(receipts : [Memory.BulkReceipt], receipt : Memory.BulkReceipt) : [Memory.BulkReceipt] { let combined = Array.concat(receipts, [receipt]); if (combined.size() <= MAX_BULK_RECEIPTS) combined else Array.tabulate<Memory.BulkReceipt>(MAX_BULK_RECEIPTS, func(index) { combined[combined.size() - MAX_BULK_RECEIPTS + index] }) };
        func bulkChangesBytes(changes : [Memory.BulkUndoChange]) : Nat {
            var total = 0;
            func textBytes(value : Text) : Nat { Blob.size(Text.encodeUtf8(value)) };
            func snapshotBytes(value : Memory.SeriesSnapshot) : Nat {
                var size = 256 + textBytes(value.series.title) + textBytes(value.series.notes) + textBytes(value.series.location) + textBytes(value.series.color) + textBytes(value.series.time_zone);
                for (item in value.occurrences.vals()) { size += 160 + textBytes(item.recurrence_key); switch (item.title_override) { case (?text) size += textBytes(text); case null {} }; switch (item.notes_override) { case (?text) size += textBytes(text); case null {} }; switch (item.location_override) { case (?text) size += textBytes(text); case null {} } };
                switch (value.provenance) { case (?item) size += 64 + textBytes(item.source_namespace) + textBytes(item.external_uid) + Blob.size(item.content_digest); case null {} };
                size + value.reminders.size() * 64
            };
            for (change in changes.vals()) { switch (change) { case (#created(_)) total += 32; case (#replaced(value)) total += 32 + snapshotBytes(value.before); case (#deleted(value)) total += snapshotBytes(value) } };
            total
        };

        func validateSeriesWrite(value : SeriesWrite, replacing : Nat) : ?Error {
            if (mem.series.size() >= MAX_SERIES and replacing == 0) return ?error("full", "Series capacity reached", mem.revision);
            if (value.occurrences.size() == 0 or value.occurrences.size() > MAX_SERIES_OCCURRENCES or mem.occurrences.size() - replacing + value.occurrences.size() > MAX_OCCURRENCES) return ?error("full", "Occurrence capacity reached", mem.revision);
            if (value.title.size() == 0 or not Validation.textWithin(value.title, Validation.MAX_TITLE_BYTES) or not Validation.textWithin(value.notes, Validation.MAX_NOTES_BYTES) or not Validation.textWithin(value.location, 512) or not Validation.textWithin(value.color, 32) or not Validation.validTimeZone(value.time_zone)) return ?error("invalid", "Invalid series fields", mem.revision);
            switch (value.recurrence) { case (?rule) { if (not validRecurrence(rule, value.occurrences.size())) return ?error("invalid_recurrence", "Invalid recurrence rule", mem.revision) }; case (_) {} };
            var previousStart : ?Nat64 = null; var previousKey = "";
            for (item in value.occurrences.vals()) { if (not validOccurrence(item.start_ns, item.end_ns, item.recurrence_key)) return ?error("invalid_occurrence", "Invalid occurrence", mem.revision); switch (previousStart) { case (?start) { if (item.start_ns <= start or Text.compare(item.recurrence_key, previousKey) == #equal) return ?error("invalid_occurrence", "Occurrences must be ordered and unique", mem.revision) }; case (_) {} }; previousStart := ?item.start_ns; previousKey := item.recurrence_key };
            null
        };
        func validRecurrence(rule : RecurrenceRule, count : Nat) : Bool { rule.interval >= 1 and rule.interval <= 99 and (switch (rule.end) { case (#count(value)) value >= 1 and value <= 730 and Nat16.toNat(value) == count; case (#until(value)) value > 0 }) and (switch (rule.frequency) { case (#weekly) rule.weekdays_mask > 0; case (#monthly) switch (rule.month_day) { case (?day) day >= 1 and day <= 31; case null false }; case (_) true }) };
        func validOwnerFields(start : Nat64, finish : Nat64, title : Text, notes : Text) : Bool { Validation.validInterval(start, finish) and title.size() > 0 and Validation.textWithin(title, Validation.MAX_TITLE_BYTES) and Validation.textWithin(notes, Validation.MAX_NOTES_BYTES) };
        func validOccurrence(start : Nat64, finish : Nat64, key : Text) : Bool { Validation.validInterval(start, finish) and key.size() > 0 and Validation.textWithin(key, 64) };
        func validOverrides(title : ?Text, notes : ?Text, location : ?Text) : Bool { optionWithin(title, Validation.MAX_TITLE_BYTES) and optionWithin(notes, Validation.MAX_NOTES_BYTES) and optionWithin(location, 512) };
        func optionWithin(value : ?Text, limit : Nat) : Bool { switch (value) { case (?text) Validation.textWithin(text, limit); case null true } };
        func validRange(start : Nat64, finish : Nat64) : Bool { start < finish and Nat64.toNat(finish) - Nat64.toNat(start) <= 366 * Validation.DAY_NS };
        func validSearchRequest(request : SearchRuntimeRequest) : Bool {
            if (not Validation.textWithin(request.query_text, 256) or request.limit == 0 or request.limit > Validation.MAX_PAGE) return false;
            switch (request.start_ns, request.end_ns) { case (?start, ?finish) if (start >= finish) return false; case (_) {} };
            switch (request.source) { case (?value) if (value != "owner" and value != "rendezvous") return false; case (_) {} };
            switch (request.status) { case (?value) if (value != "normal" and value != "overridden" and value != "hold" and value != "confirmed") return false; case (_) {} };
            true
        };
        func decodeSearchWire(wire : Text) : ?SearchRuntimeRequest {
            if (wire.size() > 4_096) return null;
            let encoded = Iter.toArray(Text.split(wire, #char '|'));
            if (encoded.size() != 10) return null;
            func nibble(character : Char) : ?Nat8 {
                switch (character) {
                    case ('0') ?0; case ('1') ?1; case ('2') ?2; case ('3') ?3;
                    case ('4') ?4; case ('5') ?5; case ('6') ?6; case ('7') ?7;
                    case ('8') ?8; case ('9') ?9; case ('a') ?10; case ('b') ?11;
                    case ('c') ?12; case ('d') ?13; case ('e') ?14; case ('f') ?15;
                    case (_) null;
                }
            };
            func decode(value : Text) : ?Text {
                let characters = Text.toArray(value);
                if (characters.size() % 2 != 0) return null;
                var bytes : [Nat8] = [];
                var index = 0;
                while (index < characters.size()) {
                    let ?high = nibble(characters[index]) else return null;
                    let ?low = nibble(characters[index + 1]) else return null;
                    bytes := Array.concat<Nat8>(bytes, [high * 16 + low]);
                    index += 2;
                };
                Text.decodeUtf8(Blob.fromArray(bytes))
            };
            let ?queryText = decode(encoded[0]) else return null;
            let ?startText = decode(encoded[1]) else return null;
            let ?endText = decode(encoded[2]) else return null;
            let ?sourceTextValue = decode(encoded[3]) else return null;
            let ?availabilityText = decode(encoded[4]) else return null;
            let ?statusTextValue = decode(encoded[5]) else return null;
            let ?recurringText = decode(encoded[6]) else return null;
            let ?revisionText = decode(encoded[7]) else return null;
            let ?offsetText = decode(encoded[8]) else return null;
            let ?limitText = decode(encoded[9]) else return null;
            let ?offset = Nat.fromText(offsetText) else return null;
            let ?limit = Nat.fromText(limitText) else return null;
            let parseNat64 = func(value : Text) : ?Nat64 {
                if (value == "") return null;
                let ?number = Nat.fromText(value) else return null;
                if (number > 18_446_744_073_709_551_615) return null;
                ?Nat64.fromNat(number)
            };
            let start = if (startText == "") null else parseNat64(startText);
            let finish = if (endText == "") null else parseNat64(endText);
            let revision = if (revisionText == "") null else parseNat64(revisionText);
            if ((startText != "" and start == null) or (endText != "" and finish == null) or (revisionText != "" and revision == null)) return null;
            let availability : ?AvailabilityMode = if (availabilityText == "") null else if (availabilityText == "busy") ?#busy else if (availabilityText == "free") ?#free else return null;
            let recurring : ?Bool = if (recurringText == "") null else if (recurringText == "true") ?true else if (recurringText == "false") ?false else return null;
            ?{ query_text = queryText; start_ns = start; end_ns = finish; source = if (sourceTextValue == "") null else ?sourceTextValue; availability; status = if (statusTextValue == "") null else ?statusTextValue; recurring; expected_revision = revision; offset; limit }
        };
        func matchesSearch(item : Memory.Occurrence, needle : Text, request : SearchRuntimeRequest) : Bool {
            let ?(_, series) = findSeries(item.series_id) else return false;
            let now = nowNs();
            switch (item.status) { case (#cancelled) return false; case (#hold(expires)) if (expires <= now) return false; case (_) {} };
            switch (request.start_ns) { case (?start) if (item.end_ns <= start) return false; case (_) {} };
            switch (request.end_ns) { case (?finish) if (item.start_ns >= finish) return false; case (_) {} };
            switch (request.source) { case (?value) if (sourceText(series.source) != value) return false; case (_) {} };
            switch (request.availability) { case (?value) if (series.availability != value) return false; case (_) {} };
            switch (request.status) { case (?value) if (statusText(item.status) != value) return false; case (_) {} };
            switch (request.recurring) { case (?value) if ((series.recurrence != null) != value) return false; case (_) {} };
            if (needle == "") return true;
            let view = occurrenceView(item);
            Text.contains(Text.toLower(view.title), #text needle) or Text.contains(Text.toLower(view.notes), #text needle) or Text.contains(Text.toLower(view.location), #text needle)
        };
        func overlapsLiveHold(start : Nat64, finish : Nat64, ignoredId : ?Nat64) : Bool { let now = nowNs(); Array.any<Memory.Occurrence>(mem.occurrences, func(item) { let ignored = switch (ignoredId) { case (?id) item.id == id; case null false }; not ignored and (switch (item.status) { case (#hold(expires)) expires > now; case (_) false }) and start < item.end_ns and item.start_ns < finish }) };
        func activeOccurrences() : [Memory.Occurrence] { let now = nowNs(); Array.filter<Memory.Occurrence>(mem.occurrences, func(item) { switch (item.status) { case (#cancelled) false; case (#hold(expires)) expires > now; case (_) true } }) };
        func findSeries(id : Nat64) : ?(Nat, Memory.EventSeries) { var index = 0; while (index < mem.series.size()) { if (mem.series[index].id == id) return ?(index, mem.series[index]); index += 1 }; null };
        func findOccurrence(id : Nat64) : ?(Nat, Memory.Occurrence) { var index = 0; while (index < mem.occurrences.size()) { if (mem.occurrences[index].id == id) return ?(index, mem.occurrences[index]); index += 1 }; null };
        func reminderKeyMatches(item : Memory.Reminder, seriesId : Nat64, occurrenceId : ?Nat64) : Bool { item.series_id == seriesId and item.occurrence_id == occurrenceId };
        func findReminder(seriesId : Nat64, occurrenceId : ?Nat64) : ?Memory.Reminder { Array.find<Memory.Reminder>(mem.reminders, func(item) { reminderKeyMatches(item, seriesId, occurrenceId) }) };
        func effectiveReminder(occurrence : Memory.Occurrence) : ?Nat32 {
            switch (findReminder(occurrence.series_id, ?occurrence.id)) { case (?item) ?item.offset_minutes; case null switch (findReminder(occurrence.series_id, null)) { case (?item) ?item.offset_minutes; case null null } }
        };
        func reminderView(series : Memory.EventSeries, occurrenceId : ?Nat64, offset : ?Nat32, inherited : Bool) : ReminderViewV1 { { revision = series.revision; calendar_revision = mem.revision; series_id = series.id; occurrence_id = occurrenceId; offset_minutes = offset; inherited } };
        func findExternal(id : Blob) : ?(Nat, Nat, Memory.Occurrence) { var seriesIndex = 0; while (seriesIndex < mem.series.size()) { switch (mem.series[seriesIndex].source) { case (#rendezvous(value)) if (value == id) { var occurrenceIndex = 0; while (occurrenceIndex < mem.occurrences.size()) { if (mem.occurrences[occurrenceIndex].series_id == mem.series[seriesIndex].id) return ?(seriesIndex, occurrenceIndex, mem.occurrences[occurrenceIndex]); occurrenceIndex += 1 } }; case (_) {} }; seriesIndex += 1 }; null };
        func materialize(seriesId : Nat64, inputs : [OccurrenceInput], existing : [Memory.Occurrence]) : [Memory.Occurrence] {
            Array.map<OccurrenceInput, Memory.Occurrence>(inputs, func(input) {
                switch (Array.find<Memory.Occurrence>(existing, func(item) { item.recurrence_key == input.recurrence_key })) {
                    case (?previous) {
                        switch (previous.status) {
                            case (#normal) { { previous with revision = previous.revision + 1; start_ns = input.start_ns; end_ns = input.end_ns } };
                            case (#overridden) { { previous with revision = previous.revision + 1 } };
                            case (#cancelled) { { previous with revision = previous.revision + 1 } };
                            case (#hold(_)) { { previous with revision = previous.revision + 1 } };
                            case (#confirmed) { { previous with revision = previous.revision + 1 } };
                        }
                    };
                    case null {
                        let id = mem.next_occurrence_id; mem.next_occurrence_id += 1;
                        let created : Memory.Occurrence = { id; revision = 1; series_id = seriesId; recurrence_key = input.recurrence_key; start_ns = input.start_ns; end_ns = input.end_ns; status = #normal; title_override = null; notes_override = null; location_override = null };
                        created
                    };
                }
            })
        };
        func keepOverride(requested : ?Text, existing : ?Text) : ?Text {
            switch (requested) { case (?value) ?value; case null existing }
        };
        func seriesView(item : Memory.EventSeries) : SeriesView { { id = item.id; revision = item.revision; title = item.title; notes = item.notes; location = item.location; color = item.color; availability = item.availability; kind = item.kind; source = sourceText(item.source); imported = Array.any<Memory.ImportProvenance>(mem.import_provenance, func(value) { value.series_id == item.id }); time_zone = item.time_zone; recurrence = item.recurrence; created_at_ns = item.created_at_ns; updated_at_ns = item.updated_at_ns } };
        func occurrenceView(item : Memory.Occurrence) : OccurrenceView { let ?(_, series) = findSeries(item.series_id) else { return { id = item.id; revision = item.revision; series_id = item.series_id; series_revision = 0; recurrence_key = item.recurrence_key; start_ns = item.start_ns; end_ns = item.end_ns; title = "Missing series"; notes = ""; location = ""; color = "sage"; availability = #free; kind = #timed; source = "corrupt"; status = "corrupt"; time_zone = "UTC" } }; { id = item.id; revision = item.revision; series_id = series.id; series_revision = series.revision; recurrence_key = item.recurrence_key; start_ns = item.start_ns; end_ns = item.end_ns; title = switch (item.title_override) { case (?value) value; case null series.title }; notes = switch (item.notes_override) { case (?value) value; case null series.notes }; location = switch (item.location_override) { case (?value) value; case null series.location }; color = series.color; availability = series.availability; kind = series.kind; source = sourceText(series.source); status = statusText(item.status); time_zone = series.time_zone } };
        func legacyView(item : Memory.Occurrence) : EventView { let view = occurrenceView(item); { id = view.id; revision = view.revision; start_ns = view.start_ns; end_ns = view.end_ns; title = view.title; notes = view.notes; source = view.source; status = view.status; hold_expires_at_ns = switch (item.status) { case (#hold(expires)) ?expires; case (_) null } } };
        func sourceText(value : Memory.SeriesSource) : Text { switch (value) { case (#owner) "owner"; case (#rendezvous(_)) "rendezvous" } };
        func statusText(value : Memory.OccurrenceStatus) : Text { switch (value) { case (#normal) "normal"; case (#overridden) "overridden"; case (#cancelled) "cancelled"; case (#hold(_)) "hold"; case (#confirmed) "confirmed" } };
        func preferencesView() : PreferencesView { { revision = mem.revision; day_start_minute = mem.preferences.day_start_minute; day_end_minute = mem.preferences.day_end_minute; allowed_weekdays_mask = mem.preferences.allowed_weekdays_mask; slot_increment_minutes = mem.preferences.slot_increment_minutes; buffer_before_minutes = mem.preferences.buffer_before_minutes; buffer_after_minutes = mem.preferences.buffer_after_minutes; display_time_zone = mem.preferences.display_time_zone } };
    };

    func nowNs() : Nat64 { Nat64.fromNat(Int.abs(Time.now())) };
    func validExternalId(value : Blob) : Bool { Blob.size(value) >= 16 and Blob.size(value) <= 32 };
    func validImportNamespace(value : Text) : Bool { value.size() > 0 and Validation.textWithin(value, 320) };
    func validImportUid(value : Text) : Bool { value.size() > 0 and Validation.textWithin(value, 512) };
    func error(code : Text, message : Text, revision : Nat64) : Error { { code; message; revision } };
    func bounds(offset : Nat, requested : Nat, size : Nat, maximum : Nat) : (Nat, Nat) { let limit = if (requested > maximum) maximum else requested; let start = if (offset > size) size else offset; let finish = if (start + limit > size) size else start + limit; (start, finish) };
    func replaceAt<T>(values : [T], index : Nat, value : T) : [T] { Array.tabulate<T>(values.size(), func(i) { if (i == index) value else values[i] }) };
    func removeAt<T>(values : [T], index : Nat) : [T] { Array.tabulate<T>(values.size() - 1, func(i) { if (i < index) values[i] else values[i + 1] }) };
    func findSeriesIn(values : [Memory.EventSeries], id : Nat64) : ?(Nat, Memory.EventSeries) { var index = 0; while (index < values.size()) { if (values[index].id == id) return ?(index, values[index]); index += 1 }; null };
    func findImportProvenanceIn(values : [Memory.ImportProvenance], namespace : Text, uid : Text) : ?(Nat, Memory.ImportProvenance) { var index = 0; while (index < values.size()) { let item = values[index]; if (item.source_namespace == namespace and item.external_uid == uid) return ?(index, item); index += 1 }; null };
    func joinTexts(values : [Text], separator : Text) : Text { var result = ""; var index = 0; while (index < values.size()) { if (index > 0) result #= separator; result #= values[index]; index += 1 }; result };

/*---NEUTRON GENERATED BEGIN---*/

public type calendar_status_Input = ();
public type calendar_status_Output = Status;

public type calendar_list_Input = (request : ListRequest);
public type calendar_list_Output = EventPage;

public type calendar_range_v2_Input = (request : RangeRequest);
public type calendar_range_v2_Output = RangePage;

public type calendar_series_get_v2_Input = (request : { series_id : Nat64 });
public type calendar_series_get_v2_Output = ?SeriesView;

public type calendar_series_occurrences_v2_Input = (request : SeriesOccurrencesRequest);
public type calendar_series_occurrences_v2_Output = SeriesOccurrencesPage;

public type calendar_export_v1_Input = (request : ExportRequestV1);
public type calendar_export_v1_Output = ExportPageV1;

public type calendar_search_v1_Input = (wire : Text);
public type calendar_search_v1_Output = SearchResultV1;

public type calendar_import_index_v1_Input = (request : ImportIndexRequestV1);
public type calendar_import_index_v1_Output = ImportIndexV1;

public type calendar_reminder_get_v1_Input = (request : ReminderGetRequestV1);
public type calendar_reminder_get_v1_Output = ?ReminderViewV1;

public type calendar_reminder_schedule_v1_Input = (request : ReminderScheduleRequestV1);
public type calendar_reminder_schedule_v1_Output = ReminderScheduleV1;

public type calendar_reminder_set_v1_Input = (request : ReminderSetRequestV1);
public type calendar_reminder_set_v1_Output = ReminderResultV1;

public type calendar_import_commit_v1_Input = (request : ImportCommitRequestV1);
public type calendar_import_commit_v1_Output = ImportCommitResultV1;

public type calendar_bulk_status_v1_Input = (request : BulkStatusRequestV1);
public type calendar_bulk_status_v1_Output = BulkStatusResultV1;

public type calendar_bulk_undo_v1_Input = (request : BulkUndoRequestV1);
public type calendar_bulk_undo_v1_Output = BulkUndoResultV1;

public type calendar_series_create_v2_Input = (request : SeriesCreateRequest);
public type calendar_series_create_v2_Output = SeriesResult;

public type calendar_series_update_v2_Input = (request : SeriesUpdateRequest);
public type calendar_series_update_v2_Output = SeriesResult;

public type calendar_series_remove_v2_Input = (request : SeriesRemoveRequest);
public type calendar_series_remove_v2_Output = MutationResult;

public type calendar_occurrence_update_v2_Input = (request : OccurrenceUpdateRequest);
public type calendar_occurrence_update_v2_Output = OccurrenceResult;

public type calendar_occurrence_remove_v2_Input = (request : OccurrenceRemoveRequest);
public type calendar_occurrence_remove_v2_Output = MutationResult;

public type calendar_create_Input = (request : CreateRequest);
public type calendar_create_Output = EventResult;

public type calendar_update_Input = (request : UpdateRequest);
public type calendar_update_Output = EventResult;

public type calendar_remove_Input = (request : RemoveRequest);
public type calendar_remove_Output = MutationResult;

public type calendar_preferences_get_Input = ();
public type calendar_preferences_get_Output = PreferencesView;

public type calendar_preferences_set_Input = (request : PreferencesSetRequest);
public type calendar_preferences_set_Output = PreferencesResult;

public type calendar_find_free_v1_Input = (request : AvailabilityRequestV1);
public type calendar_find_free_v1_Output = AvailabilityResultV1;

public type calendar_availability_v1_Input = (request : AvailabilityRequestV1);
public type calendar_availability_v1_Output = AvailabilityResultV1;

public type calendar_reserve_v1_Input = (request : ReserveRequestV1);
public type calendar_reserve_v1_Output = ReserveResultV1;

public type calendar_confirm_v1_Input = (request : ExternalRequestV1);
public type calendar_confirm_v1_Output = ExternalResultV1;

public type calendar_release_v1_Input = (request : ExternalRequestV1);
public type calendar_release_v1_Output = ExternalResultV1;

/*---NEUTRON GENERATED END---*/
}
