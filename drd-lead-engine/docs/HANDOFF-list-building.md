# Handoff: DRD Sports outbound list, batch 1

**Project:** Dr. D Lead Engineering System, first campaign list
**Date:** October 2026
**Priority:** P1
**Owner:** Lahari (data/sheets)
**Deadline:** before the Workspace mailbox is live, so the two do not block each other
**Outcome:** when this is done, 20 to 40 Ontario sports organisation contacts
exist in the capture sheet, each with evidence good enough to defend, and the
import accepts them with zero rejections.

**Nothing sends as a result of this work.** The system is disabled and stays
disabled. This produces a reviewed list, nothing more.

---

## 1. Sheet purpose

One row per contact we intend to email, carrying the evidence of why we are
permitted to email them. Under CASL the sender carries the burden of proving
consent, and that proof cannot be reconstructed later. A row without evidence
is worthless, so the importer rejects it rather than accepting it half-formed.

The sheet already exists and is set up:
**DRD Lead Engine — Consent Capture (import template)** in Drive.

Rows turn **pink** when something required is missing. Work until no row is
pink.

---

## 2. Exact columns, types, validation

| Column | Type | Required | Validation / note |
|---|---|---|---|
| `email` | text | yes | A real individual address from the published page. Not typed from a photo, not guessed from a pattern |
| `name` | text | yes | Full name as published. **A blank or a single space fails the import**, because the first message opens with it |
| `title` | text | no | As published, e.g. Club Director, Athletic Director |
| `company` | text | yes | Organisation name as it appears on its own site |
| `domain` | text | no | Inferred from the email if left blank |
| `industry` | text | no | `Sports Club` or `School Athletics` |
| `country` | text | no | `Canada` |
| `city` | text | no | The organisation's city |
| `linkedin` | text | no | Only if published on the organisation's own page |
| `phone` | text | no | Only if published |
| `consent_basis` | dropdown | yes | `implied_publication` for almost every row here |
| `consent_captured_at` | date | yes | **The date you captured the page**, not today's import date. Format YYYY-MM-DD |
| `consent_source` | URL | yes | The exact page URL carrying the address. Must start with `https://` |
| `consent_evidence` | text | yes for publication | Path or link to the saved screenshot in Drive |
| `role_relevance` | text | yes for publication | One line: why our message concerns this person's role |
| `anti_solicitation_checked` | dropdown | yes for publication | `yes` only after you have looked and not found a statement refusing unsolicited mail |

---

## 3. Source of each field

Every field comes from **the organisation's own published page**. No other
source is permitted.

### Where to look

These are categories to work through, not verified links. **Confirm each
source yourself before using it**; this spec was written without internet
access and no URL below should be trusted as given.

1. **Individual club websites.** Staff, coaches, executive or contact pages.
   This is the primary source and the cleanest evidence.
2. **Provincial sport organisation member directories.** Ontario's governing
   bodies for soccer, basketball, hockey and volleyball publish club lists.
   Use these to *find* clubs, then go to each club's own site for the contact.
3. **School board athletics pages.** Boards publish athletic department
   contacts for their secondary schools.
4. **Regional and provincial school athletic associations.** Use to find
   member schools, then go to the school's own page.
5. **League and tournament sites** that list member club contacts.

The pattern: use directories to **find organisations**, then capture the
contact from **the organisation's own page**. A directory entry about a club
is weaker evidence than the club publishing its own director's address.

### Explicitly not permitted

- Any email-finder or lookup tool
- Any purchased or downloaded list
- Any scraper, including LinkedIn
- Guessing an address from a pattern such as `firstname.lastname@`
- Anything a third party sells or aggregates

There is no dropdown value for a purchased list. The importer has no code path
that accepts one.

---

## 4. The capture procedure, per contact

1. Open the organisation's page that shows the person and their address.
2. **Read the page for any statement refusing unsolicited contact.** Wording
   varies: "no solicitation", "we do not accept sales enquiries", "this
   address is for parent enquiries only". If you find one, **do not capture
   the row.** Log the organisation on the Skipped tab with the wording.
3. **Screenshot the whole page**, with the URL bar and the date visible. Save
   to the Drive evidence folder named `organisation-page.png`.
4. Fill the row. `consent_captured_at` is today, because today is when you
   captured the page.
5. Write `role_relevance` in one line, specific to that person. Not a
   template. Examples:
   - "Club director; message concerns the club website and player records"
   - "Athletic director; message concerns athlete records and eligibility"
6. Set `anti_solicitation_checked` to `yes` only because you did step 2.

### Three judgement calls, and what to do

- **A role address such as `athletics@school.ca` with no named person.**
  Capture it on a separate tab marked `role-addresses`. **Do not put it in the
  main sheet.** Whether these are usable is an open question with counsel.
- **A personal-looking address such as a Gmail published on the club site.**
  Small clubs often publish a director's personal address. Capture it, and set
  a `notes` column to `personal-domain`. It is published by the organisation
  in a work role, but it is a weaker position, so we want them separable.
- **A page with no date visible.** Screenshot it anyway and note in `notes`
  that the page carried no date. Do not invent one.

---

## 5. Volume and pacing

**20 to 40 rows for batch one. Stop there.**

Not a technical limit. The system imports 5,000 rows in about a second. The
limit is that batch one tells us whether the message works, and a message that
does not work should reach 30 people rather than 400.

Split roughly evenly between clubs and school athletics, so both sequences get
tested.

---

## 6. Verification before handing back

Automated. No separate QA pass is needed because the importer is the gate.

1. File → Download → CSV.
2. Give the file to Andre, who imports it through the Go live screen.
3. The import returns a report naming **every rejected row, its line number
   and the reason**.
4. Fix the named rows and repeat until **rejected = 0**.

Common rejections and what they mean:

| Reason | Fix |
|---|---|
| `consent_invalid` | A required evidence field is blank, or the basis is wrong |
| `unparseable_consent_date` | Date is not YYYY-MM-DD |
| `consent_already_expired` | Wrong basis chosen, or a date far in the past |
| `invalid_email_syntax` | Typo, or a space in the address |
| `duplicate_in_file` | Same address twice |
| `domain_cannot_receive_mail` | The domain has no mail server. Usually a typo in the domain |
| `suppressed` | Already on the do-not-contact list. Correct. Leave it |

---

## 7. Update cadence and owner

- **Batch 1:** one pass, 20 to 40 rows, then stop and wait for results.
- **After batch 1:** no new capture until the first sequence has run and the
  replies are in. What we learn changes who we target.
- **Ongoing:** the sheet is the permanent record. Never delete a row after it
  has been imported, and never edit `consent_source`,
  `consent_captured_at` or `consent_evidence` on a row already imported. Those
  are the evidence. If something was wrong, add a `notes` entry; do not
  overwrite.
- **Evidence folder:** screenshots are kept indefinitely. Do not tidy them up.

---

## 8. Do not touch

- The database or the running system. This work produces a CSV, nothing more.
- Any existing MailerLite list, group or automation. Those are opted-in
  subscribers on a different legal footing and must not be mixed with this.
- The `Contacts` tab's column headers or dropdowns. The importer matches on
  exact column names, and renaming one fails the whole file.

---

## 9. Escalation

If blocked, message Andre with the section number from this document.

Two things to raise rather than decide alone:

- A page that is ambiguous about whether it refuses solicitation. Skip the row
  and flag it rather than making the call.
- Any suggestion to use a tool, a list or a service to find addresses faster.
  The answer is no, and the reason is that it would make the whole list
  indefensible rather than just that row.

---

**Status: the system is NOT ACTIVATED. Clearance required from Goldblatt
Partners and the CPA before anything sends.** This task prepares a list. It
does not activate anything.
