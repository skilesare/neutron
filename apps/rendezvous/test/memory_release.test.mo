import Blob "mo:core/Blob";
import Int "mo:core/Int";
import Nat64 "mo:core/Nat64";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import NeutronCapabilities "mo:neutron-capabilities";
import Rendezvous "../backend/main";
import Memory "../backend/memory/rendezvous/v2";

let memory = Memory.init();
let self = Principal.fromBlob(Blob.fromArray([0, 1, 1]));
let peer = Principal.fromBlob(Blob.fromArray([0, 1, 2]));
func environment(memory : Memory.Mem) : Rendezvous.AppBackendEnvironment = {
    stable_memory = { rendezvous = memory };
    app_calls = { calendar = {
        calendar_availability_v1 = func(request) { { revision = 0; available_starts_ns = request.candidate_starts_ns } };
        calendar_reserve_v1 = func(_) { #reserved({ event_id = 1; event_revision = 1; calendar_revision = 1 }) };
        calendar_confirm_v1 = func(_) { #ok({ calendar_revision = 1 }) };
        calendar_release_v1 = func(_) { #ok({ calendar_revision = 1 }) };
    }; contacts = {
        contacts_neutron_lookup_v2 = func(_ : { principal : Principal }) : Rendezvous.ContactLookup { { book_revision = 0; integrity_ok = true; match = null } };
        contacts_neutron_search_v2 = func(_ : Rendezvous.ContactSearchRequest) : Rendezvous.ContactSearchDependencyResult { #ok({ book_revision = 0; contacts = []; total = 0; next_offset = null }) };
        contacts_neutron_revision_v2 = func(()) : Nat { 0 };
    } };
    capabilities = { backend_calls = {
        canister_principal = self;
        can_call = func(_canister : Principal, _method : Text) { true };
        call = func(_request : NeutronCapabilities.BackendCallRequestV1) : async* NeutronCapabilities.BackendCallResultV1 { #err({ code = "unused"; message = "unused" }) };
        call_batch = func(_requests : [NeutronCapabilities.BackendCallRequestV1]) : async* [NeutronCapabilities.BackendCallResultV1] { [] };
    } };
};
let rendezvous = Rendezvous.Init(environment(memory));
let status = rendezvous.rendezvous_status();
assert (status.revision == 0);
assert (status.negotiation_count == 0);

// A code/frontend-only release reconstructs the app service over the exact
// same managed-memory root. Representative installed data must survive that
// reconstruction without a schema bump or a synthetic migration.
let now = Nat64.fromNat(Int.abs(Time.now()));
let id = Blob.fromArray([1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]);
let capability = Blob.fromArray([2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2]);
switch (rendezvous.rendezvous_create_offer({
    id;
    capability;
    peer;
    title = "Preserved release meeting";
    duration_minutes = 45;
    candidate_starts_ns = [now + 3_600_000_000_000];
    expires_at_ns = now + 86_400_000_000_000;
})) {
    case (#ok(_)) {};
    case (#err(_)) assert false;
};
assert (memory.revision == 1);
assert (memory.negotiations.size() == 1);

let restored = Rendezvous.Init(environment(memory));
let restoredStatus = restored.rendezvous_status();
assert (restoredStatus.revision == 1);
assert (restoredStatus.negotiation_count == 1);
let restoredPage = restored.rendezvous_list({ offset = 0; limit = 50 });
assert (restoredPage.total == 1);
assert (restoredPage.negotiations.size() == 1);
assert (restoredPage.negotiations[0].id == id);
assert (restoredPage.negotiations[0].title == "Preserved release meeting");
assert (restoredPage.negotiations[0].duration_minutes == 45);
assert (restoredPage.negotiations[0].candidate_starts_ns == [now + 3_600_000_000_000]);
