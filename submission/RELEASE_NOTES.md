# Rendezvous 0.3.0 — Neutron hackathon candidate

Rendezvous privately negotiates meeting times between two independently owned
Neutron canisters. Calendar availability is filtered locally; selected options,
bounded protocol state, and WebRTC signaling are the only peer payloads.

## Install order

1. Kernel 0.3.13 (custom media-capability preview)
2. Contacts 0.3.1
3. Calendar 0.2.0
4. Rendezvous 0.3.0

## Compatibility notice

Rendezvous 0.3.0 declares the experimental `media_sessions` capability. It
requires the Kernel 0.3.13 archive attached to this release and does not install
on the upstream 0.3.12 Kernel. The Kernel archive is a deliberate manual Kernel
replacement, not an ordinary app package. Use an isolated Neutron for review.

The current direct WebRTC path has no STUN or TURN service. It works when host
ICE candidates are mutually reachable; it is not claimed as a general NAT
traversal solution.

See `DEMO.md`, `SUBMISSION.md`, and `doc/media-session-capability.md` in the
tagged source for reproduction steps and the threat model.
