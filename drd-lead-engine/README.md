# Dr. D Lead Engineering System

An outbound engine for the Dr. D brand portfolio. It defines the ICP, finds
companies and decision-makers, researches them, drafts personalised outreach,
classifies replies, surfaces hot leads and books meetings.

Built to the architecture in *Explee: Full Business Breakdown* with original
branding, UI, copy and implementation, as that document specifies. Not a clone
of Explee's source, assets or marks.

**Nothing in this repository is legal advice.** The consent model implements
our reading of CASL and is pending qualified Canadian legal review. See
`docs/COMPLIANCE.md` for what is settled and what is not.

---

## State of play

| | |
|---|---|
| Engine, scoring, research, reply classification | **working** |
| Consent provenance, import, suppression | **working** |
| Sequence executor, job runner, reply ingestion | **working** |
| Readiness gate, alerts, calendar booking | **working** |
| Sending | **built, disarmed, draft-first** |
| Contact data | **none yet.** The graph ships empty; the seed is generated sample data and is opt-in |
| Campaign copy | **written** for DRD Sports clubs and school athletics |

### What is blocked on you, not on code

1. A dedicated Workspace user for outbound. **Not** the primary mailbox: it
   holds ~36,000 messages across tax, legal and personal matters, and one spam
   complaint against it damages the account everything else depends on. A
   separate user, not an alias, since an alias shares the primary's reputation.
2. SPF, DKIM and DMARC on the sending domain.
3. OAuth credentials for the Gmail API (`docs/CAMPAIGN-SETUP.md` has the steps).
4. A real list, with consent provenance. The capture sheet is in Drive; 20 to
   40 contacts is the right size for a first batch.
5. Counsel's read on the consent basis for that list.

---

## Run it

Requires Node 22.5+ for the built-in `node:sqlite`. No dependencies.

```bash
npm start            # API + web client on http://localhost:8787
npm run verify       # all ten test suites
npm run readiness    # print the go-live gate for the default org
npm run purge-demo   # remove generated sample contacts
npm run seed         # build a DEMO database (sets DRD_DEMO=1)
```

A production database starts **empty**. That is correct, not broken. The
server used to seed generated companies on first boot so a deployment was
never an empty shell; that is now opt-in, because filling a live database with
fiction makes every figure on every screen meaningless.

### Tests

```
npm test               105   API and engine, against a live server and database
npm run stress          93   safety invariants under adversarial input
npm run e2e             30   operator journey over real HTTP
npm run test:gmail      40   RFC 822, RFC 2047, RFC 8058 message construction
npm run test:runner     55   job queue: crash recovery, races, idempotency
npm run test:replies    56   reply ingestion, opt-out detection, auto-replies
npm run test:sequences  67   the five sequence rules
npm run test:calendar   26   slot arithmetic, buffers, timezones
npm run test:unsub      17   the public unsubscribe route, incl. an XSS probe
npm run test:ui         14   the operator flow driven through a real browser
                       ---
                       503
```

The browser and HTTP layers are not redundant. Between them they caught a
repaint function that did not exist, an import report destroyed by its own
success, an unsubscribe link that 404'd in every outgoing message, and a
stored XSS. None of those were visible below the HTTP layer.

---

## The three invariants

Enforced in code, covered by `npm run stress`. They are why this is safe to
work on before the procurement and legal questions are settled.

1. **Generated data can never be sent to.** Every company and contact carries
   an `origin`. Demo rows are refused by the send path before anything else is
   checked, even with full consent, an armed org and an active mailbox.
2. **No live consent basis, no send.** Consent is an append-only table with
   evidence and an expiry clock, scoped to (contact × brand) because CASL's
   relevance test applies per message.
3. **Nothing leaves while disarmed.** `send_armed` defaults to 0, is separate
   from autopilot, and arming is refused while any blocking check fails.

Every refusal writes a row with a machine-readable reason. There are no silent
skips, which was the densest complaint cluster across every competing product
in the research.

---

## Layout

```
app.js  engine.js  data.js  workspace.js  styles.css   the browser client
build.js                                               bundles the single-file artifact
campaigns/drdsports.json                               sequence copy, two audiences
server/
  server.js        HTTP, routing, session auth, static
  db.js            schema (28 tables), migrations
  consent.js       the five bases, expiry clocks, eligibility
  importer.js      CSV import, provenance enforcement, dedupe
  sending.js       the single send gate: caps, rates, footer, unsubscribe
  sequences.js     the step executor
  runner.js        durable job queue
  replies.js       reply ingestion and classification
  calendar.js      Google Calendar free/busy and booking
  readiness.js     the go-live gate
  transports/gmail.js   draft-first Gmail transport
  purge-demo.js    removes generated sample rows
docs/
  GO-LIVE.md       the ordered path to sending
  CAMPAIGN-SETUP.md  Workspace, DNS, OAuth, the first campaign
  COMPLIANCE.md    what is settled, what is not, what counsel must decide
reports/           the competitive gap analysis
research_notes/    the raw research behind it
```

One engine, two runtimes: `server/shared.js` evaluates the browser's
`data.js` and `engine.js` inside Node, so scoring and classification cannot
drift between client and server.

---

## Design decisions worth knowing before changing anything

- **One gate.** Consent, suppression, caps, identification and the footer live
  in `sending.send()`. The sequence executor calls it rather than
  reimplementing any part, so there is exactly one place that decides whether
  a message may go.
- **Correct denominators.** Bounce and complaint rates divide by messages
  actually sent in a rolling window, with a 20-send floor before any rate can
  gate anything. A competing product's documented formula divides by total
  lead count, which reports 50 bounces out of 50 sent as 0.5% against a
  10,000-row list.
- **Single budget authority.** A mailbox's daily cap is counted in one place,
  resets on the mailbox's own timezone, and an invalid timezone is a blocking
  readiness failure rather than a silent fallback to UTC.
- **A draft is not a delivery.** Drafted messages are recorded as `DRAFTED`,
  do not consume the cap and are excluded from rate denominators.
- **Suppression is org-wide.** One opt-out covers all five brands. Consent is
  narrow, withdrawal is broad.
- **An unresolved merge field is a hard stop.** A message rendering
  "Hi {{first_name}}," tells the recipient they are row 400 in a spreadsheet.
- **GET never changes anything.** The unsubscribe link confirms on GET and
  acts on POST, because mail scanners fetch links with no human involved.

Features deliberately **not** built, with reasons in
`reports/Smartlead feature gap analysis.md`: a warmup pool (a two-sided
network, where a small one is plausibly worse than none), our own contact
database, a seed-list placement panel, a verification engine, whitelabel and
client portals, native LinkedIn or SMS steps, a deals pipeline with weighted
forecasting, and person-level website visitor identification.
