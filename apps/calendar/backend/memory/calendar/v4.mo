// Persistent schema: keep immutable after Calendar 0.5.0 is released.
module {
    public type SeriesSource = { #owner; #rendezvous : Blob };
    public type Availability = { #busy; #free };
    public type EventKind = { #timed; #all_day };
    public type Frequency = { #daily; #weekly; #monthly; #yearly };
    public type RecurrenceEnd = { #count : Nat16; #until : Nat64 };
    public type RecurrenceRule = { frequency : Frequency; interval : Nat8; weekdays_mask : Nat8; month_day : ?Nat8; end : RecurrenceEnd };
    public type EventSeries = { id : Nat64; revision : Nat64; title : Text; notes : Text; location : Text; color : Text; availability : Availability; kind : EventKind; source : SeriesSource; time_zone : Text; recurrence : ?RecurrenceRule; created_at_ns : Nat64; updated_at_ns : Nat64 };
    public type OccurrenceStatus = { #normal; #overridden; #cancelled; #hold : Nat64; #confirmed };
    public type Occurrence = { id : Nat64; revision : Nat64; series_id : Nat64; recurrence_key : Text; start_ns : Nat64; end_ns : Nat64; status : OccurrenceStatus; title_override : ?Text; notes_override : ?Text; location_override : ?Text };
    public type Preferences = { day_start_minute : Nat16; day_end_minute : Nat16; allowed_weekdays_mask : Nat8; slot_increment_minutes : Nat16; buffer_before_minutes : Nat16; buffer_after_minutes : Nat16; display_time_zone : Text };
    public type ImportProvenance = { series_id : Nat64; source_namespace : Text; external_uid : Text; sequence : Nat64; content_digest : Blob };
    public type Reminder = { series_id : Nat64; occurrence_id : ?Nat64; offset_minutes : Nat32 };
    public type SeriesSnapshot = { series : EventSeries; occurrences : [Occurrence]; provenance : ?ImportProvenance; reminders : [Reminder] };
    public type BulkUndoChange = {
        #created : { series_id : Nat64; expected_series_revision : Nat64 };
        #replaced : { before : SeriesSnapshot; expected_series_revision : Nat64 };
        #deleted : SeriesSnapshot;
    };
    public type BulkReceipt = { batch_id : Blob; preview_digest : Blob; committed_revision : Nat64; created_at_ns : Nat64; changes : [BulkUndoChange]; undone_at_revision : ?Nat64 };
    public type Mem = {
        var revision : Nat64;
        var next_series_id : Nat64;
        var next_occurrence_id : Nat64;
        var series : [EventSeries];
        var occurrences : [Occurrence];
        var preferences : Preferences;
        var import_provenance : [ImportProvenance];
        var reminders : [Reminder];
        var bulk_receipts : [BulkReceipt];
    };
    public func init() : Mem {
        { var revision = 0; var next_series_id = 1; var next_occurrence_id = 1; var series = []; var occurrences = [];
          var preferences = { day_start_minute = 540; day_end_minute = 1_020; allowed_weekdays_mask = 62; slot_increment_minutes = 15; buffer_before_minutes = 0; buffer_after_minutes = 0; display_time_zone = "UTC" };
          var import_provenance = []; var reminders = []; var bulk_receipts = [] }
    };
}
