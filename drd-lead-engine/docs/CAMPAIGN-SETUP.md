# Setting up your first campaign

The infrastructure question is settled: **send from your own Google Workspace
tenant**, not a cold-email vendor. Workspace is already connected, the caps
exceed the likely volume by roughly 20x, the marginal cost is about zero, there
is no third-party acceptable-use exposure, and — the part that matters for
institutional outreach — a registrar's office receiving the mail can actually
verify who sent it. A lookalike domain from a rented mailbox farm cannot be
verified by the institution it is trying to reach, and institutional
credibility is the asset here.

**Not legal advice.** Qualified Canadian legal review of the consent basis for
any list is required before sending. See `docs/COMPLIANCE.md`.

---

## Step 0 — do NOT send from the primary mailbox

The Gmail account currently connected holds about 36,000 inbox messages and
8,800 sent, with labels covering tax, legal and personal matters. It is the
mailbox the business runs on.

Outbound campaigns must not go through it. One spam complaint against that
address damages the account everything else depends on, and sender reputation
is slow to rebuild and impossible to transfer.

Create a dedicated Workspace user instead:

```
outreach@edvisingu.ca          (or per brand: outreach@drdsports.com)
```

A separate **user**, not an alias — an alias shares the primary's reputation,
which defeats the purpose. Per-brand users also keep reputations independent,
so a problem on one brand does not take the others down.

---

## Step 1 — authenticate the sending domain

For each domain that will appear in a From address:

| Record | What |
|---|---|
| SPF | `v=spf1 include:_spf.google.com ~all` |
| DKIM | Generate in Admin console → Apps → Google Workspace → Gmail → Authenticate email, then publish the TXT record and click Start authentication |
| DMARC | `_dmarc` TXT: `v=DMARC1; p=none; rua=mailto:dmarc@edvisingu.ca` to start |

Then move DMARC to `p=quarantine` and later `p=reject` once the aggregate
reports show legitimate mail passing. `p=none` asserts nothing — it only
collects reports.

**Alignment is the part tools skip.** SPF or DKIM passing for some *other*
domain does not protect the domain in the From header. With Workspace, DKIM
signing with `d=` on your own domain is the load-bearing step. The readiness
gate checks SPF and DMARC presence; it cannot confirm alignment from DNS
alone, and treats unverified as not-ready rather than assuming fine.

DNS for these domains is at Porkbun, with one on Cloudflare.

---

## Step 2 — authorise the API

The server needs OAuth credentials to draft or send as the outreach user.

1. Google Cloud Console → new project → enable the **Gmail API**.
2. OAuth consent screen → Internal (it is your own Workspace).
3. Credentials → OAuth client ID → Desktop app. Note the client ID and secret.
4. Authorise once as `outreach@edvisingu.ca` with scope
   `https://www.googleapis.com/auth/gmail.compose` for drafts, adding
   `gmail.send` only when you move to direct sending. Keep the refresh token.

Set these in the environment — never in the database or the repository:

```sh
export GOOGLE_CLIENT_ID=...
export GOOGLE_CLIENT_SECRET=...
export GMAIL_REFRESH_OUTREACH=...
export DRD_PUBLIC_URL=https://leads.edvisingu.ca
```

Then register the mailbox pointing at that variable:

```sh
curl -X POST $BASE/v1/mailboxes -H "Authorization: Bearer $KEY" -d '{
  "address": "outreach@edvisingu.ca",
  "display_name": "Dr. D — EdVisingU",
  "provider": "gmail-draft",
  "credential_env": "GMAIL_REFRESH_OUTREACH",
  "daily_cap": 20,
  "min_gap_seconds": 300,
  "timezone": "America/Toronto",
  "status": "Active"
}'
```

`gmail-draft` is the right provider for campaign one. It writes a Gmail draft
and delivers nothing, so you read every message before it goes and an
accidental send is structurally impossible rather than merely against policy.
Switch to `gmail-send` only once the drafts have been consistently right for a
while.

A draft is recorded as `DRAFTED`, never `SENT`. It does not consume the daily
cap and does not enter bounce or complaint denominators, because a draft has
reached nobody.

---

## Step 3 — build the list

The bottleneck is not software any more. It is having real contacts with a
defensible basis.

A consent-capture sheet is set up in your Drive:
**DRD Lead Engine — Consent Capture (import template)**

It has the exact columns the importer requires, a dropdown restricted to the
five valid bases, and conditional formatting that turns a row pink when it is
missing something that will get it rejected. There is deliberately no option
for a purchased or scraped list.

Work it one brand at a time, because consent is scoped per brand. For
`implied_publication` — the basis most institutional contacts will rest on —
capture four things per row: the page URL, a saved screenshot or PDF of that
page in Drive, one line on why your message concerns that person's role, and a
confirmation that the page carried no statement refusing unsolicited mail.

Public availability alone is **not** sufficient. A regulator decision held the
basis was not established simply because an address had been posted publicly,
including on a government website.

Then: File → Download → CSV, and:

```sh
curl -X POST $BASE/v1/import -H "Authorization: Bearer $KEY" \
  -d "$(jq -Rs '{csv: ., filename: "drdsports-batch-1.csv"}' batch1.csv)"
```

Every rejected row comes back with its line number and reason.

**Start small: 20 to 40 contacts.** Not because the system cannot handle more
— it imports 5,000 rows in about a second — but because the first batch is how
you find out whether the message works, and a bad message sent to 400 people
burns 400 relationships and a domain.

---

## Step 4 — arm, and send

```sh
curl $BASE/v1/readiness -H "Authorization: Bearer $KEY"
```

Work the blocking failures until `canArm` is true, record the clearance, then
arm. Full list of checks in `docs/GO-LIVE.md`.

Once armed, drafts appear in the outreach account's Gmail. Read them, send the
ones that are right, and the replies land in that mailbox as ordinary email.

---

## What is still worth building, in order

From the competitive research, ranked by what actually unblocks the next thing:

1. **A durable job runner.** This is the real architectural hole. Scheduled
   follow-ups, recurring enrichment and signal polling all need it, and none
   of them are hard once it exists. Everything else on this list is downstream.
   Options: `n8n` (currently needs reconnecting, and is the natural fit since
   it is already in the stack), or a SQLite-backed queue in-process.
2. **Reply ingestion.** Pull replies from the outreach mailbox, thread them
   onto conversations, and run the existing 12-intent classifier. Closes the
   loop that currently stops at "sent".
3. **Calendar booking.** Google Calendar is connected. The hard part is not the
   API, it is authority over free/busy: computing slots from our own meetings
   table will double-book the real calendar, so read free/busy from Google and
   treat it as the source of truth.
4. **Cheap public signals.** Job postings from public ATS endpoints, funding
   filings, news and RSS, and institutional page monitoring. Under about
   $150/month combined, mostly legally clean, and the institutional page
   monitoring is genuinely differentiated — no vendor covers Ontario school
   boards, athletic associations or provincial sport organisations.
5. **Scoring v2.** Split fit from intent from reachability, keep a rationale
   string, and calibrate against outcomes from the campaign tables we already
   have.

Explicitly **not** worth building, with reasons in
`reports/Smartlead feature gap analysis.md`: a warmup pool, our own contact
database, a seed-list placement panel, a verification engine, whitelabel and
client portals, native LinkedIn or SMS steps, a deals pipeline, and
person-level website visitor identification — the last of which carries
four-figure-per-violation litigation exposure in the US and an honest match
rate of 5 to 15 percent.

---

## Connector inventory

Connected and usable: Gmail, Google Calendar, Sheets, Docs, Drive, Slides,
Notion, Supabase, Tavily, Blotato, Gamma, Higgsfield.

Needs reconnecting: **n8n** (wanted for item 1 above), **MailerLite**, Stripe,
PayPal, Cloudflare, Canva, Dorik.

Supabase is connected and worth noting: it is hosted Postgres, so it is an
alternative to running SQLite on a VPS if this ever needs to be reachable from
more than one place. Not a migration to start today.

---

## Appendix: the exact setup, step by step

Claude cannot do any of this. The connectors available to it (Gmail, Calendar,
Drive, Sheets, Docs, Slides) act as the user on their data. Adding a domain or
creating a user needs the Workspace **Admin SDK**, which is a different API
with different scopes and is not connected. DNS is at Porkbun, where there is
no access at all.

**Verify every DNS value against what the Admin console shows you.** It
displays the exact records for your account. Google has changed its
recommended MX setup, and this file is written from memory in an environment
with no internet access, so the console wins over anything below.

### 1. Add drdsports.com as a secondary domain

Admin console → Account → Domains → Manage domains → Add a domain.
Choose **secondary domain**, not domain alias. A domain alias only mirrors
existing mailboxes; a secondary domain can hold its own users.

Google gives a TXT record to prove ownership. Add it at Porkbun, then click
verify.

### 2. DNS at Porkbun for drdsports.com

| Type | Host | Value | Note |
|---|---|---|---|
| MX | (blank/root) | `smtp.google.com` priority 1 | Google's current single-record setup. Older accounts use a five-record ASPMX set; the console shows which applies to you |
| TXT | (blank/root) | `v=spf1 include:_spf.google.com ~all` | One SPF record only. If one already exists, merge, do not add a second |
| TXT | `google._domainkey` | generated in step 3 | Do not invent this value |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@drdsports.com` | Start at p=none |

Two things that are easy to get wrong:

- **Never two SPF records.** Two records is a permanent error, not a warning,
  and it fails SPF entirely.
- **`~all`, not `-all`, to begin with.** A hard fail before you know what else
  sends as that domain will bounce legitimate mail.

### 3. Generate DKIM

Admin console → Apps → Google Workspace → Gmail → Authenticate email. Select
drdsports.com, choose **2048-bit**, generate. Publish the TXT record it gives
you at Porkbun, wait for propagation, then come back and click **Start
authentication**.

Generating the key does nothing on its own. The record must be live and the
button must be clicked, which is the step most often missed.

### 4. Create the user

Admin console → Directory → Users → Add new user, on the drdsports.com domain:

```
outreach@drdsports.com
```

A **user**, not an alias. The reputation reason often given for this is wrong:
reputation attaches to the domain, so a user and an alias on the same domain
share it. The real reasons are operational. Replies land in a clean mailbox
rather than a personal inbox of tens of thousands of messages, the reply
poller reads only that mailbox, and the credential can be revoked on its own.

This adds one seat to the bill.

### 5. Move DMARC up, later

Leave `p=none` until the aggregate reports at the rua address show your
legitimate mail passing. Then `p=quarantine`, then `p=reject`. `p=none`
asserts nothing; it only collects reports.

### What Claude can verify once this exists

- That SPF and DMARC resolve, through the readiness gate (`GET /v1/readiness`)
- That a test message from the new mailbox carries both List-Unsubscribe
  headers and that Google's DKIM signature covers them, by reading the
  received message through the Gmail connector
- That the whole gate goes green before anything is armed

DKIM alignment cannot be confirmed from DNS alone. It needs a real delivered
message, which is why that check is deliberately listed as unverified rather
than assumed to pass.
