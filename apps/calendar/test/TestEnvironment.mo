import CalendarMemory "../backend/memory/calendar/v3";

module {
    public func make(calendar : CalendarMemory.Mem) : {
        stable_memory : {
            calendar : CalendarMemory.Mem;
        };
    } {
        {
            stable_memory = {
                calendar;
            };
        };
    };
}
