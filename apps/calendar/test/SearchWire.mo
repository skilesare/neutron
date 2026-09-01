import Nat "mo:core/Nat";
import Nat64 "mo:core/Nat64";
import Nat8 "mo:core/Nat8";
import Text "mo:core/Text";

module {
    public type Availability = { #busy; #free };
    public type Request = {
        query_text : Text; start_ns : ?Nat64; end_ns : ?Nat64;
        source : ?Text; availability : ?Availability; status : ?Text;
        recurring : ?Bool; expected_revision : ?Nat64; offset : Nat; limit : Nat;
    };

    public func encode(request : Request) : Text {
        let digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
        func field(value : Text) : Text {
            var encoded = "";
            for (byte in Text.encodeUtf8(value).vals()) {
                let number = Nat8.toNat(byte);
                encoded #= digits[number / 16] # digits[number % 16];
            };
            encoded
        };
        func optionalText(value : ?Text) : Text { switch (value) { case (?text) text; case null "" } };
        func optionalNat64(value : ?Nat64) : Text { switch (value) { case (?number) Nat64.toText(number); case null "" } };
        let availability = switch (request.availability) { case (?#busy) "busy"; case (?#free) "free"; case null "" };
        let recurring = switch (request.recurring) { case (?true) "true"; case (?false) "false"; case null "" };
        field(request.query_text) # "|" # field(optionalNat64(request.start_ns)) # "|" # field(optionalNat64(request.end_ns)) # "|" #
        field(optionalText(request.source)) # "|" # field(availability) # "|" # field(optionalText(request.status)) # "|" # field(recurring) # "|" #
        field(optionalNat64(request.expected_revision)) # "|" # field(Nat.toText(request.offset)) # "|" # field(Nat.toText(request.limit))
    };
}
