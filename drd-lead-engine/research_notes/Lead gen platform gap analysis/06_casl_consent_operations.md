# CASL Consent Operations — Operational Mechanics for a Canadian B2B Sender (as of 13 October 2026)

> **NOT LEGAL ADVICE. NO LEGALITY VERDICT IS GIVEN OR IMPLIED ANYWHERE IN THIS DOCUMENT.**
> This is an engineering requirements document assembled from the statute, regulations and regulator guidance as located through secondary indexes. **Qualified Canadian legal review (CASL/privacy counsel) is required before any sending occurs, and before this schema or these validation rules are relied on.** Enforcement practice under CASL evolves through CRTC decisions and undertakings; any rule here may be reinterpreted. Every item below is labelled **CONFIRMED** (corroborated by a cited source) or **UNCONFIRMED** (plausible, uncorroborated, or wording not verified against the primary text).
>
> **Research-channel limitation, stated plainly:** this environment's network policy denied direct connections to `crtc.gc.ca`, `laws-lois.justice.gc.ca`, `fightspam.gc.ca`, `priv.gc.ca` and `canlii.org` (403 at the egress proxy). I could therefore **not open the primary statutory text, the CRTC bulletins, or the enforcement decisions in full.** Everything below is sourced from search-engine extracts of those pages plus clearly-marked law-firm commentary. **Every quotation marked "verbatim-unverified" must be re-checked against the Justice Laws consolidation and the CRTC pages before it is pasted into code comments, UI copy or a message footer.**

---

## Q1. The consent record: what must a sender be able to produce to discharge the burden of proof?

### Takeaway
CASL s.13 puts the burden of proving consent on the sender, and the CRTC's July 2016 *Enforcement Advisory – Notice for businesses and individuals on how to keep records of consent* is the operative guidance on what to keep: evidence of express and implied consent, documentation of *how* consent was collected, the CASL policies and procedures themselves, and all unsubscribe requests and the actions taken on them. Enforcement decisions show that what sinks senders is per-recipient, per-message traceability — not the existence of a list.

### Cited Findings
- **CONFIRMED — burden of proof.** "section 13 of Canada's anti-spam legislation (CASL) places the onus on the sender to prove they have consent to send **every single CEM**" — [McMillan LLP, commentary](https://www.mcmillan.ca/mobile/Enforcement-Advisory-Keeping-Records-of-Consent-under-CASL). The CRTC's own FAQ states "the onus is on the person who claims that they have obtained consent to prove that they have such consent" — [CRTC CASL FAQ](https://crtc.gc.ca/eng/com500/faq500.htm).
- **CONFIRMED — the 2016 Enforcement Advisory exists and its date.** Issued **27 July 2016**, titled "Enforcement Advisory – Notice for businesses and individuals on how to keep records of consent"; applies to anyone sending CEMs, including registered charities and not-for-profits — [McMillan LLP](https://mcmillan.ca/insights/enforcement-advisory-keeping-records-of-consent-under-casl/); [Torys, "CRTC Releases Guidelines on CASL Consent Records"](https://www.torys.com/en/our-latest-thinking/publications/2016/07/crtc-releases-guidelines-on-casl-consent-records).
- **CONFIRMED — why it was issued.** CRTC staff observed that CEM senders are "frequently unable to prove they have obtained consent before sending CEMs" — [McMillan LLP](https://mcmillan.ca/insights/enforcement-advisory-keeping-records-of-consent-under-casl/).
- **CONFIRMED — the four record categories the Advisory names.** (1) evidence of **express** consent, (2) evidence of **implied** consent, (3) documentation of **how** consent was collected, (4) **CASL policies and procedures**, and (5) **all unsubscribe requests and the resulting actions**. Businesses that have not "taken steps to ensure this information is consistently recorded **in an accessible manner**" should do so "as soon as practicable" — [McMillan LLP](https://mcmillan.ca/insights/enforcement-advisory-keeping-records-of-consent-under-casl/).
- **CONFIRMED (commentary) — the per-consent field list.** Law-firm guidance on CRTC 2012-548 recommends "retain details and evidence of consent, such as the **date, time, purpose and manner** in which consent was obtained" — [McMillan LLP summary of CRTC 2012-548](https://www.mcmillan.ca/mobile/Enforcement-Advisory-Keeping-Records-of-Consent-under-CASL). **Marked as commentary**, not bulletin text.
- **CONFIRMED — oral consent evidence standard (CRTC 2012-548).** Express consent may be oral or written; oral consent "can be proven by verification by an **independent third party**, or where a **complete and unedited audio recording** of the oral consent is kept by the person asking for consent or a client of the person asking for consent" — [CRTC 2012-548](https://www.crtc.gc.ca/eng/archive/2012/2012-548.htm) (as extracted; verbatim-unverified).
- **CONFIRMED — consent must be sought separately and not bundled (CRTC 2012-548).** "Section 4 of the Regulations requires that express consent be sought separately for each of the following acts"; "requests for consent contemplated above must not be subsumed in, or bundled with, requests for consent to the [terms and conditions]" — [CRTC 2012-548](https://www.crtc.gc.ca/eng/archive/2012/2012-548.htm) (extract truncated in source; verbatim-unverified).
- **CONFIRMED — no pre-checked boxes, no opt-out (CRTC 2012-549).** "since express consent must be positive or explicit, an **opt-out mechanism is not acceptable**, nor is a '**toggle box**' where permission to send CEMs is already checked off" — commentary on CRTC 2012-549, [Barry Sookman](https://barrysookman.com/2012/10/16/crtc-issues-casl-canadas-anti-spam-law-guidelines-background-and-commentary/).
- **CONFIRMED — Blackstone Learning Corp. (Compliance and Enforcement Decision CRTC 2016-428).** Nine campaigns sent **without consent**; **nine violations of paragraph 6(1)(a)**; penalty **$50,000** (reduced from a $640,000 notice of violation) — [CRTC 2016-428 (PDF)](https://crtc.gc.ca/eng/archive/2016/2016-428.pdf). The decision read s.10(9)(b) as having "set a higher standard than the simple availability of electronic addresses" — [Slaw](https://www.slaw.ca/2016/11/24/crtc-assesses-conspicuous-publication-basis-of-implied-consent-in-casl-enforcement-decision/). "Conspicuous publication will not be established simply by evidence that an email address has been publicly posted, for example, on a government website" — [Slaw](https://www.slaw.ca/2016/11/24/crtc-assesses-conspicuous-publication-basis-of-implied-consent-in-casl-enforcement-decision/).
- **CONFIRMED — CompuFinder (Compliance and Enforcement Decision CRTC 2017-368).** "Under section 13 of the Act, CompuFinder bore the burden of proving any consent it relied on when sending messages." The decision reasoned that **without information about who received a particular message or when, "it would be nearly impossible for the company to produce specific evidence of consent from that recipient."** AMP: **$200,000** — [CRTC 2017-368](https://crtc.gc.ca/eng/archive/2017/2017-368.htm) / [PDF](https://crtc.gc.ca/eng/archive/2017/2017-368.pdf); see also [BLG commentary](https://www.blg.com/en/insights/2017/11/casl-enforcement-decision--interpretive-guidance-for-compliance-and-penalties) and [IAPP](https://iapp.org/news/a/risky-business-to-business-communications-casl-lessons-from-the-compufinder-case).
- **CONFIRMED (partial) — nCrowd / Brian Conley (CRTC 2019-111).** nCrowd **acquired an email distribution list** and used it to send CEMs; the evidence did not demonstrate valid consent for the recipients. Commentary records that **no evidence showed Conley verified or audited the consent of the purchased lists** — located via search; decision text not opened (see Gaps).
- **CONFIRMED — relationship to due-diligence defence.** "Good records may also support a due diligence defence"; the Advisory "is not a binding regulation under the Act, but companies in enforcement proceedings can expect little leeway for ignoring it" — [McMillan LLP](https://mcmillan.ca/insights/enforcement-advisory-keeping-records-of-consent-under-casl/) (commentary).

### Inferences
- **The engineering-relevant lesson from CompuFinder is log-granularity, not consent-quality:** the sender lost because it could not join *this message* to *this recipient* to *this consent artefact at this time*. A defensible system therefore needs an immutable **send-event log** carrying the `consent_record_id` that authorised each individual send — a per-send consent snapshot, not merely a per-contact consent flag.
- **The Blackstone lesson is that the evidence must be of the publication, not of the address.** A record that an address "was found on the web" is, on the reasoning as reported, insufficient; the record must evidence *who published it*, *where*, *that it was conspicuous*, and *that it carried no anti-solicitation statement*.
- **The nCrowd lesson is that acquisition is not provenance.** Purchased/rented/scraped lists carry no consent record that the sender can produce, and no audit of the vendor's consent substitutes for the sender's own per-recipient evidence.
- Field-level implication: the Advisory's "in an accessible manner" wording means a system must be able to **produce one recipient's complete consent history on demand**, i.e. an export/subject-access path, not just a database the lawyers could theoretically query.

### Gaps
- **I could not open the 2016 Enforcement Advisory, CRTC 2012-548, 2012-549, 2014-326, 2016-428, 2017-368 or 2019-111 in full** (egress blocked). The specific enumerated field list the CRTC uses in the Advisory (if it enumerates one) is therefore **UNCONFIRMED** at the level of exact wording.
- **Rogers and Plentyoffish (POF):** I found **no reliable source** in this pass for either matter's terms. Commentary records a **September 2016 voluntary undertaking with Kellogg Canada Inc.** but the snippet cut off before the terms — [BLG, "CASL — Year in Review"](https://www.blg.com/en/insights/2017/01/casl%20%20year%20in%20review). Treat Rogers / POF / Kellogg undertaking terms as **UNCONFIRMED** and re-research.
- Whether the CRTC has ever expressly demanded **IP address** or **the exact wording shown at the point of consent** as record fields is **UNCONFIRMED** — these are near-universal in practitioner checklists but I could not tie them to a CRTC text in this pass.

---

## Q2. Implied-consent categories, exact conditions and clocks; and the B2B regulatory exemption

### Takeaway
Implied consent exists only in the closed categories in CASL s.10(9)–(10): existing business relationship (2-year and 6-month clocks), existing non-business relationship, conspicuous publication (s.10(9)(b)) and disclosure/business-card (s.10(9)(a)). The separate **GIC regulation s.3(a)(ii)** B2B *exemption* (SOR/2013-221) is not a consent category at all — it removes s.6 from applying — and the Federal Court of Appeal has read its "relationship" requirement as **more demanding** than an existing business relationship.

### Cited Findings
- **CONFIRMED — the three s.10(9)(b) conspicuous-publication conditions.** (i) the recipient has conspicuously published, or caused to be conspicuously published, the electronic address to which the CEM is sent; (ii) the publication is **not accompanied by a statement that the person does not wish to receive unsolicited CEMs**; and (iii) the message **is relevant to the person's business, role, functions or duties in a business or official capacity** — [CRTC CASL guidance on implied consent](https://crtc.gc.ca/eng/com500/guide.htm); [Electro-Federation summary](https://www.electrofed.com/casl-the-5-types-of-consent-part-4-implied-conspicuously-published/). *(Wording is verbatim-unverified against the statute.)*
- **CONFIRMED — the bar is higher than public availability.** Blackstone read the provision as "set a higher standard than the simple availability of electronic addresses" — [Slaw](https://www.slaw.ca/2016/11/24/crtc-assesses-conspicuous-publication-basis-of-implied-consent-in-casl-enforcement-decision/).
- **CONFIRMED — third-party republication does not create implied consent.** "if a third party reproduces this address or sells a list of such addresses **on its own initiative**, this would not create implied consent on its own" — commentary on Blackstone, [Practical Law / Thomson Reuters](https://ca.practicallaw.thomsonreuters.com/w-004-5307).
- **CONFIRMED — s.10(9)(a) disclosure/business-card.** Implied consent arises where the recipient has **disclosed** the electronic address to the sender, without indicating a wish not to receive unsolicited CEMs, and the message is relevant to the person's business, role, functions or duties — [CRTC guidance](https://crtc.gc.ca/eng/com500/guide.htm) (condition set as extracted; verbatim-unverified).
- **CONFIRMED — clocks.** CRTC guidance on implied consent sets out the two-year window for an existing business relationship arising from a purchase/lease/contract/membership/investment and the six-month window for an inquiry or application — [CRTC guidance](https://crtc.gc.ca/eng/com500/guide.htm). A HubSpot community thread independently describes the 6-month inquiry window — [HubSpot Community](https://community.hubspot.com/t5/Email-Marketing-Tool/Managing-Implied-Consent-in-Canada/m-p/1031043) (commentary, low weight).
- **UNCONFIRMED but widely asserted — a time limit on conspicuous-publication implied consent.** CRTC guidance is reported as saying "there is a time-limitation attached to the life of the implied consent"; one consultancy blog puts it at two years, which the search could **not** corroborate against the CRTC text — [search synthesis of CRTC guidance](https://crtc.gc.ca/eng/com500/guide.htm). **Treat as UNCONFIRMED; design the schema so an expiry can be configured per category.**
- **CONFIRMED — expiry of express consent.** "once you have obtained express consent to send commercial electronic messages (CEMs), **it does not expire**, though the person may unsubscribe at any time. Therefore, if you believe you have consent to contact a consumer, you need to retain records demonstrating that consent **for as long as you will be contacting them**" — [CRTC CASL FAQ](https://crtc.gc.ca/eng/com500/faq500.htm).
- **CONFIRMED — ECPR s.3(a)(ii) wording.** The Justice Laws consolidation of **SOR/2013-221** reads: *"(ii) to an employee, representative, consultant or franchisee of another organization if the organizations have a relationship and the message concerns the activities of the organization to which the message is sent"* — [SOR/2013-221, Justice Laws](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2013-221/FullText.html) (quoted from the search extract of that page; **verbatim-unverified, re-check**).
- **CONFIRMED — the relationship need not be a business relationship.** "The organizations must 'have a relationship' (not necessarily a business relationship) and the message must concern the activities of the organization to which the message is sent" — [CRTC guidance](https://crtc.gc.ca/eng/com500/guide.htm) / law-firm summary.
- **CONFIRMED — FCA narrowed the exemption (CompuFinder appeal, 2020).** The Federal Court of Appeal held the relationship must be shown **between the organizations, not merely between some employees**: "Sender organizations must be able to establish that they had a relationship with the recipient **organization**, not just some employees." Relevance "can be established by showing the two organizations had a prior commercial relationship, or were planning transaction activity in the future." And critically: proving a "relationship" under this exemption is **"more demanding than the requirement to establish an 'existing business relationship' for the purposes of establishing implied consent"** — [Torys, "FCA confirms CASL is constitutional, but limits business communications exemption" (2020)](https://www.torys.com/en/our-latest-thinking/publications/2020/06/fca-confirms-casl-is-constitutional-but-limits-business-communications-exemption) (commentary on the FCA decision).
- **CONFIRMED — CRTC points to the exemption only with proof of relationship.** "you may also be able to rely on the business to business exemption set out in the GIC Regulations at section 3(a)(ii), **if you can demonstrate that the organizations have a relationship**" — [CRTC guidance](https://crtc.gc.ca/eng/com500/guide.htm).
- **CONFIRMED — purpose of the exemption.** The Regulatory Impact Analysis Statement describes the exemptions as protecting "regular business to business communications that are not the types of threats that were intended to be captured within the scope of the Act" — [Canada Gazette, Part I, Vol. 147, No. 1](https://gazette.gc.ca/rp-pr/p1/2013/2013-01-05/html/reg1-eng.html).

### Inferences
- **For a cold-outreach engine, s.3(a)(ii) is effectively unavailable on first contact.** On the FCA reading as reported, a sender with no pre-existing inter-organisational relationship cannot satisfy the "organizations have a relationship" limb — so the exemption cannot be the legal basis for the first email to a university, school board or club the operator has never dealt with. This is a **design constraint**, not a legality verdict: the system should not offer `b2b_exemption` as a selectable basis unless an evidenced organisation-to-organisation relationship record exists.
- There are therefore, for institutional cold outreach, realistically **two** candidate bases to engineer for: **express consent** and **s.10(9)(b) conspicuous publication** — and the latter requires per-contact evidence capture (Q9).
- Because implied-consent categories carry clocks and express consent does not, the schema needs `consent_basis` + `consent_obtained_at` + a **derived** `consent_expires_at` that is NULL only for express consent.
- The "not accompanied by a statement" condition is a **negative** fact about a web page at a point in time. A system can only prove it by storing a dated capture of the page. This argues for mandatory archival (screenshot + HTML + hash) at the moment the basis is asserted.

### Gaps
- **Exact statutory wording of s.10(9), s.10(10) and s.10(11) is UNCONFIRMED** — I could not open Justice Laws or CanLII. The two-year/six-month triggers (purchase, lease, barter, written contract, membership, investment; inquiry/application) need to be transcribed from the primary text before being coded as enumerations.
- Whether the **CRTC-made** Electronic Commerce Protection Regulations (CRTC), SOR/2012-36, impose any consent-record field requirements distinct from the GIC regulations — **UNCONFIRMED**.
- Whether a university/college/school board counts as an "organization" for s.3(a)(ii) — **UNCONFIRMED**; a question for counsel.

---

## Q3. Required message content

### Takeaway
s.6 plus the regulations require sender identification (including the person on whose behalf the message is sent, and any business/trading name), a mailing address, at least one further contact method, contact information that stays valid for a minimum of 60 days after sending, and an unsubscribe mechanism that can be readily performed at no cost and is given effect without delay and in any event within 10 business days.

### Cited Findings
- **CONFIRMED — 60 days and 10 business days, closest to verbatim found.** The sender must "give effect to an unsubscribe request **without delay, and in any event no later than 10 business days** after the request", and the address or web page "must stay valid for a **minimum of 60 days** after the message has been sent" — [Bird, quoting the regulatory language](https://bird.com/explained/compliance/what-is-casl). Corroborated independently: "An unsubscribe mechanism must be valid for at least 60 days after you send the CEM"; "If you receive a request to unsubscribe, you must comply within 10 business days" — [York University IPO](https://ipo.info.yorku.ca/canadian-anti-spam-legislation-casl/unsubscribe-mechanisms/).
- **CONFIRMED — "readily performed" and no cost.** The CRTC regulatory policy requires the mechanism be "readily performed" and free of charge — [York University IPO](https://ipo.info.yorku.ca/canadian-anti-spam-legislation-casl/unsubscribe-mechanisms/); [emaillistvalidation summary](https://emaillistvalidation.com/blog/casl-identification-and-unsubscribe-requirements-in-every-message/) (commentary).
- **CONFIRMED — the prescribed-form element list.** CEMs must identify "(i) the person who sent the CEM; (ii) the person, **if different, on whose behalf it is sent**; (iii) sender contact information (**which must be valid for at least 60 days**); and (iv) an unsubscribe mechanism" — [Canadian Advertising/Marketing Lawyer](https://www.canadianadvertisinglaw.com/anti-spam-law/) (commentary).
- **CONFIRMED — mailing address plus one of phone/email/web, and the withdrawal statement.** The footer should carry a mailing address and a telephone, email or web contact, plus "A statement that the recipient of the CEM can withdraw consent at any time in the future by using this contact information" — [York University IPO](https://ipo.info.yorku.ca/canadian-anti-spam-legislation-casl/unsubscribe-mechanisms/); [University of Alberta CASL guide](https://www.ualberta.ca/en/services/canadian-anti-spam-legislation.html).
- **CONFIRMED — trading-name requirement in consent requests.** "Where a business operates under a different name, the request must include that name. The name by which the person seeking consent carries on business, if different than their name" — [Osler, "CASL: Practical Tips For Requesting Consent" (PDF)](https://www.osler.com/osler/media/Osler/reports/privacy-data/CASL-Practical-Tips-For-Requesting-Consent.pdf) (commentary).
- **Conflicting / unreliable sources flagged.** One vendor blog states the mechanism must work "for at least **30 days**" — this matches CAN-SPAM, not CASL's 60 days, and should be disregarded; another asserts "You don't need to wait 10 days to process an unsubscribe request under CASL", which conflates the maximum with a minimum — both flagged as unreliable in [search synthesis](https://sendcheckit.com/blog/casl-compliance-guide).

### Inferences
- 10 business days is a **ceiling, not a target**. The statutory words as reported are "without delay"; a system that defers suppression to a nightly batch is already inside the spirit of the rule only if the batch runs before any further send. Safest engineering: suppress **synchronously at request time**, and treat the 10-business-day figure purely as the outer SLA for audit reporting.
- "Valid for a minimum of 60 days **after the message has been sent**" means validity is computed **per message**, so an unsubscribe URL/mailbox cannot be retired on a fixed calendar date — it must outlive the last send that referenced it by 60 days. Implication: unsubscribe tokens must be long-lived and the receiving mailbox/endpoint decommissioning must be gated on `last_send_at + 60 days`.

### Gaps
- **I could not obtain the verbatim text of CASL s.6(1)(a)–(c), s.6(2) or the regulations' s.2–3 prescribing form.** The exact wording — which the brief says matters — is **UNCONFIRMED**. Do not paste any of the above into a footer template or a legal register until transcribed from [Justice Laws SOR/2013-221](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2013-221/FullText.html), the CRTC regulations SOR/2012-36, and the Act.

---

## Q4. Record-keeping and retention

### Takeaway
There is **no statutory retention period for consent records** that I could locate; the operative standard is the CRTC FAQ's functional test — retain records "for as long as you will be contacting them" — plus the 2016 Advisory's requirement that records be consistently recorded and accessible. Any fixed number (3 years, 6 years) is practice-derived, not CASL-derived.

### Cited Findings
- **CONFIRMED — functional retention standard, not a fixed period.** "if you believe you have consent to contact a consumer, you need to retain records demonstrating that consent **for as long as you will be contacting them**" — [CRTC CASL FAQ](https://crtc.gc.ca/eng/com500/faq500.htm).
- **CONFIRMED — express consent does not expire.** Same source, same passage — [CRTC CASL FAQ](https://crtc.gc.ca/eng/com500/faq500.htm).
- **CONFIRMED — what an audit will look for, per the 2016 Advisory.** Evidence of express consent; evidence of implied consent; documentation of how consent was collected; CASL policies and procedures; and **all unsubscribe requests and the resulting actions** — recorded "consistently... in an accessible manner" — [McMillan LLP](https://mcmillan.ca/insights/enforcement-advisory-keeping-records-of-consent-under-casl/).
- **CONFIRMED — limitation period context (indirect).** CASL enforcement proceedings operate on a limitation period after which no notice of violation may be issued; commentary on the statute refers to this, but I could **not** verify the number — see Gaps.

### Inferences
- Because express consent has no expiry and the retention test is "as long as you will be contacting them", the only safe engineering default is **retain consent and unsubscribe records indefinitely (or until a documented, counsel-approved deletion schedule exists)**, with PIPEDA's data-minimisation pulling the other way — a tension that must be resolved by counsel, not by the schema.
- The CRTC's inclusion of **unsubscribe requests and the resulting actions** as a record category means the suppression log is itself a compliance artefact of equal standing to the consent log, and must be as immutable.
- Practitioner practice of **3 years post-last-contact** is a reasonable floor to *propose* to counsel, but it is **UNCONFIRMED** against any CRTC text and must not be coded as "the CASL retention period".

### Gaps
- **No stated CASL retention period was found.** UNCONFIRMED whether one exists anywhere in the Act or regulations.
- **The CASL limitation period for issuing a notice of violation (commonly cited as 3 years from the day the subject matter arose) is UNCONFIRMED** — I could not open s.26 of the Act. This number matters for setting retention, so verify it.

---

## Q5. The private right of action — current status

### Takeaway
The private right of action was **suspended indefinitely by Order in Council P.C. 2017-0580, dated 2 June 2017**, before it was due to come into force on 1 July 2017. I found **no source reporting that it has been revived, repealed, or given a new coming-into-force date**, and a September 2025 law-firm update still describes it as suspended. **Status as of 13 October 2026: still suspended, on the best available evidence — but this is UNCONFIRMED against a primary source and must be verified with counsel.**

### Cited Findings
- **CONFIRMED (via multiple independent law firms) — the order and its date.** "Order in Council **P.C. 2017-0580**, dated **June 2, 2017**", which "indefinitely suspends the effective date of the private right of action" — [Osler, "Canadian government suspends CASL private right of action"](https://www.osler.com/en/insights/updates/canadian-government-suspends-casl-private-right-of/); [DWT](https://www.dwt.com/blogs/privacy--security-law-blog/2017/06/private-right-of-action-under-canadian-antispam-le); [BLG](https://www.blg.com/en/insights/2017/06/casl---government-suspends-private-right-of-action); [Bennett Jones](https://www.bennettjones.com/Insights/Blogs/Relief-as-Private-Right-of-Action-Suspended-Under-Canadas-Anti-Spam-Law-CASL); [Smart & Biggar](https://www.smartbiggar.ca/insights/publication/anti-spam-legislation-s-private-right-of-action-suspended); [Lawson Lundell](https://www.lawsonlundell.com/publication/anti-spam-private-right-of-action-suspended).
- **CONFIRMED — stated rationale.** To "promote legal certainty for numerous stakeholders claiming to experience difficulties in interpreting several provisions of the Act while being exposed to litigation risk" — [Osler](https://www.osler.com/en/insights/updates/canadian-government-suspends-casl-private-right-of/).
- **CONFIRMED — scope of suspension.** Only the PRA is suspended; "the rest of CASL remains in force, and enforcement by the CRTC continues", including AMPs — [Mondaq / law-firm commentary](https://www.mondaq.com/canada/class-actions/610750/update-casl-private-right-of-action-suspended-but-be-careful-other-casl-provisions-are-still-alive).
- **CONFIRMED — revival remains on the table.** The 2018 government response to the parliamentary committee report said it would "consider options for its implementation, including **whether awards of damages should be based on proof of tangible harm**" — [Lexology, "Government's CASL Response: Private Right of Action Still on the Table"](https://www.lexology.com/library/detail.aspx?g=71d8cebb-e3f8-4d70-bdc1-184b8d3d89b2).
- **CONFIRMED — most recent evidence of continuing suspension.** An **Osler update dated 11 September 2025** still reports the suspension with no mention of any change — [Osler](https://www.osler.com/en/insights/updates/canadian-government-suspends-casl-private-right-of/).

### Inferences
- The prior pass's belief was correct and now has a primary instrument named (**P.C. 2017-0580, 2 June 2017**), which is the citation to verify.
- Engineering consequence: **the suspension changes nothing about the schema.** AMP exposure under s.20 (to $1M for an individual / $10M for an organisation) is unaffected, and a revived PRA would attach to the same per-message consent evidence. Do not build any control on the assumption the PRA stays suspended.

### Gaps
- **No primary-source confirmation for October 2026.** I could not reach the Orders in Council database, Justice Laws, or ISED's CASL pages. **The current status is therefore UNCONFIRMED at primary level.** Verify at the Privy Council Office OIC search for P.C. 2017-0580 and the coming-into-force notes on CASL ss. 47–55 at Justice Laws, and confirm with counsel.
- One Legal 500 page had date metadata inconsistent with its content; disregarded as a recency signal.

---

## Q6. Due-diligence defence and the compliance programme

### Takeaway
**Compliance and Enforcement Information Bulletin CRTC 2014-326 (19 June 2014)** is the CRTC's guidance on corporate compliance programmes. A documented, effective programme is a risk-management tool that may reduce violations and help show reasonable steps were taken — but it is **not a complete defence on its own**, and not every component is necessary for every organisation (explicitly so for SMBs, scaled to size and risk).

### Cited Findings
- **CONFIRMED — the bulletin, its number and date.** Compliance and Enforcement Information Bulletin **CRTC 2014-326**, dated **19 June 2014**, "Guidelines to help businesses develop corporate compliance programs" — [CRTC 2014-326](https://crtc.gc.ca/eng/archive/2014/2014-326.htm) / [PDF](https://crtc.gc.ca/eng/archive/2014/2014-326.pdf); [CanadianCharityLaw.ca](https://www.canadiancharitylaw.ca/blog/crtc_releases_guidelines_to_help_businesses_develop_corporate_compliance_pr/).
- **CONFIRMED — not a complete defence; scaled to size.** A documented programme "may lower the chance of violations and help a business show it took reasonable steps to avoid breaking the law", but "not all components may be necessary for every organization, particularly small and medium-sized businesses, depending on size and risk exposure" — [CRTC 2014-326](https://crtc.gc.ca/eng/archive/2014/2014-326.htm) (as extracted).
- **CONFIRMED — the component list.**
  1. **Senior management involvement** — "for large businesses, senior management should consider playing an active and visible role" in promoting a culture of compliance.
  2. **A named responsible person** — the bulletin refers to a "**chief compliance officer or point person**".
  3. **Risk assessment**, then a **written policy** — "the chief compliance officer or point person should consider developing a written policy **after a risk assessment**, and make it accessible to all employees, including managers."
  4. **Training**, including "**refresher training** for current and new employees, including managers, with **written acknowledgements that are recorded and maintained**."
  5. **Auditing and monitoring** of the programme's effectiveness "on an ongoing basis, with or without third-party help."
  6. **Procedures for dealing with third parties** (partners, subcontractors).
  7. **Record-keeping, especially regarding consent.**
  8. **Investigating and handling consumer complaints.**
  — [CRTC 2014-326](https://crtc.gc.ca/eng/archive/2014/2014-326.htm); component summaries corroborated by [Carters LLP](https://www.carters.ca/pub/bulletin/charity/2014/chylb344.htm) and [CanadianCharityLaw.ca](https://www.canadiancharitylaw.ca/blog/crtc_releases_guidelines_to_help_businesses_develop_corporate_compliance_pr/) (commentary).
- **CONFIRMED — mitigation in practice.** In Blackstone the AMP was set at **$50,000** against a notice of violation of **$640,000** — [CRTC 2016-428 (PDF)](https://crtc.gc.ca/eng/archive/2016/2016-428.pdf). BLG's analysis of CRTC 2017-368 is presented as "interpretive guidance for compliance and penalties", including the weight given to self-correcting measures — [BLG](https://www.blg.com/en/insights/2017/11/casl-enforcement-decision--interpretive-guidance-for-compliance-and-penalties).
- **CONFIRMED — records support due diligence.** "Good records may also support a due diligence defence" — [McMillan LLP](https://mcmillan.ca/insights/enforcement-advisory-keeping-records-of-consent-under-casl/) (commentary).
- **CONFIRMED — the bulletin page is marked ARCHIVED** on the CRTC site; its current status should be checked — [CRTC 2014-326](https://crtc.gc.ca/eng/archive/2014/2014-326.htm).

### Inferences
- Six of the eight components are **artefacts a system can own or evidence**: the written policy (versioned document), training acknowledgements (dated, per-person, retained), audit runs (scheduled job + report), third-party procedures (vendor consent-provenance attestations), consent records, and complaint tickets. Two are human (senior-management involvement, the named officer) but both should be **recorded as data** — a `compliance_officer` record with effective dates, and minuted management review.
- Because the bulletin is archived, the programme document should cite it **as at its date (19 June 2014)** and note the obligation to re-check for superseding guidance.

### Gaps
- **The exact enumerated list and wording in CRTC 2014-326 is UNCONFIRMED** (page not opened). Transcribe before building the compliance-programme checklist.
- The **statutory factors under s.20(3)** that the CRTC must consider in setting an AMP (including self-correcting measures and ability to pay) are **UNCONFIRMED** at verbatim level.

---

## Q7. PIPEDA interaction

### Takeaway
PIPEDA consent for the collection, use and disclosure of personal information is a **separate** obligation from CASL consent to send. The business-contact-information exclusion is in **PIPEDA s. 4.01** (not s.4(1)(b)) and is **purpose-bound**: it applies only where the BCI is collected, used or disclosed **solely** to communicate, or facilitate communication, with the individual in relation to their employment, business or profession. Public availability does not remove information from the definition of personal information.

### Cited Findings
- **CONFIRMED — correct section is 4.01.** The exclusion sits in **s. 4.01**; **s. 4(1)(b)** is the provision extending PIPEDA to employee information of federal works, undertakings and businesses — [OPC Interpretation Bulletin: Personal Information](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/pipeda-interpretation-bulletins/interpretations_02/). **The prior framing of this as "s.4(1)(b)" was wrong; correct it in the implementation notes.**
- **CONFIRMED — the exclusion's wording as summarised by the OPC.** "PIPEDA does not apply to business contact information collected, used or disclosed **solely for the purpose of communicating or facilitating communication with the individual in relation to their employment, business or profession**" — [OPC Interpretation Bulletin](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/pipeda-interpretation-bulletins/interpretations_02/).
- **CONFIRMED — what BCI covers.** Name, job title/position, work address, work telephone number, work fax number, work email address — [OPC Interpretation Bulletin](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/pipeda-interpretation-bulletins/interpretations_02/) (as extracted).
- **CONFIRMED — the limit: use beyond contact purposes defeats the exclusion.** If the same contact list is **sold or rented**, PIPEDA applies to every address on it — [search-sourced commentary on the BCI exclusion](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/pipeda-interpretation-bulletins/interpretations_02/) (commentary; verify).
- **CONFIRMED — public availability is not an exemption.** "information will still be personal information even if it is **publicly available**" — [OPC Interpretation Bulletin](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/pipeda-interpretation-bulletins/interpretations_02/). *(Note: this is distinct from the narrow "publicly available information" regulations under PIPEDA, which I did not reach — see Gaps.)*
- **CONFIRMED — work-device data can still be personal information.** "an individual's cell phone records from their work cell phone may be the personal information of the individual" — [OPC Interpretation Bulletin](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/pipeda-interpretation-bulletins/interpretations_02/).
- **CONFIRMED — company-level information generally outside the definition.** "information about a company is generally not personal information" — same bulletin.
- **UNCONFIRMED — CPPA reform.** One source describes Bill C-27's CPPA as narrowing the exemption to information collected, used or disclosed "solely for the purpose of communicating in relation to employment, business or profession". **Whether any such bill was enacted as of October 2026 is UNCONFIRMED and must be checked** — [Dentons Data](https://www.dentonsdata.com/cppa-an-in-depth-look-at-the-consent-provisions-in-canadas-proposed-new-privacy-law/) (commentary).

### Inferences
- The purpose-bound nature of s.4.01 means the **schema must record purpose**, because the same row of data can be inside or outside PIPEDA depending on what is done with it. A contact enriched for, say, behavioural scoring, resale, or cross-brand profiling is arguably outside the "solely to communicate with them about their business" purpose — at which point PIPEDA consent, openness and access obligations attach. Flagging this as a **design question for counsel**, not a conclusion.
- Practical implication for a five-brand operator: **cross-brand use of the same contact record may itself be a purpose question under PIPEDA**, separate from the CASL unsubscribe question in Q8.
- Scraping a directory page is a *collection* of personal information. The CASL s.10(9)(b) analysis and the PIPEDA s.4.01 analysis are independent and both must pass; a system should therefore store a `pipeda_purpose` value alongside `consent_basis`.

### Gaps
- **PIPEDA's "publicly available information" regulations (SOR/2001-7)** and whether a professional directory falls within them — **not researched; UNCONFIRMED.** This is directly relevant to directory scraping and should be a follow-up.
- Quebec **Law 25** obligations for Quebec-resident contacts — out of scope of this pass, **UNCONFIRMED**, and a known additional layer.
- Verbatim text of PIPEDA s.4.01 and s.2(1) "business contact information" — **UNCONFIRMED** (priv.gc.ca egress blocked).

---

## Q8. Suppression, DNC, and cross-brand propagation (five brands, one operator)

### Takeaway
The clearest rule located is about **consent requests**: consent given to one company does **not** extend to its affiliates unless the affiliates were **named** in the request and the recipient was told consent was also being obtained for them. Conversely, where addresses are shared, **every person authorised to send must comply with the unsubscribe requirements, and a recipient may unsubscribe from the person who obtained consent or from any other person authorised to send**. I found **no CRTC statement** that an unsubscribe from Brand A automatically binds Brands B–E — but the architecture of the rule points strongly toward a shared suppression list.

### Cited Findings
- **CONFIRMED — affiliates must be named in the consent request.** "No, unless the consent is also requested for the affiliates. If this request is made, then the person seeking consent also has to **identify all of the affiliates by name**, provide all of the same information about the affiliate that the person has to provide about itself, and **tell the person whose consent is being sought that the consent is also being obtained on behalf of the affiliates**" — [Osler, "CASL: Practical Tips For Requesting Consent" (PDF)](https://www.osler.com/osler/media/Osler/reports/privacy-data/CASL-Practical-Tips-For-Requesting-Consent.pdf) (commentary).
- **CONFIRMED — blanket/unnamed-partner consent is a recognised compliance error.** Requests seeking consent for "marketing affiliates", "marketing partners" or "partners" — "blanket type consents for any and all entities the person requesting consent may share electronic addresses [with] in the future but who are not yet known" — are listed as a common CASL error — [Canadian Advertising/Marketing Lawyer, "Common Compliance Errors"](https://www.canadianadvertisinglaw.com/canadian-spam-law-casl-common-compliance-errors/) (commentary).
- **CONFIRMED — unsubscribe scope where addresses are shared.** "Any person with whom electronic addresses are shared **must also comply with CASL's unsubscribe requirements**, and recipients may choose to unsubscribe **from the person that obtained consent or any other person authorized to send CEMs**" — [Canadian Advertising/Marketing Lawyer](https://www.canadianadvertisinglaw.com/anti-spam-law/) (commentary).
- **CONFIRMED — identification of the person on whose behalf.** Every CEM must identify both the sender and, if different, the person on whose behalf it is sent — [Canadian Advertising/Marketing Lawyer](https://www.canadianadvertisinglaw.com/anti-spam-law/); [Deloitte CASL FAQ](https://www.deloitte.com/ca/en/services/consulting-risk/perspectives/canada-anti-spam-law-casl-faq.html) (commentary).
- **CONFIRMED — consent-request content requirements.** The request must state "(i) the purpose for which consent is being sought; and (ii) information identifying the person seeking consent (or on whose behalf consent is being sought)", plus the business/trading name if different — [Osler (PDF)](https://www.osler.com/osler/media/Osler/reports/privacy-data/CASL-Practical-Tips-For-Requesting-Consent.pdf).

### Inferences
- **The asymmetry is the key design insight.** Consent is **narrow** (per named sender/brand, per purpose) while unsubscribe is **broad** (any authorised sender must honour it, and the recipient may unsubscribe from any of them). The conservative, and operationally far simpler, implementation is therefore: **consent scoped per brand; suppression global across all five brands by default.**
- A **global** suppression list avoids the hardest failure mode — the recipient who unsubscribes from Brand A, receives from Brand C, and complains to the CRTC with a single screenshot showing one operator. Brand-scoped suppression would require, at minimum, that the recipient was clearly told at consent time which brands were covered and which were separate. **Whether brand-scoped suppression is permissible is a legal question and is NOT answered here.**
- Practically: implement `suppression` with a `scope` column (`global` | `brand`) but **default every unsubscribe to `global`**, require an explicit, logged, counsel-approved override to narrow it, and never auto-narrow.
- Suppression should persist **indefinitely** — an unsubscribe is a withdrawal of consent with no expiry found anywhere in this research, and a suppression record that ages out would silently re-enable sending.

### Gaps
- **No CRTC text located stating whether an unsubscribe from one brand of a common operator binds the others.** This is **UNCONFIRMED** and is the single most important open legal question for the five-brand architecture. **Escalate to counsel explicitly.**
- **Which suppression/DNC lists must be screened.** CASL has no CRTC-operated do-not-email registry that I could confirm. The **National Do Not Call List (DNCL)** is a *Telecommunications Act* telemarketing regime, **separate from CASL**, and applies to telephone calls — relevant only if the engine ever dials or texts. Its applicability and the 31-day/consent-record rules under the Unsolicited Telecommunications Rules were **not researched in this pass; UNCONFIRMED.**
- Whether **SMS/text** sending brings the Unsolicited Telecommunications Rules into play alongside CASL — **UNCONFIRMED**, flagged as a follow-up.

---

## Q8b. How real platforms model this — actual field names to copy

### Takeaway
HubSpot is the closest off-the-shelf analogue: it splits lawful basis into **"basis to process"** (a contact property, *Legal Basis for Processing*) and **"basis to communicate"** (**subscription types**, one consent state per communication category). Salesforce uses the **Individual** object plus custom consent objects; Pardot requires **custom opt-in fields synced to Salesforce**. None of them ships a CASL-shaped per-contact consent *provenance* record, which is why this system must build one.

### Cited Findings
- **CONFIRMED — HubSpot's two-part model.** "In HubSpot, we've broken down lawful basis into two broad categories: lawful basis both **to process** (e.g. store data in your CRM or provide an ebook they requested) and **to communicate** (e.g. send a marketing email or have a sales rep call)" — [HubSpot GDPR Product Playbook](https://www.hubspot.com/data-privacy/gdpr/hubspot-product-playbook).
- **CONFIRMED — the actual property name and its five default values.** The contact property is **`Legal Basis for Processing`**, settable manually, by workflow automation, on form submission or on import. Default options: **a legitimate interest (prospect/lead)**, **a legitimate interest (existing customer)**, **the performance of a contract**, **freely given consent from contact**, **not applicable** — [HubSpot GDPR Product Playbook](https://www.hubspot.com/data-privacy/gdpr/hubspot-product-playbook); [HubSpot Knowledge Base: add notice and consent information to your form](https://knowledge.hubspot.com/forms/add-notice-and-consent-information-to-your-hubspot-form).
- **CONFIRMED — form submission sets it.** "The **Legal basis for processing contact's data** property will be set to **Freely given consent from contact**", and "the communication consent will appear in the **subscriptions** section of the contact record" — [HubSpot Knowledge Base](https://knowledge.hubspot.com/forms/add-notice-and-consent-information-to-your-hubspot-form).
- **CONFIRMED — subscription types are the per-category consent object.** Subscription types "represent the lawful basis to communicate for a certain category of communications" and replace email types; each form chooses which types it requests — [HubSpot GDPR Product Playbook](https://www.hubspot.com/data-privacy/gdpr/hubspot-product-playbook). Governance commentary recommends documenting the lawful basis **per subscription type** — [CRM Curator](https://crmcurator.com/articles/hubspot/hubspot-subscription-types-governance/) (commentary).
- **CONFIRMED — HubSpot limitation: consent capture is marketing-email only.** "The option to collect consent via form is only available for marketing emails, **not SMS messages**" — [HubSpot Knowledge Base](https://knowledge.hubspot.com/forms/add-notice-and-consent-information-to-your-hubspot-form).
- **CONFIRMED — HubSpot/CASL friction, reported by users.** A community post argues the email **preferences page pre-checks all subscription types**, which conflicts with CASL's bar on pre-checked boxes: "A requirement of CASL is that checkboxes cannot be pre-checked" — [HubSpot Ideas](https://community.hubspot.com/t/uncheck-subscription-types-by-default-in-email-preferences/15960); [HubSpot Community: Managing Implied Consent in Canada](https://community.hubspot.com/t5/Email-Marketing-Tool/Managing-Implied-Consent-in-Canada/m-p/1031043). **Commentary from non-lawyers; flagged, not endorsed.**
- **CONFIRMED — GDPR features must be switched on.** Community reports state the portal's GDPR setting must be enabled for the legal-basis and subscription features to behave as documented — [HubSpot Community](https://community.hubspot.com/t5/HubSpot-Ideas/Allow-GDPR-Consent-form-field-to-be-dependent-field/idi-p/190647).
- **CONFIRMED — Salesforce: the Individual object.** Available since **Spring '18**, it holds higher-level consent data; a **"Don't market"** flag on the Individual record is described as **overriding** the more detailed consents; detailed data-privacy permissions are commonly built as **custom objects linked to Lead, Contact or Individual** — [Ian Gotts, "GDPR compliance and Salesforce Individual object"](https://iangotts.medium.com/gdpr-compliance-and-salesforce-individual-object-bf41e04e7fa3) (commentary); [CloudKettle, "Mastering Salesforce Consent Management"](https://www.cloudkettle.com/blog/mastering-salesforce-consent-management/) (commentary).
- **CONFIRMED — Pardot: custom fields, synced.** Guidance recommends creating **custom opt-in tracking fields in Pardot with lowercase `true`/`false` values** to avoid sync problems, **mapping them to Salesforce**, storing the **date and source of consent**, and using automation to **restrict sends to valid-consent records**. Pardot's built-in confirmed-opt-in and preference pages are limited because preferences stored only in Pardot are not visible to Salesforce users — [Niall J Murphy, "Tracking GDPR Consent through Pardot Forms"](https://nialljmurphy.medium.com/tracking-gdpr-consent-through-pardot-forms-copy-27bac1fbe15f) (commentary); [Cloud Compliance](https://cloudcompliance.app/is-your-pardot-salesforce-setup-gdpr-ccpa-compliant/) (vendor commentary).

### Inferences
- **The HubSpot split maps cleanly onto the CASL/PIPEDA split** and is worth copying as the top-level shape: `pipeda_purpose` ≈ HubSpot's *basis to process*; `consent_records.basis` + per-brand/per-category subscription ≈ *basis to communicate*. The schema in the deliverables section already follows this.
- **What none of them has, and this system needs:** (a) the **exact wording shown** at consent time with a version pointer, (b) **publication evidence artefacts** for conspicuous publication, (c) **per-message relevance assessment**, (d) a **per-send consent snapshot** in the send log. These are the CASL-specific gaps that make an off-the-shelf CRM insufficient as the system of record.
- **Salesforce's "Don't market" override is a good pattern to copy** as a single, highest-precedence global suppression boolean evaluated before everything else — which matches validation rule 1.
- **Pardot's lowercase `true`/`false` sync caveat** is a real integration hazard worth noting if any of this ever syncs to Salesforce: use canonical lowercase string booleans at the integration boundary.

### Gaps
- **Mailchimp "marketing permissions" and MailerLite consent field names: NOT FOUND.** Two searches returned nothing on either vendor's consent data model. **UNCONFIRMED** — needs a direct documentation pass (relevant since the operator already uses MailerLite per the brand stack).
- **OneTrust and Osano consent-management data models: NOT RESEARCHED in this pass. UNCONFIRMED.** Their "consent receipt" / purpose-and-proof record structure (and the ISO/IEC 29184 and Kantara consent-receipt specs) is the closest industry standard to what is needed here and should be a follow-up.
- Some third-party blogs claim HubSpot has **no built-in consent log** and that a custom legal-basis dropdown is required; this conflicts with HubSpot's own default property. **Conflict noted, unresolved** — [emaillistvalidation](https://emaillistvalidation.com/blog/hubspot-legal-basis-and-consent-logging-for-subscribers/) (low-quality commentary).

---

## Q9. A defensible conspicuous-publication record for institutional contacts

### Takeaway
On the Blackstone reasoning as reported, the mere fact that an address appears on a public institutional page does **not** establish s.10(9)(b). The record must evidence four separable facts: (1) the address was published **by the person or caused by them to be published**, (2) the publication was **conspicuous**, (3) there was **no accompanying anti-solicitation statement**, and (4) the message **is relevant to that person's business, role, functions or duties**. Each needs its own captured artefact.

### Cited Findings
- **CONFIRMED — public posting alone is insufficient.** "'conspicuous publication' will not be established simply by evidence that an email address has been publicly posted, for example, **on a government website**" — [Slaw, on Blackstone](https://www.slaw.ca/2016/11/24/crtc-assesses-conspicuous-publication-basis-of-implied-consent-in-casl-enforcement-decision/). The CRTC "set a higher standard than the simple availability of electronic addresses" — same source.
- **CONFIRMED — third-party republication does not count.** If a third party reproduces the address or sells a list of such addresses "on its own initiative, this would not create implied consent on its own" — [Practical Law](https://ca.practicallaw.thomsonreuters.com/w-004-5307).
- **CONFIRMED — the relevance limb.** The CEM must be "relevant to the person's business, role, functions or duties in a business or official capacity" — [CRTC guidance](https://crtc.gc.ca/eng/com500/guide.htm); [Electro-Federation](https://www.electrofed.com/casl-the-5-types-of-consent-part-4-implied-conspicuously-published/).
- **CONFIRMED — the burden is the sender's.** "When relying on implied consent, the burden will be on you as the sender of CEMs to demonstrate that you have complied with all of CASL's requirements" — [CRTC guidance](https://crtc.gc.ca/eng/com500/guide.htm).
- **CONFIRMED — the CompuFinder traceability failure.** Without information about who received a particular message or when, "it would be nearly impossible for the company to produce specific evidence of consent from that recipient" — [CRTC 2017-368](https://crtc.gc.ca/eng/archive/2017/2017-368.htm).

### Inferences — the evidence package to capture per contact (proposed; NOT a legality opinion)
For each of the three example cases — a university directory page listing a Dean's address; a school-board athletic director page; a sports club's public staff page — capture at the moment the basis is asserted:

1. **Source URL** (exact, canonical, deep-linked to the entry, not the site root).
2. **Dated full-page capture**: rendered screenshot (PNG/PDF) **plus** raw HTML, both hashed (SHA-256) and stored immutably with the capture timestamp and the capturing user/agent.
3. **The exact extracted address string** and the surrounding text block, so the "conspicuous" claim can be inspected later (is it in a staff directory with a role title, or buried in a PDF footnote?).
4. **Publisher identification** — who operates the domain (the university, the board, the club), i.e. evidence the **organisation the person works for** published it, which is the strongest available proxy for "caused to be published". **Note the weakness honestly:** an institutional directory is published by the employer, not personally by the Dean. Whether that satisfies "the person has... caused to be conspicuously published" is **a legal question I am not answering** and is a priority item for counsel.
5. **Negative evidence on anti-solicitation**: a recorded, automated check of the captured page (and its site-wide terms/legal/privacy pages) for anti-solicitation language — "no unsolicited", "do not contact", "no solicitation", "not for marketing purposes" — with the search terms used, the result, and the timestamp stored. A **positive hit must hard-block** the contact.
6. **Role/relevance evidence**: the **role title as published** (e.g. "Dean, Faculty of Education"; "Athletic Director"), stored as text, plus a stored **relevance rationale** tying the intended message topic to that role, and the **campaign/topic identifier** the relevance was assessed against. Relevance is assessed **per message topic**, not once per contact — so the join must be `(contact, campaign)`, re-evaluated when the topic changes.
7. **Capture provenance**: who/what captured it (human operator ID or crawler version), the method, and whether the page was behind any access barrier (a page requiring login is not a conspicuous publication).

### Gaps
- **Whether an employer-published directory entry satisfies "caused to be conspicuously published" is UNCONFIRMED** and is the central legal risk in this basis. The Blackstone decision's actual reasoning on this point could not be read (egress blocked).
- **No CRTC guidance located on what "conspicuous" means operationally** (prominence, searchability, context). UNCONFIRMED.
- Whether a **generic institutional mailbox** (`athletics@board.ca`) rather than a named individual's address changes the analysis — **UNCONFIRMED**; arguably no identifiable "person" whose role relevance can be tested.

---

## Implementable Deliverables

> **Reminder, deliberately repeated: these are engineering proposals derived from the research above. They are NOT legal advice and NOT a determination that any contact may lawfully be messaged. Qualified Canadian legal review of this schema, these validation rules and the footer template is required before any sending.** Several inputs below are marked UNCONFIRMED and must be verified against the primary texts, which this environment's network policy prevented me from opening.

### (1) Proposed per-contact consent schema

**`contacts`**

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | no | |
| `email` | citext | no | unique per tenant; normalised lowercase |
| `email_domain` | text (generated) | no | for org matching |
| `full_name` | text | yes | |
| `published_role_title` | text | yes | **verbatim as published** — evidence for s.10(9)(b)(iii) |
| `organisation_id` | uuid FK → `organisations` | yes | |
| `jurisdiction` | text | yes | ISO subdivision; flags QC (Law 25) — UNCONFIRMED scope |
| `pipeda_purpose` | enum | no | `communicate_re_their_business` \| `other` — s.4.01 purpose-bound (CONFIRMED) |
| `created_at`, `updated_at` | timestamptz | no | |

**`consent_records`** — append-only; **never update, never delete**; one row per consent event.

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | no | |
| `contact_id` | uuid FK | no | |
| `brand_id` | uuid FK → `brands` | no | consent is **brand-scoped** (CONFIRMED: affiliates must be named) |
| `basis` | enum | no | `express` \| `implied_ebr_purchase_2y` \| `implied_inquiry_6m` \| `implied_non_business_relationship` \| `implied_conspicuous_publication` \| `implied_disclosure_business_card` \| `exempt_b2b_s3a_ii` |
| `obtained_at` | timestamptz | no | **date AND time** (CONFIRMED as recommended record field) |
| `expires_at` | timestamptz | yes | NULL only for `express` (CONFIRMED: express consent does not expire). Derived per basis; conspicuous-publication expiry **configurable, UNCONFIRMED** |
| `method` | enum | no | `web_form` \| `oral_recorded` \| `oral_third_party_verified` \| `written` \| `email_reply` \| `directory_capture` \| `inferred_transaction` |
| `source_system` | text | no | app/import/crawler name + version |
| `exact_wording_shown` | text | yes | **required when `method='web_form'`** — the literal consent text rendered |
| `wording_version_id` | uuid FK → `consent_wording_versions` | yes | versioned templates, retained |
| `purpose_stated` | text | yes | CONFIRMED required in a consent request |
| `identified_parties` | jsonb | yes | `[{legal_name, carrying_on_business_as, brand_id, role:"seeker"\|"on_behalf_of"\|"affiliate"}]` — CONFIRMED: affiliates named individually |
| `separate_from_tos` | boolean | yes | CONFIRMED: must not be bundled (2012-548) |
| `pre_checked` | boolean | no default true | must be **false** for express (CONFIRMED: 2012-549 forbids pre-checked/toggle/opt-out) |
| `ip_address` | inet | yes | **UNCONFIRMED as a CRTC requirement**; standard practice |
| `user_agent` | text | yes | as above |
| `form_url` | text | yes | |
| `audio_recording_ref` | text | yes | **required when `method='oral_recorded'`** — complete & unedited (CONFIRMED) |
| `third_party_verifier` | text | yes | required when `method='oral_third_party_verified'` (CONFIRMED) |
| `ebr_trigger_event` | enum | yes | `purchase` \| `lease` \| `barter` \| `written_contract` \| `membership` \| `investment` \| `inquiry` \| `application` — enumeration **UNCONFIRMED verbatim** |
| `ebr_trigger_at` | timestamptz | yes | the date the clock starts |
| `created_by` | text | no | operator or agent id |
| `record_hash` | text | no | SHA-256 over the row for tamper evidence |

**`publication_evidence`** — one row per `consent_records.id` where `basis='implied_conspicuous_publication'`.

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | no | |
| `consent_record_id` | uuid FK | no | |
| `source_url` | text | no | deep link to the entry |
| `captured_at` | timestamptz | no | |
| `screenshot_ref` | text | no | immutable object store key |
| `screenshot_sha256` | text | no | |
| `html_ref` | text | no | |
| `html_sha256` | text | no | |
| `extracted_address` | citext | no | must equal `contacts.email` |
| `surrounding_text` | text | no | the directory entry block |
| `publisher_entity` | text | no | who operates the page |
| `publisher_is_employer` | boolean | no | **weak proxy for "caused to be published" — flagged for counsel** |
| `behind_auth` | boolean | no | must be **false** |
| `antisolicitation_scan_terms` | text[] | no | the literal terms searched |
| `antisolicitation_found` | boolean | no | must be **false** (CONFIRMED condition (ii)) |
| `antisolicitation_pages_checked` | text[] | no | page + site terms/legal/privacy URLs |
| `role_title_as_published` | text | no | CONFIRMED condition (iii) input |

**`relevance_assessments`** — relevance is per **message topic**, not per contact.

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | no | |
| `contact_id` | uuid FK | no | |
| `campaign_id` | uuid FK | no | |
| `topic` | text | no | |
| `role_title_considered` | text | no | |
| `rationale` | text | no | why the topic relates to that role/function/duty |
| `assessed_by` | text | no | |
| `assessed_at` | timestamptz | no | |
| `outcome` | enum | no | `relevant` \| `not_relevant` |

**`org_relationships`** — required if `exempt_b2b_s3a_ii` is ever used.

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | no | |
| `sender_org_id`, `recipient_org_id` | uuid FK | no | **organisation-to-organisation** (CONFIRMED per FCA) |
| `relationship_type` | enum | no | `prior_commercial` \| `planned_transaction` \| `other_evidenced` |
| `evidence_ref` | text | no | contract/PO/correspondence artefact |
| `established_at` | timestamptz | no | |
| `message_concerns_recipient_activities` | boolean | no | must be **true** (CONFIRMED regulation wording) |

**`suppressions`** — append-only; **no expiry**.

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | no | |
| `email` | citext | no | indexed; keyed on address, not contact, so it survives re-import |
| `scope` | enum | no | **default `global`** across all five brands; `brand` only with logged override |
| `brand_id` | uuid FK | yes | set only when `scope='brand'` |
| `requested_at` | timestamptz | no | start of the 10-business-day clock |
| `channel` | enum | no | `link` \| `reply` \| `email_to_address` \| `phone` \| `manual` \| `complaint` |
| `effected_at` | timestamptz | yes | when sending actually stopped |
| `business_days_elapsed` | int (generated) | yes | audit metric; must be ≤ 10 (CONFIRMED) |
| `raw_request_ref` | text | yes | the original message/log |
| `actioned_by` | text | yes | CONFIRMED: Advisory requires requests **and resulting actions** |
| `scope_override_reason` | text | yes | required when `scope='brand'` |
| `scope_override_approved_by` | text | yes | as above |

**`send_events`** — the CompuFinder-proof log. Append-only.

| Field | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | no | |
| `contact_id`, `campaign_id`, `brand_id` | uuid FK | no | |
| `recipient_address` | citext | no | denormalised: who actually received it |
| `sent_at` | timestamptz | no | who received what, when (CONFIRMED gap that sank CompuFinder) |
| `consent_record_id` | uuid FK | no | **NOT NULL** — the basis that authorised *this* send |
| `consent_basis_snapshot` | enum | no | copied at send time |
| `relevance_assessment_id` | uuid FK | yes | required when basis is `implied_conspicuous_publication` or `implied_disclosure_business_card` |
| `message_html_sha256` | text | no | proves what footer was actually rendered |
| `footer_sender_identity` | jsonb | no | names, trading names, on-behalf-of |
| `footer_mailing_address` | text | no | |
| `footer_contact_method` | text | no | |
| `unsubscribe_token` | text | no | |
| `unsubscribe_valid_until` | timestamptz (generated) | no | `sent_at + 60 days` minimum (CONFIRMED) |

Supporting tables: `brands`, `organisations`, `consent_wording_versions`, `compliance_policy_versions`, `training_acknowledgements`, `compliance_audits`, `complaints`, `vendor_attestations`, `compliance_officers`.

### (2) Validation rules to enforce before a contact may be messaged

Implement as a single `can_send(contact_id, campaign_id, brand_id)` gate. **Fail closed.** Any rule that cannot be evaluated returns *deny*.

1. **Suppression first.** Deny if any `suppressions` row matches the address with `scope='global'`, or with `scope='brand'` and that `brand_id`. Check on the **normalised address**, and on every alias/plus-address form.
2. **A consent record must exist** for `(contact, brand)` — not for a sibling brand. Deny if none.
3. **Not expired.** Deny if `expires_at IS NOT NULL AND expires_at <= now()`. Clocks: EBR purchase/contract/membership/investment = **2 years** from `ebr_trigger_at`; inquiry/application = **6 months** from `ebr_trigger_at` (CONFIRMED categories; verbatim enumeration UNCONFIRMED). Conspicuous publication = configurable expiry, **default conservative**, because the duration is UNCONFIRMED.
4. **Express-consent integrity.** If `basis='express'`: require `pre_checked = false`, `separate_from_tos = true`, non-empty `exact_wording_shown` + `wording_version_id`, non-empty `purpose_stated`, and `identified_parties` containing the sending brand (and, if sending on another's behalf, that party too). Deny otherwise.
5. **Oral consent evidence.** If `method='oral_recorded'` require `audio_recording_ref` and a flag that it is complete and unedited; if `method='oral_third_party_verified'` require `third_party_verifier`. Deny otherwise.
6. **Conspicuous publication completeness.** If `basis='implied_conspicuous_publication'`, require a `publication_evidence` row with: non-empty `source_url`, both artefact refs **and** both hashes, `behind_auth = false`, `antisolicitation_found = false`, non-empty `role_title_as_published`, and `extracted_address = contacts.email`. Deny otherwise.
7. **Relevance per topic.** If basis is `implied_conspicuous_publication` or `implied_disclosure_business_card`, require a `relevance_assessments` row for **this** `campaign_id` with `outcome='relevant'`. Deny if the campaign topic changed after the assessment.
8. **B2B exemption gate.** If `basis='exempt_b2b_s3a_ii'`, require an `org_relationships` row between the **sender organisation and the recipient organisation** with evidence and `message_concerns_recipient_activities = true`. Deny if the only evidence is employee-level contact (CONFIRMED per FCA reading). *Recommend disabling this basis entirely for first-contact outreach pending counsel.*
9. **Purchased/scraped-list block.** Deny where provenance is a purchased, rented, appended or third-party-republished list, regardless of any claimed consent (nCrowd/Blackstone pattern). Enforce via a mandatory `source_system` allowlist plus a `vendor_attestations` requirement for any import.
10. **Footer completeness pre-flight.** Deny the send if the rendered message fails the footer checks in (3). Validate the **rendered** output, not the template.
11. **Unsubscribe liveness.** Deny if the unsubscribe endpoint and reply mailbox fail a live health check, or if either is scheduled for decommissioning before `now() + 60 days`.
12. **Rate/complaint circuit breaker.** Deny brand-wide sending if complaint or hard-bounce rates exceed thresholds, pending review (supports the "self-correcting measures" posture).
13. **Record-hash integrity.** Deny if `consent_records.record_hash` does not match a recomputation (tamper detection).
14. **Legal-review gate.** A global, environment-level flag `casl_legal_review_completed_at` must be set, with the reviewing counsel recorded, before the production sender is enabled at all. **Default: unset, production sending disabled.**

### (3) Required message-footer elements

Build as a single rendered block, validated post-render. **Exact statutory wording is UNCONFIRMED — transcribe from Justice Laws and the CRTC regulations and have counsel approve the template before use.**

1. **Identification of the person who sent the message** — legal name.
2. **Identification of the person on whose behalf it is sent**, if different (CONFIRMED).
3. **Any name under which the sender carries on business**, if different from the legal name (CONFIRMED for consent requests; apply to the footer as the conservative reading).
4. **Each affiliate/brand on whose behalf the message is sent, named individually** — no "our partners" or "marketing affiliates" (CONFIRMED as a recognised error).
5. **Mailing address** (CONFIRMED).
6. **At least one of**: telephone number with an active response voicemail, email address, or web address (CONFIRMED).
7. **A statement that the recipient may withdraw consent at any time** using that contact information (CONFIRMED per university guidance).
8. **An unsubscribe mechanism** that can be **readily performed**, at **no cost**, in the same or a linked form (CONFIRMED).
9. **A statement that contact information remains valid for at least 60 days** after the message is sent — and the system must make that true per message (CONFIRMED).
10. **Optional but recommended for the implied-consent case**: a plain-language line stating why the recipient is being contacted in their professional role. **UNCONFIRMED as a requirement**; it is an evidentiary and complaint-reduction measure only.

Do **not** include: pre-checked preference states, cost or login barriers to unsubscribing, or any requirement to reply to unsubscribe when a link is offered.

### (4) Audit artefacts to retain, and for how long

There is **no CASL retention period that I could locate (CONFIRMED gap).** The operative standard is the CRTC FAQ's "for as long as you will be contacting them", and express consent does not expire. The proposal below is conservative; the retention schedule must be set by counsel, balancing this against PIPEDA data minimisation.

| Artefact | Retain for (proposed) | Basis |
|---|---|---|
| `consent_records` + wording versions | **Indefinitely** while the contact is contactable, then a counsel-set tail (practitioner practice suggests ≥3 years after last contact — **UNCONFIRMED**) | CRTC FAQ: as long as you will be contacting them; express consent does not expire |
| `publication_evidence` (screenshots, HTML, hashes) | Same as the consent record it supports | s.10(9)(b) conditions are facts about a page at a time |
| `relevance_assessments` | Same as the consent record | condition (iii) is per-message |
| `send_events` (who received what, when, under which consent) | **Indefinitely / counsel-set tail ≥ the limitation period** | CompuFinder: per-recipient, per-message traceability is what the CRTC asked for |
| Rendered message copies / footer hashes | Same as `send_events` | proves the footer actually shown |
| `suppressions` incl. the raw request and the action taken | **Indefinitely** | Advisory expressly lists unsubscribe requests **and resulting actions**; a lapsed suppression silently re-enables sending |
| CASL policies & procedures, all versions | Indefinitely | Advisory lists policies as a record category; CRTC 2014-326 |
| Training records with written acknowledgements | Indefinitely | CRTC 2014-326 |
| Audit/monitoring reports | Indefinitely | CRTC 2014-326 |
| Complaint records and their resolution | Indefinitely | CRTC 2014-326 |
| Vendor/third-party attestations and procedures | Indefinitely | CRTC 2014-326; nCrowd pattern |
| Named compliance officer record, with effective dates | Indefinitely | CRTC 2014-326 |
| Legal-review sign-offs | Indefinitely | due-diligence posture |

**Verify before building, because I could not open these pages:** the **CASL limitation period** for a notice of violation (commonly cited as three years; **UNCONFIRMED**), which should set the minimum retention tail.

---

### Primary sources to re-open once network access permits (all were blocked in this pass)
- CASL, S.C. 2010, c. 23 — ss. 6, 10(1)–(2), 10(9)–(11), 13, 20, 26, 47–55 — https://laws-lois.justice.gc.ca/eng/acts/E-1.6/FullText.html
- Electronic Commerce Protection Regulations (GIC), SOR/2013-221 — esp. s.3(a)(ii) — https://laws-lois.justice.gc.ca/eng/regulations/SOR-2013-221/FullText.html
- Electronic Commerce Protection Regulations (CRTC), SOR/2012-36
- Compliance and Enforcement Information Bulletin CRTC **2012-548** — https://www.crtc.gc.ca/eng/archive/2012/2012-548.htm
- Compliance and Enforcement Information Bulletin CRTC **2012-549**
- Compliance and Enforcement Information Bulletin CRTC **2014-326** (19 June 2014, ARCHIVED) — https://crtc.gc.ca/eng/archive/2014/2014-326.htm
- CRTC **Enforcement Advisory – Notice for businesses and individuals on how to keep records of consent**, 27 July 2016
- CRTC CASL **Guidance on Implied Consent** — https://crtc.gc.ca/eng/com500/guide.htm
- CRTC CASL **FAQ** — https://crtc.gc.ca/eng/com500/faq500.htm
- Compliance and Enforcement Decision CRTC **2016-428** (Blackstone Learning Corp.) — https://crtc.gc.ca/eng/archive/2016/2016-428.pdf
- Compliance and Enforcement Decision CRTC **2017-368** (CompuFinder / 3510395 Canada Inc.) — https://crtc.gc.ca/eng/archive/2017/2017-368.htm
- Compliance and Enforcement Decision CRTC **2019-111** (nCrowd / Brian Conley)
- Federal Court of Appeal decision on the CompuFinder constitutional reference and s.3(a)(ii) (2020)
- Order in Council **P.C. 2017-0580** (2 June 2017) — private right of action suspension
- OPC **Interpretation Bulletin: Personal Information** — https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/pipeda-interpretation-bulletins/interpretations_02/
- PIPEDA s. 4.01 and s. 2(1) "business contact information"; and the **Regulations Specifying Publicly Available Information**, SOR/2001-7

> **Final reminder: nothing above is legal advice, and no view is expressed on whether any contact, list, basis or campaign is lawful. Qualified Canadian legal counsel must review the statutory wording, this schema, the validation rules and the footer template before any commercial electronic message is sent. Several load-bearing items are labelled UNCONFIRMED because this environment's network policy blocked access to the primary sources; they must be verified, not assumed.**
