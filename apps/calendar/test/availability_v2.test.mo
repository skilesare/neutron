import Availability "../backend/AvailabilityV2";
import Memory "../backend/memory/calendar/v3";
import Nat64 "mo:core/Nat64";

func at(value : Nat) : Nat64 { Nat64.fromNat(value) * 60_000_000_000 };
let series : Memory.EventSeries = { id = 1; revision = 1; title = "Busy"; notes = ""; location = ""; color = "sage"; availability = #busy; kind = #timed; source = #owner; time_zone = "UTC"; recurrence = null; created_at_ns = 0; updated_at_ns = 0 };
let event : Memory.Occurrence = { id = 1; revision = 1; series_id = 1; recurrence_key = "once"; start_ns = at(600); end_ns = at(660); status = #normal; title_override = null; notes_override = null; location_override = null };
let base = Memory.init().preferences;

let before : Memory.Preferences = { base with buffer_before_minutes = 30; buffer_after_minutes = 0 };
assert (Availability.filter([event], [series], before, at(1), at(540), at(720), 15, [at(555), at(570), at(585), at(660)]) == [at(555), at(660)]);

let after : Memory.Preferences = { base with buffer_before_minutes = 0; buffer_after_minutes = 30 };
assert (Availability.filter([event], [series], after, at(1), at(540), at(720), 15, [at(570), at(660), at(675), at(690)]) == [at(570), at(690)]);
