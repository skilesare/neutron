# Try Calendar + Rendezvous

The `rendezvous-hackathon` branch is the combined review branch. It includes:

- Calendar 0.2.0;
- Contacts 0.3.1;
- Rendezvous 0.3.0;
- the experimental Kernel 0.3.13 media capability;
- a two-node Alice/Bob PocketIC configuration; and
- the browser test used to verify the submitted workflow.

No additional combined branch is required.

## Review the release

The [Rendezvous 0.3.0 release](https://github.com/skilesare/neutron/releases/tag/rendezvous-v0.3.0)
contains all four `.neutron` archives and the 60-second demo. For an isolated
manual review Neutron, install them in this order:

1. `kernel.v0.3.13.neutron`
2. `contacts.v0.3.1.neutron`
3. `calendar.v0.2.0.neutron`
4. `rendezvous.v0.3.0.neutron`

Kernel 0.3.13 is a deliberate experimental Kernel replacement for the
owner-approved ephemeral media surface. Use an isolated review Neutron. The
Rendezvous 0.3.0 package does not install on the upstream 0.3.12 Kernel.

## Run the two-Neutron demo locally

Requirements are the same as the Neutron repository, including Node, Bun,
Playwright Chromium, and the local PocketIC toolchain.

```sh
git clone https://github.com/skilesare/neutron.git
cd neutron
git checkout rendezvous-hackathon
npm install
npm run provision -- rendezvous-local.ndeploy.json serve
```

Keep that process running. In another terminal:

```sh
npm run provision -- rendezvous-local.ndeploy.json reinstall
npm run provision -- rendezvous-local.ndeploy.json status
```

The status command prints separate Alice and Bob URLs. The local configuration
installs Contacts, Calendar, and Rendezvous into both Neutrons.

For the most reproducible review, let Playwright create the local Internet
Identity sessions, authorize them, exercise the complete protocol, and verify
the direct browser media path:

```sh
npm run test:e2e:rendezvous:fresh
```

To regenerate the exact submission screenshots:

```sh
npm run submission:rendezvous:screenshots
```

See [DEMO.md](DEMO.md) for a guided manual walkthrough and
[SUBMISSION.md](SUBMISSION.md) for pinned artifact hashes, limitations, and the
release verification commands.
