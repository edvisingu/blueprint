# CASL review request: outbound email system

**For:** Goldblatt Partners
**Re:** Compliance review before activating B2B outbound email for DRD Sports
**Prepared:** October 2026

---

## What this is

A request for a written view on nine questions, so that an outbound email
system can be activated or not on a documented basis.

The system is **built and deliberately disabled**. It cannot send: sending is
gated behind a switch that refuses to arm until a set of checks pass, one of
which is a recorded clearance. No message has been sent and no real contact
has been imported.

**Activation is gated on clearance from Goldblatt Partners and the CPA.**
This brief is the Goldblatt half of that.

Nothing below is offered as a legal conclusion. Where a position has been
taken in the build, it was chosen as the more conservative of the available
readings, and is flagged so it can be corrected.

---

## The intended activity, stated plainly

- **Who is contacted:** staff at amateur sports clubs and school athletic
  departments, in their professional roles. Club directors, technical
  directors, athletic directors.
- **Why them:** the messages concern a website and athlete-record system, and
  sessions for athletes and families. That is the subject matter of the
  recipient organisation's own activities.
- **How addresses are obtained:** from pages the organisation publishes, such
  as a club's staff page or a school's athletics page. **No purchased lists,
  no scraped lists, no third-party data vendor.** The system has no mechanism
  to record a purchased list as a basis; the field will not accept it.
- **Volume:** tens of messages per day at most. Three messages per recipient,
  then it stops.
- **Consent basis relied on:** implied consent by conspicuous publication for
  first contact, with express consent recorded where it exists.
- **Not contacted:** parents and individuals at personal addresses. A separate
  coaching service sells to parents, and it has been excluded from outbound
  entirely on the view that a personal address is not a business contact
  published in a work role.

---

## What has been built, pending your view

Each item below was built to the stricter reading.

| Control | What it does |
|---|---|
| Consent record | Append-only, per contact and per brand. Records basis, source URL, captured evidence, date the basis arose, who recorded it, and relevance to the recipient's role |
| Anti-solicitation check | A row using conspicuous publication cannot be imported unless the person confirms the page carried no statement refusing unsolicited messages |
| Expiry clocks | Enforced in code: 24 months for an existing business relationship, 6 months for an inquiry. Express consent does not expire |
| Identification | Every message carries legal name, mailing address and contact details. Sending refuses without them |
| Unsubscribe | One click. Honoured immediately rather than within 10 business days |
| Suppression | Applied across all five brands at once, not per brand |
| Per-send record | Every message stores which consent record it relied on |
| Purchased lists | No basis value exists for one |

---

## The questions

Ordered by what most affects the decision.

### 1. Does an unsubscribe from one brand bind the others? **[highest value]**

Five brands operate under one person. A recipient who unsubscribes from a DRD
Sports message has not necessarily addressed the others.

We found no CRTC guidance either way. What we did find is an asymmetry:
consent appears to be narrow, in that affiliates must be named individually
when consent is sought, while the unsubscribe obligation appears broad, in
that any person authorised to send must honour a withdrawal.

**Built to:** suppression applies across all five brands immediately. One
request removes the address everywhere.

**Question:** is that required, or merely prudent? If it is merely prudent, is
there a lawful basis on which a brand could continue to contact someone who
unsubscribed from a different brand of the same operator, and would you advise
against relying on it?

### 2. Is the conspicuous-publication evidence set sufficient?

The system captures four things per contact: the URL of the page, a saved
screenshot or PDF of it, a written note on why the message relates to that
person's role, and a confirmation that the page carried no statement refusing
unsolicited messages.

We understand from the enforcement decisions that public availability alone
does not establish the basis, and that a higher standard applies than the mere
presence of an address on a website, including a government website.

**Question:** does the four-part record meet the standard a regulator would
expect, and what would you add?

### 3. Does an employer-published directory entry count?

Most institutional addresses are published by the organisation, not by the
individual. The statutory language concerns the recipient having published the
address or caused it to be published.

**This is the central risk in the basis we would rely on most.**

**Question:** does a staff directory entry published by a school board or a
club satisfy that, and does the answer differ between a named individual
address and a generic role address such as `athletics@`?

### 4. How long must consent and unsubscribe records be kept?

We located no retention period in CASL itself. A three-year figure appears in
secondary sources and appears to be practice-derived rather than statutory.

**Built to:** records are retained indefinitely and never deleted, since the
burden of proof sits with the sender.

**Question:** what retention period do you advise, and does the limitation
period for a notice of violation set the floor?

### 5. Should the business-to-business exemption be available at all?

We understand the exemption requires a pre-existing relationship between the
two organisations rather than between individuals, and that proving it is more
demanding than an existing business relationship.

**Built to:** it is offered as a selectable basis, and requires a written
relevance rationale.

**Question:** should it be removed as an option for first contact, on the
basis that it will rarely be available and its presence invites misuse?

### 6. Is the private right of action still suspended?

We understand an Order in Council suspended it before it came into force in
2017, and found a 2025 commentary still describing it as suspended. We could
not confirm the position as at today.

**Question:** what is the current status, and does it change the risk
assessment?

### 7. Does PIPEDA's business-contact-information exclusion cover this use?

We understand the exclusion is purpose-bound, applying where the information
is used solely to communicate with the person in relation to their business or
profession, and that public availability does not remove information from the
definition of personal information.

Our use is: collect from a published directory, store, score for fit, and
email about the recipient organisation's activities.

**Question:** does the scoring and storage step remain inside the exclusion,
or does it take the activity outside it?

### 8. Do we need to exclude Quebec initially?

Quebec's Law 25 was not researched. Targets are Canada-wide.

**Question:** does Law 25 impose anything beyond CASL and PIPEDA for this
activity, and would you advise excluding Quebec contacts from a first
campaign?

### 9. US and UK targets

Some targets are in the United States and the United Kingdom. We understand
CAN-SPAM operates on an opt-out basis and differs materially, and that UK
rules treat corporate subscribers differently from sole traders.

**Question:** would you advise restricting the first campaign to Canada and
seeking separate advice before sending to either, which is what we would
otherwise do by default?

---

## A note on our sources

The background above was assembled from secondary sources and search results.
The primary materials could not be opened directly from the environment the
system was built in, so **no statutory wording should be treated as verified**,
and the summaries above should be read as our understanding rather than as
settled citation.

The decisions we are aware of, and would ask you to confirm we have read
correctly: CompuFinder (2017, and the 2020 appeal), Blackstone, and nCrowd.
We understand CompuFinder's failure turned in part on record granularity
rather than only on consent quality, which is why the system stores a per-send
consent reference.

---

## What we would like back

A short written view on the nine questions, enough to:

1. Decide whether to activate, and on what conditions.
2. Correct anything in the built controls that is wrong or insufficient.
3. Record a clearance, or a refusal, as a dated and attributed decision.

If any question is better answered after seeing the system, it can be
demonstrated in its disabled state, and the consent schema and a sample
message can be provided in full.

---

**Status: NOT ACTIVATED. CLEARANCE REQUIRED before go-live, from Goldblatt
Partners and the CPA.** The system is built, tested and deliberately disabled
pending both.
