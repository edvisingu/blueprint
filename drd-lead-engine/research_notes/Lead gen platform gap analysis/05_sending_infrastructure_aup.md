# Sending Infrastructure Options and Acceptable-Use Positions for Cold B2B Outbound (as of 2026-10-13)

> **CRITICAL METHODOLOGICAL FAILURE — READ FIRST.**
>
> This research pass **could not retrieve a single provider policy page**. Two independent fetch paths failed:
>
> 1. **Direct egress is blocked by organization proxy policy.** `curl` to every host probed returned `CONNECT tunnel failed, response 403` — including `postmarkapp.com`, `aws.amazon.com`, `docs.aws.amazon.com`, `resend.com`, `www.mailgun.com`, `sendgrid.com`, `www.twilio.com`, `www.brevo.com`, `www.mailjet.com`, `www.sparkpost.com`, `www.scaleway.com`, `www.zoho.com`, `www.mailersend.com`, `support.google.com`, `learn.microsoft.com`, `www.rfc-editor.org`, `datatracker.ietf.org`, `www.smartlead.ai`, `instantly.ai`, `zapmail.ai`, `mailforge.ai`, `mailreef.com`, and even `en.wikipedia.org` and `www.google.com`. Per `/root/.ccr/README.md`, 403 from the proxy is an organization egress-policy denial and must be reported, not routed around.
> 2. **`WebFetch` returned `getaddrinfo ENOTFOUND` for every URL attempted** (Postmark support article, AWS AUP, Resend AUP, Mailgun AUP, Twilio AUP, rfc-editor.org/rfc/rfc8058.html). No page content was obtained.
> 3. **Tavily extract/search MCP tools are not configured** (`Invalid Tavily API key`).
>
> **The ONLY working research tool was `WebSearch`**, which returns a search index's synthesized summary plus result links — it does **not** return verbatim page text, and it mixed in visibly irrelevant/polluted results (e.g. `research.flashscore.com` returned as a top hit for a Postmark policy query).
>
> **Consequence for this task's stated objective:** the assignment states "Quoting AUP language accurately is the entire value of this task — paraphrase is not good enough, and an invented or softened policy quote would lead to a terms violation and a burned domain." **I therefore did not produce AUP quotes.** Every short quoted string below is a fragment *as reported by the search index*, not text I read on the provider's page, and is labeled accordingly. **No policy quote in this document should be relied on for a procurement or compliance decision.** The AUP-quoting portion of this assignment is **UNRESOLVED and must be re-run from an environment with unrestricted HTTPS egress**, or by a human opening the pages.
>
> Label key: **CONFIRMED** = primary source text obtained and read. **INDEX-REPORTED** = search index attributes this to a primary source but I did not see the page. **SECONDARY** = vendor blog / third-party. **CONFLICTING**. **UNCONFIRMED** = no adequate source.
>
> **There are zero CONFIRMED policy-text findings in this document.** All provider-policy findings are at best INDEX-REPORTED.

---

## Q1. Per-provider AUP position on cold / unsolicited B2B outbound

### Takeaway

Not resolvable at the required evidentiary standard in this environment. The search index consistently indicates that mainstream transactional ESPs condition sending on recipient consent and prohibit purchased/scraped lists — which is directionally the same conclusion the prior research pass reached — but **the specifics the assignment asked for (actual policy wording, per-provider permitted/prohibited/ambiguous determination) remain unresolved for every one of the fourteen providers named.** Dedicated cold-email infrastructure resellers are the only category where the vendors' own marketing openly positions the product for cold outbound, and even there I retrieved no terms text.

### Cited Findings

**Postmark (reportedly the most explicit prohibition — NOT VERIFIED)**
- The assignment's premise that Postmark explicitly prohibits cold email **could not be verified**. A targeted extended search for Postmark's AUP/ToS text "didn't turn up Postmark's Acceptable Use Policy or Terms of Service, so I couldn't confirm a cold-outreach ban from an official source." — [WebSearch result set, 2026-10-13](https://postmarkapp.com/support/article/1061-what-types-of-emails-can-i-send-with-postmark) (URL is the intended primary source; fetch failed with ENOTFOUND)
- The only *Postmark-hosted* page the index surfaced containing the word "unsolicited" is the **Responsible Disclosure Policy**, which is addressed to security researchers, not senders: index-reported fragment "Do not try to abuse our servers' resources, including but not limited to sending unsolicited or unauthorized emails." **This is not a sending policy and must not be cited as one.** — [Postmark Responsible Disclosure Policy](https://postmarkapp.com/support/article/779-responsible-disclosure-policy) — INDEX-REPORTED
- Postmark's bounce/complaint article is index-reported to treat spam complaints as "a clear metric to determine abuse and poor sending practices," with a complained-about address deactivated and **not reactivatable by the sender**. — [Postmark: What are bounces and spam complaints?](https://postmarkapp.com/support/article/what-are-bounces-and-spam-complaints) — INDEX-REPORTED
- A secondary vendor blog asserts Postmark "explicitly prohibited" cold outreach, bulk marketing to unverified lists and "any unsolicited messaging," and suspends cold-email accounts quickly. This is a competitor-adjacent source. — [puzzleinbox.com (vendor-owned)](https://puzzleinbox.com/blog/postmark-vs-mailgun-cold-email-2026) — SECONDARY, VENDOR-OWNED
- A separate secondary review states Postmark's ToS require permission-based subscription lists and prohibit purchased or rented lists, and that Postmark "is NOT a cold email tool" with ban risk for cold outreach. — [leadhaste.com](https://leadhaste.com/blog/postmark-review); [puzzleinbox.com](https://puzzleinbox.com/tools/postmark) — SECONDARY, VENDOR-OWNED
- **Net: Postmark is the strongest candidate for "explicitly prohibited," but the claim rests entirely on secondary vendor sources. Treat as UNCONFIRMED pending a direct read of postmarkapp.com/support/article/1061 and Postmark's ToS.**

**SendGrid / Twilio**
- Index-reported that SendGrid's opt-in requirements prohibit "sending unsolicited or unwanted emails in bulk" and ban sending to addresses "scraped from the internet" / "pulled from the internet or social media." Source for these fragments is a vendor blog, not Twilio's AUP. — [puzzleinbox.com](https://puzzleinbox.com/blog/sendgrid-cold-email-policy-ban-2026); [docs.mailshake.com](https://docs.mailshake.com/article/274-should-i-send-with-smtp-platforms) — SECONDARY, VENDOR-OWNED. Intended primary: https://www.twilio.com/en-us/legal/aup (fetch failed)
- **Determination: leaning PROHIBITED for scraped-list sending; UNRESOLVED for documented-consent B2B outbound.**

**Mailgun**
- Index-reported AUP fragment: "acquiring or sending to a third-party mailing list is prohibited." A second source characterizes current policy as restricting *high-volume* cold email specifically, which would be narrower than a blanket ban. **These two readings conflict.** — [docs.mailshake.com](https://docs.mailshake.com/article/274-should-i-send-with-smtp-platforms); [puzzleinbox.com](https://puzzleinbox.com/blog/postmark-vs-mailgun-cold-email-2026) — CONFLICTING, both SECONDARY. Intended primary: https://www.mailgun.com/legal/aup/ (fetch failed)
- **Determination: AMBIGUOUS on the evidence available.**

**Resend**
- Sources disagree: one says Resend forbids cold outreach outright; another says its AUP "restricts" cold outreach among other categories. No policy text retrieved. — WebSearch result set, 2026-10-13; intended primary: https://resend.com/legal/acceptable-use-policy (fetch failed) — CONFLICTING, SECONDARY
- **Determination: AMBIGUOUS / UNRESOLVED.**

**Brevo — the only provider with an index-reported quote attributed to its own policy page**
- Index-reported from Brevo's own anti-spam policy: "Brevo has a very strict anti-spam policy. Indeed, it is crucial that emails and SMS campaigns and other sorts of solicitation are expected by their recipients." Consent rules are index-reported to require an "active, explicit, and specific opt-in," with violations leading to "immediate suspension or restriction of their account." — [Brevo anti-spam policy](https://www.brevo.com/legal/antispampolicy/); [Brevo help centre](https://help.brevo.com/hc/en-us/articles/209405205-What-is-the-anti-spam-policy-of-Brevo) — INDEX-REPORTED (page not read)
- **Determination: if the "active, explicit, and specific opt-in" wording is accurate, CASL *implied* consent (conspicuously-published business address) would NOT satisfy Brevo's stated standard. This is the single most decision-relevant finding in the whole pass and it needs verification before it is relied upon.**

**Amazon SES**
- No AUP text retrieved. The AWS AUP fetch failed. SES *enforcement* thresholds are index-reported from AWS's own knowledge center: account sending pause triggers include **bounce rate ≥ 10%**, **complaint rate ≥ 0.5%**, repeated reviews for the same issue, and "emails that violate AWS Service Terms." — [AWS: Resolve SES account review/pause](https://www.repost.aws/knowledge-center/ses-resolve-account-review-pause); [SES Sending review process FAQs](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/faqs-enforcement.html) — INDEX-REPORTED
- SES review-response guidance is index-reported as: stop sending if you can, then reply in AWS Support Center with root cause, changes made, and how they prevent recurrence. — [SES faqs-enforcement](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/faqs-enforcement.html) — INDEX-REPORTED
- "The results don't cover AWS's own stance on cold outreach." — WebSearch result set, 2026-10-13
- **Determination: UNRESOLVED on cold outbound. SES is widely understood to be the most permissive major ESP in practice (it polices metrics rather than list provenance), but I have no policy text to support that and will not assert it.**

**Mailjet, SparkPost (Bird), Scaleway TEM, Zoho ZeptoMail, MailerSend**
- **Mailjet, SparkPost/Bird, MailerSend: no cold-email or prohibited-use policy found at all.** "The results contain pricing and feature details but no cold-email or prohibited-use policy for any of them." — WebSearch result set, 2026-10-13 — UNCONFIRMED
- ZeptoMail: a single comparison table describes it as "transactional-only by policy," with Zoho Campaigns as the marketing product. Policy text not found. A Zoho community thread titled "Cold emails not allowed?" exists but was not retrieved. — [help.zoho.com community thread](https://help.zoho.com/portal/es/community/topic/cold-emails-not-allowed) — SECONDARY / UNCONFIRMED
- Scaleway TEM: a single third-party comparison table lists marketing email as "Prohibited by policy — TEM is transactional only." Could not be verified against Scaleway documentation. — WebSearch result set, 2026-10-13 — SECONDARY / UNCONFIRMED
- **Determination for all five: UNRESOLVED.**

**Google Workspace and Microsoft 365 (policy, as distinct from limits)**
- Neither Google's Workspace Acceptable Use Policy / Gmail bulk-sender guidelines nor Microsoft's Exchange Online use terms could be fetched (`support.google.com` and `learn.microsoft.com` both 403 at the proxy).
- Microsoft's own position on volume is index-reported from message centre notice MC787382: **"Exchange Online does not support bulk or high-volume transactional email,"** and the notice directs senders above its limits to **Azure Communication Services for Email**, "designed specifically for high volume email sent to recipients external to your tenant." — [MC787382 mirror, merill.net](https://mc.merill.net/message/MC787382) — INDEX-REPORTED (third-party mirror of Microsoft's notice, not Microsoft's own site)
- **Determination: Microsoft 365 is explicitly not intended as a bulk/outbound platform per its own notice. Whether low-volume consent-based outbound violates it is UNRESOLVED.**

**Dedicated cold-email infrastructure resellers (Smartlead SmartSenders, Instantly, Zapmail, Mailforge/Infraforge/Primeforge, Mailreef, Workspace reseller farms)**
- These vendors openly market for cold outbound — that is the product category. **However, I retrieved no terms-of-service text for any of them**, and specifically found nothing on Smartlead's or Instantly's ToS, and nothing on Google's Workspace *reseller* acceptable-use terms. — WebSearch result set, 2026-10-13 — UNCONFIRMED
- Architecturally important and index-reported from Smartlead's own help centre: **Smartlead does not provision Google mailboxes itself.** "Smartlead offers mailboxes from four ESPs — Google accounts from InboxAutomate, Outlook from InfraInbox, and SMTP inbox provider Mailreef." — [Smartlead help centre: SmartSenders FAQs](https://helpcenter.smartlead.ai/en/articles/256-smartsenders-faqs-and-troubleshooting-everything-you-need-to-know) — INDEX-REPORTED
- Same source: InboxAutomate Google Workspace orders are limited to **max 20 domains per order and 18 mailboxes per domain**, minimum 1 domain / 1 inbox; InboxAutomate "handles the entire setup, including DNS management, purchasing domains, adding inboxes to Smartlead, and configuring warm-up settings." — [Smartlead help centre](https://helpcenter.smartlead.ai/en/articles/255-smartsenders-step-by-step-walkthrough) — INDEX-REPORTED
- **Inference flagged as inference, not finding:** the 18-mailboxes-per-domain pattern is the classic reseller mailbox-farm shape, and the fact that the Workspace tenancy is provisioned and DNS-managed by a third party means the operator does not control the tenant that Google would suspend. No source for suspension *rates* was found.

### Inferences

- The evidence available supports only the conclusion the **prior** research pass already reached (mainstream ESP AUPs condition sending on consent and prohibit list purchase/scraping). **This pass did not advance past it**, because the discriminating detail — whether "consent" in each AUP means CASL-style implied consent or strict explicit opt-in — lives in the exact policy wording, which is precisely what could not be fetched.
- The Brevo fragment ("active, explicit, and specific opt-in") is the clearest signal that an ESP's consent standard can be *stricter than the law*. If that pattern holds across ESPs, then **being CASL-compliant does not make you AUP-compliant**, and the operator's "documented consent basis" design must record *which kind* of consent (express vs implied/conspicuously-published) per contact, because some providers will only accept the former. The system should store a consent-basis enum, not a boolean.
- Smartlead-style architecture outsources the AUP exposure to an intermediary's Workspace tenant. That reduces blast radius on the operator's own domains but means the operator has no standing with Google if the tenant is actioned, and no visibility into whether the intermediary is itself violating Google reseller terms.

### Gaps

- **Verbatim AUP/anti-spam policy text for all fourteen named providers. Not obtained for any of them.** This is the central deliverable of the assignment and it is not met.
- Postmark's actual article 1061 text and ToS — the specific verification the assignment requested.
- Whether any provider's AUP explicitly contemplates or permits documented-consent B2B prospecting (as opposed to being silent on it).
- Terms of service for Smartlead, Instantly, Zapmail, Mailforge/Infraforge/Primeforge, Mailreef.
- Google Workspace reseller acceptable-use terms, and any documented enforcement against reseller-provisioned mailbox farms.
- Mailjet, SparkPost/Bird, MailerSend, Scaleway TEM, ZeptoMail policy positions — effectively no data.

---

## Q2. Sending limits and costs

### Takeaway

Amazon SES list prices and dedicated-IP costs are the best-evidenced items in this pass (AWS's own pricing page appeared in results, though I could not read it). Google Workspace and Microsoft 365 caps are reasonably consistent across index-reported sources, with an important **date-sensitive Microsoft change landing 2026-10-01 — i.e. twelve days ago**. Cold-email reseller pricing is cheap per mailbox but every figure comes from vendor-owned comparison blogs that contradict each other.

### Cited Findings

**Amazon SES**
- Base rate consistent across sources at **$0.10 per 1,000 emails**. — [aws.amazon.com/ses/pricing](https://aws.amazon.com/ses/pricing/) via index — INDEX-REPORTED
- **Dedicated IP (Standard): $24.95 / month / IP.** **Dedicated IP (Managed): $15 / month / account plus a per-email fee of $0.08 per 1,000 emails** at 0–10M monthly volume, decreasing at higher volume. **Bring-your-own-IP: from $24.95 / month / IP with a 256-address minimum.** — [aws.amazon.com/ses/pricing](https://aws.amazon.com/ses/pricing/) via index — INDEX-REPORTED
- Multiple third-party guides report AWS introduced bundled plans (**Essentials / Pro / Enterprise**) on **2026-07-21**, with Pro adding a fixed **$105 per account per region per month**, bundling deliverability tooling including dedicated IPs at "up to 22% less" than a-la-carte, and new accounts starting on Essentials. The search summary explicitly states it **could not confirm these plan details on the AWS page.** — [dev.to guide](https://dev.to/mr_manushukla/amazon-ses-pricing-plans-in-2026-essentials-vs-pro-vs-enterprise-and-when-a-la-carte-still-wins-1ohg); [usecarly.com](https://www.usecarly.com/blog/amazon-ses-pricing/) — SECONDARY, UNCONFIRMED
- One cost-comparison site rendered dedicated IPs as "$24.95/1000 emails" — a clear unit error; that site's figures should be discarded. — [costbench.com](https://www.costbench.com/software/email-api/amazon-ses/hidden-costs/) — UNRELIABLE

**Google Workspace**
- **Per-user daily cap ~2,000**, but sources **conflict on whether this counts messages or recipients**. One index-reported framing: "Daily sending limit per user account 2,000 messages/day," with a separate **mail-merge / multi-send cap of 1,500 messages/day**, and Google counting messages and recipients separately (one email to 50 people = 1 message, 50 recipients). Another framing: "up to 2,000 recipients per day" via the Gmail interface, with roughly **2,000 external recipients** and a total recipient limit nearer **3,000** including internal addresses. — [mailreach.co (vendor)](https://www.mailreach.co/blog/google-workspace-email-sending-limits); [prospeo.io (vendor)](https://prospeo.io/s/how-many-emails-can-i-send-per-day) — CONFLICTING, SECONDARY/VENDOR
- **Trial accounts start at 500/day** until paid plus 60 days. — [mailreach.co](https://www.mailreach.co/blog/google-workspace-email-sending-limits) — SECONDARY
- **SMTP relay (distinct from the Gmail interface): 10,000 unique recipients per 24-hour period, plus a per-customer relay cap of approximately 130 × number of user licences.** — index-reported, attributed to Google — INDEX-REPORTED
- Vendor sources stress that **deliverability filtering triggers far below the published caps**, and that Google adjusts the caps periodically. — [mailreach.co](https://www.mailreach.co/blog/google-workspace-email-sending-limits) — SECONDARY

**Microsoft 365 / Exchange Online — time-critical**
- Microsoft notice MC787382 introduces an **External Recipient Rate Limit (ERRL) of 2,000 external recipients per rolling 24 hours, as a sub-limit of the existing 10,000 recipient rate limit**. Both are rolling 24-hour windows. Microsoft's example: max out the external limit and you can still send to 8,000 internal recipients in the same period. — [MC787382 mirror](https://mc.merill.net/message/MC787382) — INDEX-REPORTED (third-party mirror)
- **Rollout dates (per the 2025-06-25 revision of the notice): trial tenants and all tenants created after that date from 2026-04-01; existing tenants from 2026-10-01.** Earlier revisions of the same notice gave January 2025 and other dates, so the notice has slipped repeatedly. — [MC787382 revision history](https://mc.merill.net/message/MC787382/v/2025-06-25T19-38-39-587Z) — INDEX-REPORTED, HISTORICALLY UNSTABLE
- Does not apply to DoD, GCC or GCC High. — [MC787382](https://mc.merill.net/message/MC787382) — INDEX-REPORTED
- A university IT page lists the base figure as 10,000 recipients per 24 hours per mailbox, predating the external sub-limit. — [answers.atlassian.syr.edu](https://answers.atlassian.syr.edu/wiki/x/We2ICQ) — SECONDARY

**Cold-email infrastructure resellers (all figures vendor-blog sourced, ~Sept 2026 vintage)**
- **Mailforge:** shared-IP SMTP from **$3/mailbox/month dropping to $2 at volume, billed annually, 10-mailbox minimum**, plus **$13/domain/year** (one source says $14). Warmup is a separate product (Warmforge). — [maildeck.co](https://maildeck.co/blog/cold-email-infrastructure-cost-2026/); [mailforge.ai (vendor's own)](https://www.mailforge.ai/blog/cold-email-infrastructure-tools) — SECONDARY/VENDOR, CONFLICTING on domain fee
- **Infraforge:** dedicated servers and IPs at **~$4/mailbox slot/month falling to $3**, quarterly or yearly billing only, plus **~$14/year per .com domain**. A different comparison lists **dedicated IPs as a $99/month per-IP add-on** — a large discrepancy. — [infraforge.ai (vendor's own)](https://www.infraforge.ai/blog/zapmail-alternatives); [maildeck.co](https://maildeck.co/blog/cold-email-infrastructure-cost-2026/) — CONFLICTING, VENDOR-OWNED
- **Zapmail:** resells Google Workspace / Microsoft 365 mailboxes on tiers; **Starter ~$39/month for 10 mailboxes monthly, or $32.50 billed annually.** Higher tiers inconsistent across sources. One source notes a premium band of **$5–$8 per inbox** for an India-region tenant tier — a tenant-jurisdiction and reliability concern, not just price. — [puzzleinbox.com](https://puzzleinbox.com/blog/cold-email-provider-pricing-comparison-2026/) — SECONDARY/VENDOR
- **Mailreef:** priced per dedicated mail server, not per mailbox. One source: **Agency at $240/month on a 12-month commitment plus $0.001 per send**; another: **150 mailboxes per server**, bring-your-own domains, automatic SPF/DKIM/DMARC configuration, full API access. Enterprise is custom. Pricing is described as "inconsistent across sources." — [maildeck.co](https://maildeck.co/blog/cold-email-infrastructure-cost-2026/); [outreach2day.com](https://outreach2day.com/blog/best-cold-email-infrastructure-providers) — CONFLICTING, SECONDARY
- **Smartlead / Instantly:** no pricing captured beyond the note that Instantly sells separate subscriptions for lead-database credits, CRM, inbox-placement testing and pre-warmed accounts. — WebSearch result set — UNCONFIRMED

### Inferences

- At the stated volume (tens to low hundreds per day, so ~1,000–6,000 messages/month), **per-message cost is economically irrelevant**: SES at $0.10/1,000 puts the send cost at well under $1/month. The entire cost decision is therefore about fixed costs — dedicated IP, mailbox seats, tooling — not per-message pricing. **Do not optimise for per-message price.**
- **A dedicated IP is actively harmful at this volume.** The volume needed to warm and *sustain* a dedicated IP's reputation is far above tens-to-hundreds/day; a dedicated IP sending that little looks like a cold, low-trust IP indefinitely. A $24.95/month SES dedicated IP would buy worse deliverability than SES's shared pool. **I did not find a sourced figure for the minimum sustained daily volume to hold a dedicated IP** — commonly cited practitioner numbers are in the thousands/day but I retrieved no citable source and will not invent one. This is a gap.
- The Microsoft ERRL existing-tenant date of **2026-10-01 falls before today (2026-10-13)**, so if the June 2025 revision held, the 2,000-external-recipient/24h limit is **now live on existing tenants**. Given the notice's history of slipping, this must be checked against the current MC787382 entry in the tenant's own admin centre before any architecture depends on it.
- Google Workspace's ~2,000/day and Microsoft's 2,000-external/day both sit two orders of magnitude above the operator's stated need. **Platform caps are not a binding constraint for this project; AUP and reputation are.**

### Gaps

- Per-message pricing for Postmark, SendGrid, Mailgun, Resend, Brevo, Mailjet, SparkPost/Bird, Scaleway TEM, ZeptoMail, MailerSend — **none retrieved.** Pricing pages were not fetchable.
- Dedicated-IP cost at providers other than SES.
- **Sourced minimum volume to warm and maintain a dedicated IP.** Not found.
- The real, currently-documented Google Workspace per-user/day *external recipient* cap from Google's own help page (the assignment asked specifically for this; sources conflict and none is Google's page).
- Confirmation of SES's 2026 Essentials/Pro/Enterprise plan structure and whether it changes a-la-carte availability.

---

## Q3. Authentication requirements in practice (SPF, DKIM, DMARC alignment, BIMI, return-path, tracking domain, PTR)

### Takeaway

The alignment mechanics are the one technical area where I obtained a clear, useful explanation: **DMARC needs only one aligned pass, and because most sending platforms own the Return-Path, custom DKIM signing with your own `d=` domain is the load-bearing step, not SPF.** I could not retrieve RFC 8058 or any provider's authentication setup documentation.

### Cited Findings

- **SPF alignment** compares the **Return-Path (envelope sender) domain** to the visible **From** domain. Index-reported quote from a practitioner guide: "Many cold email platforms use their own domain for the Return-Path to handle bounces on their infrastructure. When they do, SPF passes for their domain but fails alignment with your From domain." — [Octave: The GTM Engineer's Guide to DMARC](https://www.octavehq.com/post/gtm-engineers-guide-to-dmarc) — SECONDARY (vendor blog, but the mechanism described is standard and consistent with the DMARC spec)
- **DKIM alignment** depends on the signing `d=` domain: "If your cold email platform signs with `d=try-acme.com` (custom DKIM), alignment succeeds. If it signs with `d=platformdomain.com` (default signing), alignment fails." Since **DMARC requires only one aligned pass, custom DKIM is the more important step.** — [Octave](https://www.octavehq.com/post/gtm-engineers-guide-to-dmarc) — SECONDARY
- **Subdomain policy:** DMARC policy does not automatically extend as intended to subdomains — "Your DMARC policy doesn't always stop at your primary domain" — and subdomains often need their own record or an explicit `sp=` subdomain policy tag. — [Valimail](https://www.valimail.com/blog/dmarc-policies-applied-subdomains/) — SECONDARY (Valimail is a DMARC vendor but is a recognised authority on the spec)
- **Rollout order practitioners recommend:** enumerate every sending service; configure SPF and DKIM for each; publish DMARC with reporting (`p=none` + `rua`); tighten policy and move SPF to hard-fail **only after DMARC aggregate reports confirm all legitimate mail passes**. — [Folderly](https://generate.folderly.com/what-is-dmarc-for-cold-email); [Unify](https://www.unifygtm.com/explore/cold-email-domain-infrastructure-setup) — SECONDARY, VENDOR-OWNED
- **Microsoft's bulk-sender requirement (consumer Outlook.com), effective 2025-05-05:** senders must pass SPF and DKIM, publish DMARC at **minimum `p=none`**, and achieve **DMARC alignment via SPF or DKIM**. — [dmarcreport.com](https://dmarcreport.com/blog/microsoft-outlook-dmarc-requirements-may-2025/); [emailoctopus.com](https://emailoctopus.com/blog/outlooks-new-requirements-for-highvolume-senders) — SECONDARY (Microsoft's own post not fetchable)
- **Source quality warning:** one vendor guide (Unify) asserts inbox placement "consistently exceeds 90%" with correct records — an unsourced vendor claim — and its sample DNS record "places a DMARC-style value at a DKIM host," i.e. **the example is wrong**. Do not copy vendor DNS examples. — WebSearch result set, 2026-10-13 — flagged

### Inferences

- **Minimum viable pre-first-send authentication set, derived from the above:** SPF record on the sending domain including the provider; **provider-specific custom DKIM with `d=` on your own sending domain** (non-negotiable — default platform signing breaks alignment); DMARC record on the sending domain (and an `sp=` on the parent if the parent has a policy) starting at `p=none` with `rua=` reporting; **custom return-path / bounce domain** so SPF also aligns; **custom tracking domain** so click/open links are on your domain rather than the provider's shared one (important both for alignment-adjacent trust and so a provider's shared tracking domain being blocklisted doesn't take your mail with it); valid **PTR / reverse DNS** matching the HELO name — but note PTR is controlled by whoever owns the sending IP, so it is only actionable in the self-hosted or dedicated-IP cases and is *not* something you configure on a shared-pool ESP.
- **BIMI is not relevant to this project.** BIMI requires DMARC at enforcement (`p=quarantine` or `p=reject`) plus a Verified Mark Certificate, which carries a four-figure annual cost and a registered trademark prerequisite. **I found no source on BIMI in this pass** — this is a gap, not a finding — but on the volumes described, the cost/benefit is implausible.
- **Programmatic alignment verification from Node with no paid dependency** — no source found, so this is engineering inference only: Node's built-in `dns` module (`dns.promises.resolveTxt`) can read the SPF record at the domain apex, the DMARC record at `_dmarc.<domain>`, and a DKIM public key at `<selector>._domainkey.<domain>`, with zero external dependencies. That verifies *publication*. Verifying actual *alignment* requires inspecting a delivered message's headers: send a seed message to a mailbox you control, then parse `Authentication-Results` for `spf=pass` / `dkim=pass` and compare the `header.d=` value and the envelope-from domain against the From domain. Reading those headers needs IMAP access to the seed mailbox. **`node:dns` + a raw IMAP client written against `node:tls` is achievable with no dependencies, but this is my design inference, not a sourced finding.** The authoritative check available for free and at scale is the **DMARC aggregate report (`rua=`) XML feed**, which reports per-source SPF/DKIM alignment results directly — that is the right programmatic signal, and parsing gzipped XML is in Node's stdlib (`node:zlib`).

### Gaps

- **RFC 8058 itself could not be retrieved** (both rfc-editor.org and datatracker.ietf.org blocked). See Q4.
- No provider's own authentication-setup documentation was retrievable, so I cannot state which providers support custom DKIM `d=`, custom return-path, and custom tracking domains, or at which price tier. **This is a material gap: for several providers, custom return-path/tracking domains are paid-tier features, and that determines whether DMARC alignment is even achievable on their cheap plans.**
- BIMI requirements and cost — no source obtained.
- Whether PTR is configurable on any of the shortlisted shared-pool providers (presumptively no, but unsourced).
- No source found for how to verify alignment programmatically; the approach above is inference.

---

## Q4. One-click unsubscribe (RFC 8058) and bulk-sender thresholds

### Takeaway

The Google/Yahoo 5,000-messages-per-day bulk-sender threshold and the 0.3% spam-rate ceiling are consistently reported, and **the operator's stated volume sits two orders of magnitude below the bulk threshold** — so the formal bulk-sender requirements are not triggered, though the spam-rate ceiling and the practical expectation of a working unsubscribe still bite. **RFC 8058's actual normative text could not be retrieved**, so the header syntax is not documented here.

### Cited Findings

- **Google's bulk-sender definition: more than 5,000 messages to Gmail addresses in a day.** — [customer.io](https://customer.io/blog/email-sending-requirements-gmail-yahoo); [ebq.com](https://ebq.com/gmail-bulk-sending-requirements-2024/) — SECONDARY (Google's own postmaster page not fetchable)
- **Yahoo has not published a comparable daily number**: index-reported — "Yahoo has similar requirements but have not provided the number (e.g., 5000/day) of emails that it deems as 'bulk.'" — [ebq.com](https://ebq.com/gmail-bulk-sending-requirements-2024/) — SECONDARY
- **Spam-rate ceiling: 0.3%** at both Google and Yahoo, measured for Google in **Postmaster Tools**. — [customer.io](https://customer.io/learn/deliverability/email-sending-requirements-gmail-yahoo); [bounteous.com](https://www.bounteous.com/insights/2024/01/31/2024-gmail-and-yahoo-deliverability-changes/) — SECONDARY
- **CONFLICT on scope:** a Resend knowledge-base article is index-reported to say Yahoo's 0.3% applies to **all** senders, not only bulk senders, and that Yahoo calculates the rate **against mail delivered to the inbox rather than total mail sent**, with **no fixed measurement window**. Other sources treat 0.3% as a bulk-sender-only threshold. — [Resend KB](https://resend.com/docs/knowledge-base/how-do-i-avoid-yahoos-spam-folder.md) vs. [customer.io](https://customer.io/blog/email-sending-requirements-gmail-yahoo) — CONFLICTING
- **Practitioner target is stricter than the ceiling:** "while the threshold set by ISPs is 0.3%, it's safe to maintain the spam rate not more than 0.1%." — [usebouncer.com](https://www.usebouncer.com/?p=53939) — SECONDARY
- **One-click unsubscribe:** bulk senders must include a one-click option and **process requests within two days**; implementation must follow **RFC 8058**. — [customer.io](https://customer.io/blog/email-sending-requirements-gmail-yahoo); [clevertap.com](https://clevertap.com/blog/acing-email-deliverability-in-2024-guide-to-yahoo-and-gmails-latest-email-security-updates/) — SECONDARY
- One source notes the one-click header is **not itself a legal requirement**, so a web-link unsubscribe in the footer remains acceptable for legal purposes — but that is separate from the mailbox providers' technical requirement. — WebSearch result set, 2026-10-13 — SECONDARY
- **Microsoft (consumer Outlook.com), announced 2025-04-02, enforcement from 2025-05-05, applying to domains sending more than 5,000 emails/day:** requires SPF, DKIM, DMARC at `p=none` minimum, and alignment. A **functional unsubscribe is "recommended," and RFC 8058 one-click is NOT mandated** in Microsoft's guidance. These rules cover **consumer Outlook.com addresses and do not cover Microsoft 365 / Exchange Online enterprise recipients.** — [buzzstream.com](https://buzzstream.com/blog/microsoft-email-requirements/); [dmarcreport.com](https://dmarcreport.com/blog/microsoft-outlook-dmarc-requirements-may-2025/); [egressif.io](https://egressif.io/resources/sender-requirements/microsoft) — SECONDARY
- **CONFLICT on Microsoft consequences:** sources disagree whether non-compliant mail is rejected with **550 5.7.515** or routed to Junk first with rejection "to be announced." One source notes **Microsoft's own published post contradicts itself** on this point between paragraphs. — WebSearch result set, 2026-10-13 — CONFLICTING, and the conflict originates in Microsoft's own post

### Inferences

- At tens-to-low-hundreds/day the operator is **not a bulk sender** under Google's or Microsoft's stated thresholds and the formal RFC 8058 requirement is not triggered. **It should nonetheless be implemented anyway**, for three reasons: it is the cheapest possible insurance against a complaint-rate problem; a recipient who can unsubscribe in one click does not press "report spam"; and crossing 5,000/day later should not require a re-architecture.
- The **0.3% ceiling is the real binding constraint and it is brutal at low volume.** At 100 messages/day, 0.3% is well under one complaint per day — but complaint rates are computed over a window, and a handful of complaints in a small denominator produces a catastrophic percentage. **Low volume does not protect you from the spam-rate threshold; it makes each individual complaint far more expensive.** This argues strongly for tight targeting and genuine relevance over volume, and for the Brevo-style stricter consent standard regardless of which provider is chosen.
- Microsoft's enterprise/consumer split matters here: the operator's targets are **institutions and SMBs**, i.e. mostly Microsoft 365 / Exchange Online and Google Workspace *enterprise* recipients, not consumer Outlook.com or Gmail. The much-publicised Google/Yahoo/Microsoft bulk-sender rules are therefore **less directly applicable to this project's actual recipient mix than they appear**, while corporate filtering (Defender for Office 365, Mimecast, Proofpoint) — about which this pass found nothing — is more applicable.

### Gaps

- **RFC 8058 normative text, the exact `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` header syntax, and the POST-handling requirements. NOT RETRIEVED** — both rfc-editor.org and datatracker.ietf.org returned 403 at the proxy and ENOTFOUND via WebFetch. The assignment asked for this directly and it is unmet.
- Google's and Yahoo's own postmaster pages, with dates, as the assignment requested. Only secondary summaries obtained.
- Consequences of exceeding the spam rate, as stated by the providers themselves.
- Whether Google counts the 5,000/day threshold per sending domain or per sending IP.
- Nothing at all on corporate filter gateways (Defender, Mimecast, Proofpoint, Barracuda), which are the actual gatekeepers for the institutional targets described.

---

## Q5. Bounce and complaint handling, FBL / ARF data

### Takeaway

Only Amazon SES's mechanism is documented here, and only via index-reported fragments. **Whether complaint (ARF) feedback is obtainable at low volume — the specific question asked — is unresolved**, and this matters because most ISP feedback loops are volume-gated.

### Cited Findings

**Amazon SES**
- Two setup routes: a **per-identity notification** method for a single email identity or domain, and a **configuration-set** method for accounts with many identities that also want other event types. — [AWS Messaging Blog: Set up notifications for bounces and complaints](https://aws.amazon.com/blogs/messaging-and-targeting/amazon-ses-set-up-notifications-for-bounces-and-complaints) — INDEX-REPORTED
- **Event destinations: CloudWatch, Kinesis Firehose, or SNS** — "you must provide one, and only one, destination when you create or update" an event destination. v2 docs add that event data can go to **Amazon SNS** to receive bounce and complaint notifications. — [SES API: EventDestination](https://docs.aws.amazon.com/ses/latest/APIReference/API_EventDestination.html); [SES API v2: EventDestination](https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_EventDestination.html) — INDEX-REPORTED
- **Classification data available, per AWS's own definitions:** a **bounce** is "a hard bounce where the recipient's mail server permanently rejected the email," with **soft bounces included only when SES fails to deliver after retrying for a period of time**; a **complaint** is "an email that was delivered to the recipient's mail server, but the recipient marked it as spam." — [SES API v2 docs](https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_EventDestination.html) — INDEX-REPORTED
- **Email Feedback Forwarding** (bounce messages forwarded to the sender by email) can be set to Disabled under an identity's Notifications settings — third-party guide, not AWS. — [bigmailer.io docs](https://docs.bigmailer.io/docs/suspensions-account-or-ses) — SECONDARY
- AWS's own framing: bounces and complaints "can have serious consequences for your email deliverability and can even lead to your email account being suspended or blocked." — [AWS Messaging Blog](https://aws.amazon.com/blogs/messaging-and-targeting/amazon-ses-set-up-notifications-for-bounces-and-complaints) — INDEX-REPORTED

**Postmark**
- Index-reported: spam complaints are treated as "a clear metric to determine abuse and poor sending practices"; a complained-about address is **deactivated and cannot be reactivated by the sender**. — [Postmark: What are bounces and spam complaints?](https://postmarkapp.com/support/article/what-are-bounces-and-spam-complaints) — INDEX-REPORTED

**All other providers**
- **No bounce/complaint/FBL documentation retrieved for SendGrid, Mailgun, Resend, Brevo, Mailjet, SparkPost/Bird, Scaleway TEM, ZeptoMail, MailerSend, Google Workspace, or Microsoft 365.** — UNCONFIRMED

### Inferences

- SES's model is the one the operator's Node + SQLite architecture can consume cleanly: **SNS → HTTPS webhook → a local endpoint that writes to SQLite**, with no paid dependency and no polling. The alternative shapes (parsing SMTP 5xx responses from a self-hosted MTA; polling an IMAP bounce mailbox) are both strictly worse — SMTP responses give you rejections but not complaints at all, and IMAP bounce-parsing is heuristic and fragile.
- **The complaint signal is only obtainable from the sending platform, not from the recipient's provider directly**, for a sender of this size. ISP feedback loops generally require registration and meaningful volume; a sender doing tens-to-hundreds/day across five brands will not qualify for most of them. **This is the strongest practical argument against self-hosting:** a self-hosted MTA gives you bounces but leaves you effectively blind to complaints, which is exactly the metric that determines survival under the 0.3% ceiling. An ESP aggregates FBL/ARF data across its whole customer base and surfaces your share of it — that aggregation is the main thing you are buying at low volume.
- SES's definition of "bounce" as hard-only by default means the operator must explicitly consume the `Delivery`, `DeliveryDelay` and `Reject` event types too, or soft-failure signal will be silently lost from the consent/suppression ledger.

### Gaps

- **Whether ARF/complaint feedback is available at low volume** — the specific question. No source found. Not answered.
- Webhook vs SMTP-response vs IMAP comparison per provider — only SES documented.
- Whether SES complaint notifications include the ARF report body or only a summarised JSON event. **This is operationally important** (ARF gives you the reporting ISP and sometimes the original message) and is unresolved.
- Bounce/complaint classification taxonomies for every provider other than SES.
- Google Postmaster Tools API availability and whether it reports anything useful below the bulk-sender threshold.

---

## Q6. Architecture comparison: OAuth mailboxes vs ESP API vs self-hosted MTA vs bought infrastructure

### Takeaway

The sourced evidence supports only one firm conclusion: **(c) self-hosted MTA is not realistic for this operator**, on reputation grounds more than port-25 grounds. The choice between (a), (b) and (d) turns on AUP wording that this pass could not retrieve, so the ranking below is explicitly reasoning from partial evidence, not a sourced finding.

### Cited Findings

**(c) Self-hosted MTA — port 25 and IP reputation**
- Port 25 is blocked by many hosts because it is "unauthenticated by design" and a compromised host with open outbound 25 "can spray mail directly at the world's mail servers." — [findstack.com](https://findstack.com/resources/port-25-blocked-vps) — SECONDARY
- Provider-by-provider, index-reported from a community table: **Vultr and DigitalOcean block by default but will unblock on a support request; Hetzner blocks with unblocking possible after a limit request; Linode and several budget hosts are open by default; AWS and Google Cloud block it and make unblocking difficult or impossible.** A second source states **Hetzner and OVH leave port 25 open** — **these sources conflict on Hetzner.** — [awesome-mail-server-providers (GitHub)](https://github.com/forwardemail/awesome-mail-server-providers); [prospeo.io](https://prospeo.io/s/vps-email-server) — CONFLICTING, SECONDARY
- Tilaa states: "outgoing traffic on port 25 (SMTP) is temporarily blocked for all newly deployed servers," lifted a few hours after activation. — [Tilaa support](https://support.tilaa.com/hc/en-us/articles/228650067-SMTP-Services-Port-25-Restrictions) — INDEX-REPORTED (provider's own page)
- **Port 587 being open is irrelevant to the problem:** "submission only covers mail clients sending through your server; it has nothing to do with how your mail server sends mail to other mail servers. That will still require port 25." — [findstack.com](https://findstack.com/resources/port-25-blocked-vps) — SECONDARY
- **Reputation is the larger obstacle:** "even with 25 open, a fresh VPS IP starts with no sending reputation, in an address range that receiving mail servers already associate with bulk traffic." The standard workaround that even self-hosting guides recommend is to **use an external SMTP relay (SendGrid, Mailgun, AWS SES) as a smarthost** — "your server handles everything except final delivery." — [findstack.com](https://findstack.com/resources/port-25-blocked-vps); [ssdnodes.com](https://www.ssdnodes.com/learn/send-mail-from-self-hosted-apps) — SECONDARY

**(a) Customer-OAuth mailboxes**
- Smartlead's architecture is **not** customer-OAuth-into-your-own-tenant; it **resells third-party-provisioned mailboxes** — Google via InboxAutomate, Outlook via InfraInbox, SMTP via Mailreef — with the third party doing "DNS management, purchasing domains, adding inboxes to Smartlead, and configuring warm-up settings." — [Smartlead help centre](https://helpcenter.smartlead.ai/en/articles/256-smartsenders-faqs-and-troubleshooting-everything-you-need-to-know) — INDEX-REPORTED
- Microsoft's own position, index-reported: **"Exchange Online does not support bulk or high-volume transactional email,"** pointing high-volume senders to Azure Communication Services for Email. — [MC787382 mirror](https://mc.merill.net/message/MC787382) — INDEX-REPORTED

**(d) Bought cold-email mailbox infrastructure**
- Pricing and shape as in Q2. A third-party review notes "account bans are a core problem Smartlead targets" but gives no policy detail. A Clay community thread asks whether Google Workspace is still recommended for cold email at all — an unverified user question, not a policy source. — [bouncezero.io](https://bouncezero.io/blog/smartlead-review-2026); [community.clay.com](https://community.clay.com/x/general/8jdw42wo267j/seeking-advice-on-cold-email-tools-and-google-work) — SECONDARY / UNRELIABLE

**(b) Transactional ESP API**
- Enforcement exposure as in Q1/Q5: SES pauses at bounce ≥10% or complaint ≥0.5%; Postmark permanently deactivates complained-about addresses. — INDEX-REPORTED, sources above

### Inferences

All four assessments below are **inference from partial evidence**, not sourced findings.

**(c) Self-hosted MTA on a VPS — rejected.** AUP risk is low (you are your own AUP, subject only to the VPS host's terms). Everything else is bad. Deliverability starts at effectively zero: a fresh VPS IP in a range receivers already distrust, with no sending history, is the worst possible starting position, and at tens-to-hundreds/day you will never accumulate enough volume to build reputation faster than it decays. Cost is low in dollars (~$5–20/month) and ruinous in hours. Operational burden is the highest of the four: Postfix/Haraka/OpenSMTPD configuration, TLS, DKIM signing, queue management, bounce parsing, blocklist monitoring and delisting, PTR coordination with the host, and ongoing patching. Blast radius is contained to one IP and whatever domains you point at it. **Critically, per Q5: you get bounces but you are blind to complaints**, which is the metric that matters. Even self-hosting guides recommend relaying through an ESP for final delivery, which collapses this option into (b) with extra steps.

**(d) Bought cold-email mailbox infrastructure — rejected for this operator.** Cost is genuinely low ($3–4/mailbox/month plus ~$13–14/domain/year). Deliverability is the vendors' entire pitch and is unverifiable from here. But the AUP risk is the worst of the four and it is *structural*: the Workspace/M365 tenancy is provisioned and DNS-managed by a third party, so the operator has **no standing with Google or Microsoft** if that tenant is actioned, and no visibility into whether the intermediary is violating reseller terms. The 18-mailboxes-per-domain pattern is the shape Google's abuse systems are built to detect. And the model only makes sense at volumes that need mailbox rotation — **at tens-to-hundreds/day across five brands, inbox rotation solves a problem the operator does not have.** It buys the risk profile of a bulk sender to get capacity that is not needed.

**(a) Customer-OAuth mailboxes (Gmail/Microsoft) — viable, and the lowest-exposure option for the first phase.** AUP risk is moderate and knowable: you are sending from your own Workspace/M365 tenant under your own agreement, within caps (~2,000/day Google; 2,000 external/24h Microsoft) that exceed the need by 20×. Deliverability is the best available for a sender this size, because you are riding the reputation of Google's or Microsoft's own outbound infrastructure and sending human-shaped volumes from real, replied-to mailboxes. Cost is the Workspace/M365 seats the operator plausibly already pays for, plus nothing. Operational burden is low for sending and moderate for instrumentation — **this is the option's real weakness: Gmail API and Graph give you very poor bounce and effectively no complaint data compared with an ESP's webhooks** (see Q5 gaps). Blast radius is the worst feature: mail sends from the primary business domain's tenant, so a reputation problem lands on the domain that carries client email. Mitigate with a dedicated sending subdomain and separate mailboxes per brand, not by sending from the apex.

**(b) Transactional ESP API — viable, and the right destination once AUP wording is verified.** AUP risk is the **central unresolved question** and the one thing that could make this option unavailable; on the Brevo fragment, an ESP's consent standard may exceed CASL's. Deliverability on a shared pool is good and, at this volume, better than any dedicated IP the operator could warm. Cost is trivial (<$1/month in send fees at SES rates). Operational burden is low and the **instrumentation is the best of the four** — SNS/webhook events into SQLite, with real complaint data. Blast radius is well-contained if and only if you use a dedicated sending subdomain, custom DKIM `d=`, custom return-path and custom tracking domain; the residual shared risk is the provider's IP pool reputation, which you do not control.

**Which puts a primary business domain at risk:** (a) does, directly and by design, because the sending tenant *is* the business tenant. (b) does only if you send from the apex or skip the custom subdomain/return-path/tracking separation. (d) protects the primary domain by sacrificing lookalike domains instead — but see Q7 on what that costs. (c) is irrelevant since it is rejected.

### Gaps

- **The AUP determination that decides between (a), (b) and (d).** Unresolved — see Q1.
- No sourced comparison of any of these four architectures; the entire comparison above is my inference.
- Gmail API and Microsoft Graph bounce/complaint instrumentation capability — no source found, and this is the deciding operational weakness I assign to option (a).
- Google Workspace reseller terms, which determine whether (d) is a terms violation per se.
- No evidence on actual suspension rates for any architecture.

---

## Q7. Domain strategy: primary vs sending subdomain vs lookalike

### Takeaway

Practitioner consensus in the retrieved sources favours a **dedicated sending subdomain** for reputation isolation, with the explicit caveat that isolation is partial. **I found no source at all on lookalike domains' cost in trust or DMARC alignment** — that part of the question is unanswered.

### Cited Findings

- Index-reported summary of practitioner opinion: "the consensus favours a subdomain for cold outreach, mainly for reputation isolation, control, and safer testing." — [Suped: should I send from a primary domain or a subdomain](https://www.suped.com/email-deliverability/answers/should-i-send-email-from-a-clients-primary-domain-or-a-subdomain) — SECONDARY (deliverability-practitioner Q&A site, vendor-adjacent)
- **The isolation is partial:** "Using a subdomain for cold outreach can isolate reputation issues, preventing them from affecting the main domain. Subdomains are still linked to the main domain, so a negative reputation in one can impact the other." — [Suped](https://www.suped.com/email-deliverability/answers/what-are-the-pros-and-cons-of-using-the-same-domain-or-subdomain-for-both-cold-outreach-and-regu) — SECONDARY
- Same source flags that **shared IPs can harm reputation** and suggests separate IPs for cold outreach versus regular mail where possible. — [Suped](https://www.suped.com/email-deliverability/answers/what-are-the-pros-and-cons-of-using-the-same-domain-or-subdomain-for-both-cold-outreach-and-regu) — SECONDARY (note: this conflicts with my Q2 inference that a dedicated IP is harmful at low volume; the Suped advice appears to assume meaningful volume)
- **Subdomains need their own DMARC handling:** "Your DMARC policy doesn't always stop at your primary domain" — subdomains often need their own record or an explicit `sp=` tag. — [Valimail](https://www.valimail.com/blog/dmarc-policies-applied-subdomains/) — SECONDARY

### Inferences

- **Recommended: a dedicated sending subdomain per brand** (e.g. `outreach.brand.tld` or `mail.brand.tld`), with its own SPF, custom DKIM selector, and its own DMARC record; plus an explicit `sp=` policy on each parent so that an unconfigured subdomain does not inherit an unintended policy. This preserves full DMARC alignment with the visible From domain — the recipient sees a real, verifiable brand domain — while keeping the reputation of transactional/client mail on the apex separate.
- **Lookalike domains (e.g. `brand-outreach.com`, `getbrand.io`) are the standard cold-email-industry practice and I recommend against them here**, as inference: they are the pattern bought-infrastructure vendors sell, they provide genuine blast-radius isolation, and they sacrifice precisely the asset this operator has. DMARC alignment is *technically* fine on a lookalike — you own it, you can align SPF and DKIM to it — so the cost is **not** alignment. The cost is trust and verifiability: a recipient at an Ontario college receiving outreach from `edvisingu-outreach.com` cannot verify it against the organisation they might look up, newly-registered domains carry independent spam signal, and for an operator whose entire value proposition in education consulting and institutional work is institutional credibility, sending from a domain that looks like a spoof of itself is self-defeating. It also fragments the brand asset across five brands' worth of throwaway domains. **This reasoning is mine; I found no source for it.**
- The operator's existing setup (domains on Porkbun with DNS control, one on Cloudflare) is sufficient for the subdomain strategy — subdomain TXT/CNAME records are straightforward on both. **Cloudflare note (inference):** ensure DKIM/tracking CNAMEs are set to DNS-only, not proxied, or the records will not resolve as the provider expects.

### Gaps

- **No source found on lookalike domains' cost in trust or in DMARC alignment** — the specific question asked. The assessment above is unsourced inference.
- No source on domain age / newly-registered-domain penalties.
- No practitioner source on whether to use one subdomain across brands or one per brand.
- The Suped recommendation of separate IPs conflicts with the low-volume dedicated-IP reasoning in Q2 and I could not resolve it.

---

## Q8. Self-hosted MTA reality check

### Takeaway

**Not realistic for this operator, and the port-25 question is the less important half of why.** Covered in detail under Q6(c); findings are consolidated there to avoid duplication.

### Cited Findings

See Q6 "(c) Self-hosted MTA — port 25 and IP reputation" for all sourced findings: the per-host port-25 table (with the Hetzner conflict), Tilaa's temporary-block policy, the port-587 red herring, the fresh-IP reputation problem, and the fact that self-hosting guides themselves recommend relaying through an ESP smarthost.

### Inferences

- **Port 25 is obtainable** — Vultr/DigitalOcean unblock on request, Linode and budget hosts are open by default — so availability is not the blocker. The blocker is that a fresh VPS IP has no reputation in a range receivers distrust, and at tens-to-hundreds/day there is no path to building one.
- **What it would take to get off initial blocklists:** I found no source on this. Reasoning only: PTR matching HELO, valid SPF/DKIM/DMARC, TLS, a working abuse@ and postmaster@, no open relay, plus delisting requests at Spamhaus/SORBS/Barracuda and others and manual reputation-building at Microsoft (SNDS/JMRP) and Google. The commonly-reported reality is that some consumer-ISP and corporate blocklists treat VPS ranges as categorically suspect regardless of configuration. **No citable source obtained; do not treat as a finding.**
- **The decisive argument is not deliverability but blindness:** per Q5, a self-hosted MTA gives bounces and no complaint feedback. Operating under a 0.3% spam-rate ceiling with no complaint telemetry is not a viable position.
- Specific software choice (Postfix vs Haraka vs OpenSMTPD) is moot given the above. If a self-hosted component were ever wanted, the defensible shape is **a local MTA or direct API client that relays through an ESP as smarthost** — keeping local control of queueing, consent checks and logging while buying delivery reputation. That is option (b) with a local queue in front, and it is compatible with the Node + SQLite + zero-dependency constraint.

### Gaps

- No source on what it actually takes to get a fresh VPS IP off initial blocklists, or how long it takes.
- No source on realistic time-to-good-reputation for a self-hosted IP at low volume.
- Current, authoritative per-host port-25 policies (the community table conflicts with another source on Hetzner, and the GitHub table's last-updated date is unknown).
- Nothing on Postfix vs Haraka vs OpenSMTPD for this use case.

---

## Q9. Recommended architecture, provider shortlist, cost, risk, and pre-first-send checklist

### Takeaway

**I am not able to deliver the ranked, AUP-risk-annotated provider shortlist this assignment asked for, because the AUP evidence it must rest on could not be retrieved.** What follows is a defensible *provisional* architecture plus the verification work that must happen before any provider is selected or anything is sent. Treating the ordering below as a procurement decision would be exactly the error the assignment warned against.

### Cited Findings

No new findings in this section; it synthesises the above.

### Inferences

**Provisional recommended architecture (inference, pending AUP verification)**

Phase 1 — **(a) send from the operator's own Google Workspace / Microsoft 365 tenant**, via API (Gmail API or Graph), from a dedicated sending subdomain per brand, at tens/day with hand-qualified targets. Rationale: no third-party AUP exposure beyond the Workspace/M365 agreement the operator already holds; caps exceed need by ~20×; best available deliverability for a sender this size; zero marginal cost. Accept the weak bounce/complaint telemetry as a known Phase-1 limitation and compensate with a hard per-day cap, per-contact consent-basis gating, and manual review of every reply and non-delivery. Keep the Node + SQLite system as the queue, consent ledger and suppression list, with sending as a thin adapter.

Phase 2 — **migrate to (b) a transactional ESP API** once (i) the chosen provider's AUP has been read and confirmed to permit documented-consent B2B outbound, and (ii) volume justifies real complaint telemetry. Keep the same subdomains, add custom DKIM `d=`, custom return-path and custom tracking domain, and consume bounce/complaint webhooks into SQLite.

Reject **(c) self-hosted** (no complaint telemetry, no reputation path) and **(d) bought mailbox infrastructure** (structural AUP exposure through a third party's tenant, solves a volume problem the operator does not have, and sacrifices the institutional credibility that is the operator's actual asset).

**Provider shortlist — PROVISIONAL, ORDERING NOT EVIDENCE-BASED**

1. **Own Workspace / M365 tenant** (Phase 1). AUP risk: **moderate, knowable** — Microsoft's own notice says Exchange Online "does not support bulk or high-volume transactional email," so stay demonstrably non-bulk; Google's Workspace AUP was not retrievable. Cost: existing seats, ~CAD $0 marginal.
2. **Amazon SES.** AUP risk: **UNRESOLVED** — no policy text retrieved; enforcement is metric-based (pause at bounce ≥10%, complaint ≥0.5%) rather than list-provenance-based, which is *why* it is widely used for this, but I have no policy support for that and will not assert it is permitted. Cost at 3,000 msgs/month: **<$1/month in send fees**; no dedicated IP (actively counterproductive at this volume). Note the unconfirmed 2026 Essentials/Pro/Enterprise plan change.
3. **Mailgun.** AUP risk: **AMBIGUOUS** — sources conflict between "third-party lists prohibited" and "high-volume cold email restricted." Worth reading precisely because one reading might permit low-volume documented-consent sending. Cost: not retrieved.
4. **Resend.** AUP risk: **AMBIGUOUS / CONFLICTING.** Cost: not retrieved.
5. **MailerSend, Mailjet, SparkPost/Bird, Scaleway TEM.** AUP risk: **NO DATA.** Cost: not retrieved.
6. **Brevo.** AUP risk: **likely PROHIBITIVE** — index-reported "active, explicit, and specific opt-in" would exclude CASL implied consent.
7. **Postmark.** AUP risk: **likely PROHIBITED** (secondary sources only, unverified). Also permanently deactivates complained-about addresses with no sender reactivation.
8. **SendGrid/Twilio.** AUP risk: **likely PROHIBITED** for scraped lists; unresolved for documented consent.
9. **Smartlead / Instantly / Zapmail / Mailforge / Infraforge / Primeforge / Mailreef.** **Not recommended** for this operator — structural AUP exposure, no terms retrieved for any of them, and the wrong tool for the volume. Cost if ever used: ~$3–4/mailbox/month + ~$13–14/domain/year, or ~$32.50–39/month for 10 Zapmail mailboxes, or ~$240/month for a Mailreef Agency server.

**Approximate monthly cost of the recommended path:** Phase 1 ≈ **$0 marginal** (existing Workspace/M365 seats; domains already owned; DNS free at Porkbun/Cloudflare). Phase 2 ≈ **under $5/month** all-in at the stated volume on SES list pricing, excluding any bundled-plan fee if the unconfirmed 2026 plan structure forces one (**Pro would add ~$105/account/region/month — UNCONFIRMED, and if true it materially changes SES's position in this shortlist**).

**Ordered pre-first-send checklist**

Blocking — must complete before any provider is selected:
1. **Re-run the AUP retrieval from an environment with unrestricted HTTPS egress** (or read the pages by hand). Required: Postmark article 1061 + ToS; AWS AUP and Service Terms; Mailgun AUP; Resend AUP; Twilio AUP; Brevo anti-spam policy; and Google Workspace + Microsoft 365 acceptable-use terms. Capture verbatim text with retrieval dates.
2. **Retrieve RFC 8058** and record the exact `List-Unsubscribe` / `List-Unsubscribe-Post` header syntax and POST-handling requirements.
3. **Retrieve Google's and Microsoft's own postmaster/sender pages** for current thresholds with dates, rather than the secondary summaries in this document.
4. **Check MC787382 in the tenant's own admin centre** to confirm whether the 2,000-external-recipient/24h limit went live for existing tenants on 2026-10-01.
5. **Decide the consent-basis model** against whatever the verified AUPs require: store a per-contact enum (express consent / CASL implied–conspicuously published / CASL implied–existing business relationship), the source URL, the capture date, the recipient's apparent business role, the relevance rationale, and whether a no-solicitation statement was present — per the CASL documentation guidance in Q10. A boolean is insufficient.

Technical — before first send:
6. Choose one dedicated sending subdomain per brand; do not send from any apex.
7. Publish SPF on each sending subdomain including only the chosen sender.
8. Configure **custom DKIM with `d=` on the sending subdomain** (not the provider's default signing). Non-negotiable for alignment.
9. Configure **custom return-path / bounce domain** so SPF aligns.
10. Configure **custom tracking domain**, or disable open/click tracking entirely — at this volume tracking buys little and a shared provider tracking domain is a shared liability.
11. Publish DMARC on each sending subdomain at `p=none` with `rua=` reporting, and add an explicit `sp=` to each parent domain.
12. On Cloudflare, verify DKIM/tracking CNAMEs are **DNS-only, not proxied**.
13. Implement RFC 8058 one-click unsubscribe plus a footer web link, and a handler that suppresses within minutes (the stated requirement is two days).
14. Build the suppression list as the authoritative gate in SQLite — checked before every send, never bypassable, fed by unsubscribes, bounces, complaints and manual additions.
15. Wire bounce/complaint ingestion (SNS/webhook → SQLite) before the first send, not after. Consume `Bounce`, `Complaint`, `Delivery`, `DeliveryDelay` and `Reject`, since SES's default bounce definition is hard-only.
16. Register the sending domains in Google Postmaster Tools and Microsoft SNDS/JMRP.
17. Implement a hard per-day send cap in code, well under both the platform cap and the operator's stated ceiling, with a kill switch.
18. Verify alignment empirically: send seed messages to mailboxes you control on Gmail, Outlook.com and a Microsoft 365 tenant, and read `Authentication-Results` for `spf=pass`, `dkim=pass` and an aligned `header.d=`. Then confirm against the first DMARC aggregate reports.
19. Only then begin sending, at the lowest useful volume, monitoring complaint rate against a **0.1% internal target** rather than the 0.3% ceiling — because at this volume a single complaint is a large percentage.

### Gaps

- **The AUP evidence the entire shortlist ordering depends on.** This is the assignment's core deliverable and it is unmet.
- Pricing for every provider except SES.
- Whether the SES 2026 bundled plans impose a fixed monthly fee on new accounts, which would materially change the cost comparison.
- Gmail API / Graph bounce-and-complaint instrumentation capability, which is the main risk in the Phase-1 recommendation.

---

## Q10. CASL consent basis (supporting context for the consent-provenance design)

### Takeaway

CASL's "conspicuously published" implied consent is a real and usable basis for B2B outbound to Canadian recipients, but it is narrow, time-limited, relevance-gated, and the burden of proof is on the sender — and, critically, **being CASL-compliant does not make a send AUP-compliant.** All sources are secondary legal commentary; the statute itself was not retrieved.

### Cited Findings

- The B2B clause is a form of **implied consent** applying when a person **publicly displays an email address**, has **not stated they don't want solicitations**, and holds **a role relevant to the message**. Index-reported: "This form of consent is implied therefore lasts 2 years from the date you can prove the above 3 factors." **The onus of proof is on the sender.** — [electrofed.com](https://www.electrofed.com/?p=21730); [canadianelectricalwholesaler.ca](https://www.canadianelectricalwholesaler.ca/5-types-of-consent-part-4-implied-conspicuously-published/) — SECONDARY (industry-association commentary)
- **Relevance is a requirement, not a nicety:** the address is usable only when "the content of your CEM is relevant to the recipient's business, role, functions, or duties in a business or official capacity." — [canadianelectricalwholesaler.ca](https://www.canadianelectricalwholesaler.ca/5-types-of-consent-part-4-implied-conspicuously-published/) — SECONDARY
- **Not a licence to scrape:** a law-firm guide states this is "not a blanket authorization to scrape addresses from the internet," and that "a publicly available email address does not authorize unrelated mass marketing." — [substancelaw.ca](https://substancelaw.ca/casl-compliance/) — SECONDARY
- **Recommended documentation per contact:** where the address was found; when it was found; whether a no-solicitation statement appeared; the recipient's apparent business role; and why the message was relevant to that role. — [substancelaw.ca](https://substancelaw.ca/casl-compliance/) — SECONDARY
- **CASL is not switched off for business messages.** A message is not automatically exempt because it is sent to a corporate address, business-to-business, to a director or employee, via LinkedIn, or for professional purposes. Separate exclusions exist for certain messages between organisations with an established relationship, but their conditions should be reviewed before being relied on. — [substancelaw.ca](https://substancelaw.ca/casl-compliance/) — SECONDARY
- Sources cite **CASL section 10(9)** for the publication rule. — SECONDARY

### Inferences

- The documentation list above maps almost one-to-one onto the operator's intended per-contact consent-provenance schema, and should be adopted as the schema: `source_url`, `captured_at`, `no_solicitation_statement_present` (boolean), `recipient_role`, `relevance_rationale`, `consent_basis` (enum), `expires_at` (= `captured_at` + 2 years for implied/conspicuously-published).
- The **two-year expiry on implied consent means the consent ledger needs a time dimension and an automatic expiry sweep**, not a static flag. A contact legitimately mailable in 2026 is not mailable in 2029 on the same basis.
- The **relevance requirement is per-message, not per-contact**, and the operator runs five quite different brands. The same institutional contact may have valid implied consent for an education-consulting message and none for a youth-sports message. **The consent model must therefore be scoped to (contact × brand/message-type), not to contact alone.** This is the most important design consequence in this document.
- CASL covers Canadian recipients. The US (CAN-SPAM, which is opt-out and far more permissive) and UK (PECR/UK GDPR, where corporate-subscriber B2B email is treated differently from individual subscribers, and sole traders and partnerships are often treated as individuals) have materially different rules. **No sources were retrieved for either jurisdiction in this pass** — the operator targets all three, so this is a significant open gap, albeit adjacent to the assigned scope.

### Gaps

- **The CASL statute text and CRTC guidance were not retrieved**; all CASL findings here are secondary commentary. Section 10(9) should be read directly before the consent model is finalised.
- CAN-SPAM (US) and PECR / UK GDPR (UK) requirements for B2B outbound — no sources obtained, and the operator targets both markets.
- The conditions of CASL's business-to-business exclusion for organisations with an established relationship.
