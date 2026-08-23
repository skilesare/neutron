# Forum draft: Calendar + Rendezvous

## Suggested title

Rendezvous: private scheduling between sovereign Neutrons (Week 2)

## Post

I helped write the Neutron litepaper, and one idea in it kept nagging at me:
apps inside a personal cloud should be able to compose without handing the
user's data to a new platform every time they do.

So for Week 1 I built **Calendar**, and for Week 2 I built **Rendezvous** on top
of it.

### Calendar is a real calendar, not a scheduling mock-up

Calendar has day, week, month, and agenda views; timed and all-day events;
busy/free status; editing, deletion, drag-to-move, and resize; and daily,
weekly, monthly, and yearly recurrence. Events and recurrence rules live in
the owner's Neutron.

Calendar can stand on its own. The interesting Neutron part begins when another
app asks it a narrow question such as “which of these candidate times are
available?” Calendar can answer that without sharing event titles, notes,
locations, or the rest of the owner's schedule.

- [Watch the 60-second Calendar demo on GitHub](https://github.com/skilesare/neutron/releases/download/calendar-v0.2.0/calendar-demo.mp4)
- [Calendar release and installable package](https://github.com/skilesare/neutron/releases/tag/calendar-v0.2.0)

### Rendezvous composes two independently owned Calendars

Alice and Bob each have their own Neutron, Calendar, Contacts, and Rendezvous
installation. There is no Rendezvous service canister, shared account system,
or shared calendar database.

1. Alice chooses Bob from her local Contacts and explicitly selects the exact
   times she wants to offer. The app does not randomly choose a meeting.
2. Only those bounded candidate times cross a paid, caller-bound
   Neutron-to-Neutron route.
3. Bob sees Alice's locally trusted Contacts name and exact Neutron principal.
   His Calendar privately checks every offered time, and Bob can accept one or
   counter with an exact alternative.
4. Holds, revisions, and idempotent commands protect both sides from stale
   availability, double-booking, and uncertain delivery.
5. After agreement, the same meeting appears in both independently owned
   Calendars. Neither person's unrelated calendar data was copied to the other.

That is the part I wanted to demonstrate: two apps on two user-owned personal
clouds can produce one useful agreement without inventing a central SaaS
middleman.

There is also an experimental direct-call path. A confirmed participant must
approve a Kernel-owned, revocable, one-time media surface. The Neutrons carry
bounded WebRTC signaling, while audio and video flow browser-to-browser. This
preview intentionally has no STUN/TURN relay yet, so it is a direct-connect
experiment rather than a claim of production-grade Internet conferencing.

- [Watch the 60-second Rendezvous demo on GitHub](https://github.com/skilesare/neutron/releases/download/rendezvous-v0.3.0/rendezvous-demo.mp4)
- [Alice sends a proposal](https://github.com/skilesare/neutron/blob/rendezvous-hackathon/submission-assets/01-alice-proposal.jpg)
- [Bob sees Alice by name and chooses a time](https://github.com/skilesare/neutron/blob/rendezvous-hackathon/submission-assets/02-bob-received.jpg)
- [Alice's confirmed Calendar](https://github.com/skilesare/neutron/blob/rendezvous-hackathon/submission-assets/03-alice-confirmed-calendar.jpg)
- [Bob's independently owned confirmed Calendar](https://github.com/skilesare/neutron/blob/rendezvous-hackathon/submission-assets/04-bob-confirmed-calendar.jpg)
- [Calendar meeting detail and Rendezvous handoff](https://github.com/skilesare/neutron/blob/rendezvous-hackathon/submission-assets/05-alice-meeting-details.jpg)
- [Direct browser media after Kernel consent](https://github.com/skilesare/neutron/blob/rendezvous-hackathon/submission-assets/07-direct-video.jpg)

### Try it or inspect it

The combined branch contains Calendar, Contacts, Rendezvous, the experimental
Kernel media capability, a two-Neutron local configuration, and the end-to-end
test that drives Alice and Bob through the complete workflow.

- [Combined Calendar + Rendezvous source and try-it guide](https://github.com/skilesare/neutron/blob/rendezvous-hackathon/TRY_RENDEZVOUS.md)
- [Rendezvous release with all required packages](https://github.com/skilesare/neutron/releases/tag/rendezvous-v0.3.0)
- [Threat model and implementation details](https://github.com/skilesare/neutron/blob/rendezvous-hackathon/apps/rendezvous/README.md)

### Please vote in Week 2

Rendezvous is my Week 2 Neutron Hackathon submission. If private scheduling
between sovereign personal clouds feels like a useful demonstration of what
Neutron can do, please [open the Season 1 voting page](https://4576f-3aaaa-aaaam-ajgpq-cai.icp0.io/#/season), choose **Week 2**, and vote for **Rendezvous** after it clears moderator review.

I would especially value feedback on the cross-Neutron protocol, the privacy
boundary, and whether the Kernel-brokered direct-call experiment is worth
taking toward STUN/TURN support and a production-ready capability.
