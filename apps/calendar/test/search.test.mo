import Array "mo:core/Array";
import Int "mo:core/Int";
import Nat64 "mo:core/Nat64";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Calendar "../backend/main";
import Memory "../backend/memory/calendar/v2";
import SearchWire "SearchWire";
import TestEnvironment "TestEnvironment";

let memory = Memory.init();
let now = Nat64.fromNat(Int.abs(Time.now()));
let minute : Nat64 = 60_000_000_000;
memory.series := [{
    id = 1; revision = 1; title = "Capacity fixture"; notes = "";
    location = ""; color = "sage"; availability = #busy; kind = #timed;
    source = #owner; time_zone = "UTC"; recurrence = ?{
        frequency = #daily; interval = 1; weekdays_mask = 0;
        month_day = null; end = #count(730);
    };
    created_at_ns = now; updated_at_ns = now;
}];
memory.occurrences := Array.tabulate<Memory.Occurrence>(2_003, func(index) {
    let start = now + Nat64.fromNat((index + 1) * 60_000_000_000);
    let status : Memory.OccurrenceStatus = if (index == 2_001) #cancelled else if (index == 2_002) #hold(now - 1) else #normal;
    {
        id = Nat64.fromNat(index + 1); revision = 1; series_id = 1;
        recurrence_key = "key-" # Nat64.toText(Nat64.fromNat(index));
        start_ns = start; end_ns = start + minute; status;
        title_override = if (index == 2_000) ?"Needle 旅行" else null;
        notes_override = null; location_override = null;
    }
});
memory.next_series_id := 2;
memory.next_occurrence_id := 2_004;
let calendar = Calendar.Init(TestEnvironment.make(memory));

// Golden browser encoding: ten pipe-separated hex UTF-8 fields.
let #ok(_) = calendar.calendar_search_v1("466f6375732074696d65||||||||30|3530") else Runtime.trap("browser search wire rejected");

let #ok(first) = calendar.calendar_search_v1(SearchWire.encode({ query_text = "needle"; start_ns = null; end_ns = null; source = null; availability = null; status = null; recurring = null; expected_revision = null; offset = 0; limit = 10 })) else Runtime.trap("first bounded scan failed");
assert (first.scanned == 2_000 and first.occurrences.size() == 0 and first.next_offset == ?2_000);
let #ok(second) = calendar.calendar_search_v1(SearchWire.encode({ query_text = "旅行"; start_ns = null; end_ns = null; source = ?"owner"; availability = ?#busy; status = ?"normal"; recurring = ?true; expected_revision = ?first.revision; offset = 2_000; limit = 10 })) else Runtime.trap("search continuation failed");
assert (second.occurrences.size() == 1 and second.occurrences[0].title == "Needle 旅行");
assert (second.next_offset == null);

let #invalid(_) = calendar.calendar_search_v1(SearchWire.encode({ query_text = ""; start_ns = null; end_ns = null; source = null; availability = null; status = null; recurring = null; expected_revision = null; offset = 0; limit = 101 })) else Runtime.trap("unbounded limit accepted");
let oversizedQuery = Text.join(Array.tabulate<Text>(257, func(_) { "x" }).vals(), "");
let #invalid(_) = calendar.calendar_search_v1(SearchWire.encode({ query_text = oversizedQuery; start_ns = null; end_ns = null; source = null; availability = null; status = null; recurring = null; expected_revision = null; offset = 0; limit = 10 })) else Runtime.trap("oversized query accepted");
