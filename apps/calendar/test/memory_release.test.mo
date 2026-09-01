import Calendar "../backend/main";
import Memory "../backend/memory/calendar/v2";
import TestEnvironment "TestEnvironment";

let memory = Memory.init();
let calendar = Calendar.Init(TestEnvironment.make(memory));
let status = calendar.calendar_status();
assert (status.revision == 0);
assert (status.event_count == 0);
