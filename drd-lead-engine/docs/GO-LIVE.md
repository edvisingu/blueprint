# Going live

This system was built as a demonstration on generated data. This document is
the path from that to contacting real people, and the order matters: each step
unblocks the next, and the readiness gate refuses to arm sending until the
blocking ones are done.

**Nothing in this document is legal advice.** The consent model implements our
reading of CASL and is pending qualified Canadian legal review. A green
readiness gate means the *system* is configured correctly. It is not an opinion
that sending is lawful.

---

## The three invariants

These are enforced in code and covered by `npm run stress` (87 checks). They
are the reason this is safe to work on before the legal and procurement
questions are settled.

1. **Generated data can never be sent to.** Every company and contact carries
   an `origin`. Rows written by the demo seed are `origin='demo'`, and
   `sending.send()` refuses them before it checks anything else — even with a
   full consent record, an armed organisation and an active mailbox attached.
2. **No live consent basis, no send.** Consent lives in its own append-only
   table with a basis, evidence and an expiry clock, scoped to
   (contact × brand). A contact with no valid unexpired basis for the brand
   being sent cannot be messaged.
3. **Nothing leaves while disarmed.** `send_armed` defaults to 0, is separate
   from autopilot, and `readiness.arm()` refuses to set it while any blocking
   check fails.

Every refusal is written to the `sends` table with a machine-readable
`skip_reason`. There are no silent skips — that was the single densest
complaint cluster across every competing product we researched.

---

## Step 1 — empty the database of fiction

A live deployment starts empty. That is correct, not broken.

```sh
node server/purge-demo.js --dry-run    # see what would go
node server/purge-demo.js              # remove it
```

The server used to seed generated companies on first boot "so the deployment is
never an empty shell". That is now opt-in (`DRD_DEMO=1`), because filling a
production database with fiction makes every number on the dashboard
meaningless.

To run a demo instance deliberately: `npm run seed` (sets `DRD_DEMO=1`).

---

## Step 2 — set sender identification

CASL requires every commercial message to identify the sender, give a mailing
address, and provide contact details valid for at least 60 days. The send path
**refuses to send** without these, and raises a critical alert rather than
failing quietly.

```sql
UPDATE organizations SET
  legal_name      = 'Your Legal Entity Name',
  mailing_address = 'Street, City, Province, Postal Code, Country',
  contact_email   = 'someone@yourdomain.ca',
  contact_phone   = '+1 ...'
WHERE id = 'org_root';
```

Set `DRD_PUBLIC_URL` to the https base that serves `/u/<token>`, or the
unsubscribe link in every message points nowhere.

---

## Step 3 — import real contacts with their provenance

```sh
curl -H "Authorization: Bearer $KEY" localhost:8787/v1/import/template
```

Required columns: `email`, `name`, `company`, `consent_basis`,
`consent_captured_at`, `consent_source`.

Consent provenance is required **at import** because it cannot be
reconstructed afterwards. Once a list is in the database with no recorded
basis, there is no honest way to invent one, and the burden of proof under
CASL sits with the sender.

### The five bases, and what each demands

| Basis | Clock | Required evidence |
|---|---|---|
| `express` | none | how and when consent was given |
| `implied_transaction` | 24 months | the purchase, contract or accepted opportunity |
| `implied_inquiry` | 6 months | the inquiry or application |
| `implied_publication` | none, but conditions must still hold | source URL, captured evidence, role relevance, **and** an affirmative anti-solicitation check |
| `b2b_exemption` | none | an organisation-to-organisation relationship, not merely two employees |

Expiry is computed from the basis and never read from the file.

Two things the importer will reject outright, by design:

- **A purchased or scraped list.** There is no basis value for it. The CRTC
  has held that a third party scraping or selling addresses creates no implied
  consent; CompuFinder was penalised $200,000 advancing essentially that
  argument. Buying a list transfers data, not permission.
- **Conspicuous publication without the full evidence set.** Research on the
  enforcement decisions found the CRTC set a higher standard than mere public
  availability — an address being posted on a government website was held not
  to establish the basis by itself. So the importer requires the URL, the
  captured evidence, the relevance rationale and the anti-solicitation check,
  or it rejects the row.

Every rejected row comes back with its line number and reason. Nothing partial
is written: a contact with no consent is worse than no contact.

### Brand scoping

Consent is scoped to (contact × brand). The relevance test is applied per
message, so an athletic director's published address may support a sports
websites pitch and not an unrelated credentials product. A `consent_basis`
recorded for one brand does not transfer to another; a basis with no brand
applies to all.

**Unsubscribe is deliberately asymmetric**: consent is narrow, withdrawal is
broad. One unsubscribe suppresses the address across all five brands at once.
Research found Smartlead's own documentation says its global block list cannot
do this — blocking one lead across four clients needs four separate entries.

> **Open question for counsel, flagged as the highest-value one:** no CRTC
> text was found on whether an unsubscribe from one brand of a common operator
> legally binds the others. We default to suppressing everywhere because it is
> the safer reading, not because it is settled.

---

## Step 4 — verification (bring your own key)

No verification vendor ships in this repository, and no vendor data is stored
in it. Register an adapter at runtime:

```js
require("./server/importer.js").registerVerifier(async (email) => {
  // call your provider with a key from the environment
  return { result: "valid" | "invalid" | "unknown" };
});
```

Unregistered means verification is **reported as skipped**, never silently
assumed to have passed. Research found pre-send verification was the largest
single measurable quality lever available: one vendor benchmark moved a list
from 13.3% bounce to 1.8% by verifying before sending.

**Licence warning.** Several contact-data vendors licence their APIs for
internal use only and forbid redistributing, sublicensing or embedding the data
in a product. Apollo's terms were confirmed to read "solely for your internal
business purposes" with sublicensing barred. Terms for Hunter, Dropcontact,
People Data Labs and Cognism could **not** be retrieved and must not be
assumed equivalent — have counsel read them before any vendor is wired in.

---

## Step 5 — configure a mailbox

```sh
curl -X POST localhost:8787/v1/mailboxes -H "Authorization: Bearer $KEY" \
  -d '{"address":"outreach@yourdomain.ca","provider":"dryrun","status":"Active",
       "daily_cap":20,"min_gap_seconds":180,"timezone":"America/Toronto"}'
```

Credentials never go in the database or the repository. `credential_env` names
an environment variable; the transport reads it.

`provider: "dryrun"` is the default and delivers nothing. It stays that way
until a sending provider is chosen, and **that choice is unresolved** — see the
open questions below.

Three cap behaviours, each a deliberate correction of a documented failure in a
competing product:

- A mailbox's daily cap is counted in **one** place, from the `sends` table. A
  second campaign does not get a fresh allowance.
- The cap resets on the **mailbox's own** timezone, and an invalid timezone is
  a blocking readiness failure rather than a silent fallback to UTC.
- A send inside the minimum gap is **skipped and recorded**, never dropped.

---

## Step 6 — record the clearance

```sh
curl -X POST localhost:8787/v1/clearance -H "Authorization: Bearer $KEY" \
  -d '{"subject":"Outbound activation","granted_by":"...","note":"..."}'
```

This records a decision made outside the system: what was cleared, by whom,
when. The system cannot grant itself clearance. Per the operator's standing
instruction, activation of any earned-income stream requires clearance from
both counsel and the CPA; building and preparing is not gated, activating is.

---

## Step 7 — run the gate, then arm

```sh
curl -H "Authorization: Bearer $KEY" localhost:8787/v1/readiness
curl -X POST localhost:8787/v1/readiness/arm -H "Authorization: Bearer $KEY" -d '{"armed":true}'
```

Blocking checks — arming is refused while any fails:

| Check | What it wants |
|---|---|
| `no_demo_data` | no generated contacts present |
| `has_real_contacts` | at least one imported contact |
| `consent_coverage` | every real contact has a live basis |
| `sender_identification` | legal name, mailing address, contact details |
| `has_active_mailbox` | one or more active mailboxes |
| `mailbox_timezone` | every timezone valid |
| `no_critical_alerts` | nothing critical outstanding |
| `unsubscribe_url` | `DRD_PUBLIC_URL` set to an https base |
| `email_authentication` | SPF and DMARC present on every sending domain |
| `clearance_recorded` | a clearance record exists |

Advisory checks report but do not block: `transport_configured`,
`consent_expiring`, `mailboxes_paused`, `dmarc_policy_*`.

Note that `email_authentication` blocks when it is **unverified**, not only
when it fails. DNS is unreachable from some sandboxes, and an unverifiable
authentication posture is treated as not-ready rather than assumed fine.

---

## Safety rails once armed

- **Bounce and complaint rates use the right denominator** — messages actually
  sent in a rolling 7-day window, not rows in a list. Smartlead's documented
  formula divides by total lead count, which on a 10,000-row list reports 50
  bounces out of 50 sent as 0.5% and is therefore useless as an early brake.
- **A sample floor** of 20 sends before any rate can gate anything, so one
  bounce out of two does not pause a healthy mailbox.
- **Warn, then pause**: 2% bounce / 0.1% complaint warns, 4% / 0.3% pauses the
  mailbox and raises a *critical* alert. A pause you discover by noticing low
  volume is a defect.
- **Hard bounces and complaints suppress the address immediately**, not on a
  nightly sweep.
- **Every send records the consent record it relied on.** CompuFinder's actual
  failure was log granularity, not consent quality: without knowing who
  received which message when, it could not produce evidence of consent for a
  given recipient.

---

## What is still unresolved

These are not implementation gaps. They are decisions and procurements that
have to happen outside this codebase, and the first one gates everything.

1. **No sending provider is chosen, and the acceptable-use question is
   unanswered.** Research could not retrieve a single provider's policy text —
   the egress gateway in the build environment denies general web hosts — so
   there are **zero confirmed AUP quotes**. What surfaced via a search index,
   and needs verifying by reading the actual pages: mainstream ESP policies
   generally restrict cold outbound, and one provider's policy reportedly
   requires "active, explicit, and specific opt-in", which would exclude CASL
   implied consent entirely. **Being CASL-compliant does not make you
   AUP-compliant.** Read the policy before signing up, not after.
2. **Microsoft 365 limits changed recently.** A 2,000 external recipients per
   rolling 24 hours sub-limit was reported as applying to existing tenants from
   1 October 2026. Check your own admin centre; the notice has slipped before.
3. **Do not buy a dedicated IP** at tens-to-hundreds of messages a day. There
   is not enough volume to sustain its reputation, so it delivers worse than a
   shared pool.
4. **Use sending subdomains, not lookalike domains.** Alignment works fine on a
   lookalike; what it costs is trust. An institution receiving mail from a
   near-miss domain cannot verify you, and institutional credibility is the
   actual asset here.
5. **Google/Yahoo bulk thresholds and the 0.3% spam-rate ceiling.** Low volume
   does not protect you — it makes each individual complaint far more
   expensive in rate terms. Optimise for relevance, not volume.
6. **One-click unsubscribe depends on the provider, not on us.** RFC 8058
   requires DKIM to cover both `List-Unsubscribe` and `List-Unsubscribe-Post`.
   We emit both headers; if the eventual provider does not sign them, the
   compliance is void regardless of our code.

---

## Running the checks

```sh
npm run verify      # all three suites
npm test            #  105 API and engine tests
npm run stress      #   87 safety-invariant checks
npm run e2e         #   27 end-to-end HTTP checks
npm run readiness   # print the gate for the default org
```
