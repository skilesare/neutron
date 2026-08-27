# Rendezvous 0.3.1 — Neutron hackathon candidate

Rendezvous privately negotiates meeting times between independently owned
Neutron canisters. Calendar availability is filtered locally; selected options,
bounded protocol state, and WebRTC signaling are the only peer payloads.

## Install order

1. Upstream Kernel 0.3.17
2. Contacts 0.3.1
3. Calendar 0.2.0
4. Rendezvous 0.3.1

## What changed since 0.3.0

Rendezvous now uses upstream Kernel 0.3.17's API-1 `browser_permissions`
capability. Camera and microphone are delegated only to the exact isolated
Rendezvous `main` tile; the old custom Kernel media-session API and separate
nonce-origin iframe are gone. Devices remain off until the participant clicks
**Start camera & microphone** in the visible meeting panel.

Rendezvous retains memory schema v2 and its complete v1-to-v2 lineage, so this
code/frontend release does not manufacture a schema migration or reset app
state.

The direct WebRTC path has no STUN or TURN service. It works when host ICE
candidates are mutually reachable and is not claimed as a general NAT-traversal
solution.

See `DEMO.md`, `SUBMISSION.md`, and `apps/rendezvous/README.md` in the tagged
source for reproduction steps and limitations.
