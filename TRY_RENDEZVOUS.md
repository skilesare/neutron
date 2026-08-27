# Try Calendar + Rendezvous

The `rendezvous-hackathon` branch is the combined review branch. It includes
Contacts 0.3.1, Calendar 0.2.0, Rendezvous 0.3.1, upstream Kernel 0.3.17, a
two-node Alice/Bob PocketIC configuration, and the browser test for the complete
workflow. No custom Kernel fork is required.

## Review the release

The [Rendezvous 0.3.1 release](https://github.com/skilesare/neutron/releases/tag/rendezvous-v0.3.1)
contains the four `.neutron` archives and the 60-second demo. Install on an
isolated review Neutron in this order:

1. `kernel.v0.3.17.neutron`
2. `contacts.v0.3.1.neutron`
3. `calendar.v0.2.0.neutron`
4. `rendezvous.v0.3.1.neutron`

Kernel 0.3.17 is the owner's upstream release. Rendezvous uses its declared
tile-scoped `browser_permissions` capability; only the isolated Rendezvous
`main` tile receives camera and microphone authority.

## Run the two-Neutron demo locally

```sh
git clone https://github.com/skilesare/neutron.git
cd neutron
git checkout rendezvous-hackathon
npm install
npm run provision -- rendezvous-local.ndeploy.json serve
```

Keep that process running. In another terminal, initialize a fresh local test
fleet and print the separate Alice and Bob URLs:

```sh
npm run provision -- rendezvous-local.ndeploy.json reinstall
npm run provision -- rendezvous-local.ndeploy.json status
```

`reinstall` is only for disposable local-test initialization. Production app
updates use Neutron's checked, state-preserving install transaction.

For the reproducible installed-browser workflow:

```sh
npm run test:e2e:rendezvous:fresh
```

To regenerate submission screenshots:

```sh
npm run submission:rendezvous:screenshots
```

See [DEMO.md](DEMO.md) for a guided walkthrough and
[SUBMISSION.md](SUBMISSION.md) for pinned artifact hashes and release checks.
