import Array "mo:core/Array";
import V3 "./v3";
import V4 "./v4";

module {
    public func migrate(old : V3.Mem) : V4.Mem {
        func currentRevision(seriesId : Nat64, fallback : Nat64) : Nat64 {
            switch (Array.find<V3.EventSeries>(old.series, func(item) { item.id == seriesId })) { case (?item) item.revision; case null fallback }
        };
        let receipts = Array.map<V3.BulkReceipt, V4.BulkReceipt>(old.bulk_receipts, func(receipt) {
            let changes = Array.map<V3.BulkUndoChange, V4.BulkUndoChange>(receipt.changes, func(change) {
                switch (change) {
                    case (#created(value)) #created({ series_id = value.series_id; expected_series_revision = currentRevision(value.series_id, 0) });
                    case (#replaced(value)) #replaced({ before = value; expected_series_revision = currentRevision(value.series.id, value.series.revision + 1) });
                    case (#deleted(value)) #deleted(value);
                }
            });
            { receipt with changes }
        });
        { var revision = old.revision; var next_series_id = old.next_series_id; var next_occurrence_id = old.next_occurrence_id;
          var series = old.series; var occurrences = old.occurrences; var preferences = old.preferences;
          var import_provenance = old.import_provenance; var reminders = old.reminders; var bulk_receipts = receipts }
    };
}
