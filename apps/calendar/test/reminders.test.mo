import Runtime "mo:core/Runtime";
import Calendar "../backend/main";
import Memory "../backend/memory/calendar/v4";
import TestEnvironment "TestEnvironment";

let minute : Nat64 = 60_000_000_000;
let start : Nat64 = 2_000_000_000_000_000_000;
let memory = Memory.init();
let calendar = Calendar.Init(TestEnvironment.make(memory));
let write : Calendar.SeriesWrite = {
  title = "Reminder test"; notes = ""; location = ""; color = "sage";
  availability = #busy; kind = #timed; time_zone = "UTC"; recurrence = null;
  occurrences = [{ recurrence_key = "once"; start_ns = start; end_ns = start + 30 * minute }];
};

let #ok(series) = calendar.calendar_series_create_v2({ expected_revision = 0; value = write }) else Runtime.trap("create failed");
let occurrence = calendar.calendar_range_v2({ start_ns = start; end_ns = start + 30 * minute; offset = 0; limit = 10 }).occurrences[0];
let #ok(seriesReminder) = calendar.calendar_reminder_set_v1({ series_id = series.id; occurrence_id = null; expected_series_revision = series.revision; offset_minutes = ?15 }) else Runtime.trap("series reminder failed");
assert (seriesReminder.offset_minutes == ?15 and seriesReminder.calendar_revision == 2);
let ?inherited = calendar.calendar_reminder_get_v1({ series_id = series.id; occurrence_id = ?occurrence.id }) else Runtime.trap("reminder missing");
assert (inherited.offset_minutes == ?15 and inherited.inherited);
let schedule = calendar.calendar_reminder_schedule_v1({ due_start_ns = start - 16 * minute; due_end_ns = start - 14 * minute; limit = 10 });
assert (schedule.total == 1 and schedule.reminders[0].due_at_ns == start - 15 * minute);

let #ok(override) = calendar.calendar_reminder_set_v1({ series_id = series.id; occurrence_id = ?occurrence.id; expected_series_revision = seriesReminder.revision; offset_minutes = ?5 }) else Runtime.trap("override failed");
assert (override.offset_minutes == ?5 and not override.inherited);
let overrideSchedule = calendar.calendar_reminder_schedule_v1({ due_start_ns = start - 6 * minute; due_end_ns = start - 4 * minute; limit = 10 });
assert (overrideSchedule.total == 1 and overrideSchedule.reminders[0].offset_minutes == 5);

let #err(stale) = calendar.calendar_reminder_set_v1({ series_id = series.id; occurrence_id = null; expected_series_revision = series.revision; offset_minutes = ?60 }) else Runtime.trap("stale reminder accepted");
assert (stale.code == "stale");
let #err(invalid) = calendar.calendar_reminder_set_v1({ series_id = series.id; occurrence_id = null; expected_series_revision = override.revision; offset_minutes = ?10_081 }) else Runtime.trap("invalid reminder accepted");
assert (invalid.code == "invalid");

let #ok(cleared) = calendar.calendar_reminder_set_v1({ series_id = series.id; occurrence_id = ?occurrence.id; expected_series_revision = override.revision; offset_minutes = null }) else Runtime.trap("override clear failed");
assert (cleared.offset_minutes == null);
let ?afterClear = calendar.calendar_reminder_get_v1({ series_id = series.id; occurrence_id = ?occurrence.id }) else Runtime.trap("inherited reminder missing");
assert (afterClear.offset_minutes == ?15 and afterClear.inherited);

let #ok(_) = calendar.calendar_occurrence_remove_v2({ occurrence_id = occurrence.id; expected_occurrence_revision = occurrence.revision }) else Runtime.trap("cancel failed");
let cancelledSchedule = calendar.calendar_reminder_schedule_v1({ due_start_ns = start - 16 * minute; due_end_ns = start; limit = 10 });
assert (cancelledSchedule.total == 0);
