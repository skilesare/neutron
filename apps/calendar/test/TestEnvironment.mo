import CalendarMemory "../backend/memory/calendar/v2";

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
