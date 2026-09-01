import Char "mo:core/Char";
import Nat8 "mo:core/Nat8";
import Nat16 "mo:core/Nat16";
import Nat32 "mo:core/Nat32";
import Nat64 "mo:core/Nat64";
import Text "mo:core/Text";

module {
    public let MINUTE_NS : Nat = 60_000_000_000;
    public let DAY_NS : Nat = 86_400_000_000_000;
    public let MAX_EVENTS : Nat = 2_000;
    public let MAX_PAGE : Nat = 100;
    public let MAX_CANDIDATES : Nat = 32;
    public let MAX_HORIZON_NS : Nat = 2_678_400_000_000_000;
    public let MAX_TITLE_BYTES : Nat = 160;
    public let MAX_NOTES_BYTES : Nat = 4_096;
    public let MAX_ZONE_BYTES : Nat = 64;
    public let MIN_DURATION_MINUTES : Nat = 15;
    public let MAX_DURATION_MINUTES : Nat = 480;

    public func textWithin(value : Text, maxBytes : Nat) : Bool {
        Text.encodeUtf8(value).size() <= maxBytes;
    };

    public func validDuration(value : Nat32) : Bool {
        let minutes = Nat32.toNat(value);
        minutes >= MIN_DURATION_MINUTES and minutes <= MAX_DURATION_MINUTES;
    };

    public func validInterval(start : Nat64, end : Nat64) : Bool {
        start < end and Nat64.toNat(end) - Nat64.toNat(start) <= MAX_HORIZON_NS;
    };

    // Canisters do not carry the IANA database, so the browser verifies that
    // the identifier exists and this boundary rejects malformed identifiers.
    public func validTimeZone(zone : Text) : Bool {
        let bytes = Text.encodeUtf8(zone).size();
        if (bytes == 0 or bytes > MAX_ZONE_BYTES) return false;
        if (zone == "UTC") return true;
        var sawSlash = false;
        var priorSlash = false;
        var index = 0;
        for (character in zone.chars()) {
            let code = Char.toNat32(character);
            let slash = code == 47;
            let accepted =
                (code >= 65 and code <= 90) or
                (code >= 97 and code <= 122) or
                (code >= 48 and code <= 57) or
                code == 95 or code == 45 or code == 43 or slash;
            if (not accepted or (slash and (index == 0 or priorSlash))) return false;
            if (slash) sawSlash := true;
            priorSlash := slash;
            index += 1;
        };
        sawSlash and not priorSlash;
    };

    public func validPreferences(
        dayStart : Nat16,
        dayEnd : Nat16,
        weekdays : Nat8,
        increment : Nat16,
        before : Nat16,
        after : Nat16,
        zone : Text,
    ) : Bool {
        let start = Nat16.toNat(dayStart);
        let end = Nat16.toNat(dayEnd);
        let step = Nat16.toNat(increment);
        start < end and end <= 1_440 and weekdays > 0 and step >= 5 and step <= 120 and
        Nat16.toNat(before) <= 240 and Nat16.toNat(after) <= 240 and
        validTimeZone(zone);
    };
}
