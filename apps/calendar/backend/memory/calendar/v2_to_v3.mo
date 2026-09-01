import V2 "./v2";
import V3 "./v3";

module {
    public func migrate(old : V2.Mem) : V3.Mem {
        {
            var revision = old.revision;
            var next_series_id = old.next_series_id;
            var next_occurrence_id = old.next_occurrence_id;
            var series = old.series;
            var occurrences = old.occurrences;
            var preferences = old.preferences;
            var import_provenance = [];
            var reminders = [];
            var bulk_receipts = [];
        }
    };
}
