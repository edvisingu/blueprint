# Compliance notes: what is settled, what is not

This records the state of our understanding so that nobody later mistakes a
research finding for a legal conclusion, or an unverified citation for a
verified one.

**This is not legal advice, and nothing here is a legality verdict.**
Qualified Canadian legal review is required before any sending.

## Sourcing caveat that applies to everything below

The research behind these notes ran in an environment whose egress gateway
denies CONNECT to general web hosts. Across six research passes, **not one
primary source page was opened**: not the CASL statute, not the regulations,
not a CRTC bulletin, not an enforcement decision, and not a single vendor
policy or pricing page. Everything reached those sources through a search
index that quotes them.

That is adequate for deciding what to build. It is **not** adequate for legal
sign-off, and no statutory wording below should be treated as verbatim.

To close this properly, the hosts need allowing in the environment's network
settings and the passes re-running — `laws-lois.justice.gc.ca`, `crtc.gc.ca`,
`fightspam.gc.ca`, `priv.gc.ca`, `canlii.org`, plus each vendor's own terms.

## What the code currently assumes

| Assumption | Status | Note |
|---|---|---|
| Consent required *before* sending; burden of proof on sender | Consistent across sources | Inverts the CAN-SPAM default |
| Express consent does not expire | Consistent | No clock in the schema |
| Implied — existing business relationship: 24 months | Reported, unverified at primary level | Enforced in code |
| Implied — inquiry or application: 6 months | Reported, unverified at primary level | Enforced in code |
| Purchased or scraped lists create no implied consent | Consistent; CompuFinder ($200,000, CRTC 2017-368) turned on it | No basis value exists for it |
| Conspicuous publication needs more than public availability | Blackstone: not established "simply by evidence that an email address has been publicly posted" | Four pieces of evidence required at import |
| B2B exemption needs an organisation-to-organisation relationship | Federal Court of Appeal (2020, CompuFinder appeal) reportedly held the relationship must be between organisations and is harder to prove than an existing business relationship | Offered as a basis but requires a relevance rationale; consider removing it from first-contact use |
| Message must identify sender, give mailing address, contact details valid 60 days | Consistent | Send refuses without them |
| Unsubscribe honoured within 10 business days | Consistent | We honour immediately |
| Private right of action suspended | Order in Council P.C. 2017-0580, 2 June 2017; still described as suspended in a September 2025 update | Status as of October 2026 unverified at primary level; does not affect the schema |

## Known-unresolved, in priority order

1. **Does an unsubscribe from one brand of a common operator bind the others?**
   No CRTC text found either way. We suppress across all five brands because it
   is the safer reading. **This is the highest-value question for counsel.**
2. **Retention period.** No CASL retention rule was located. The operative
   standard appears to be functional — retain while you will be contacting the
   person. A three-year figure appears in secondary sources and is
   practice-derived, not statute-derived. The limitation period for a notice of
   violation should set the floor and is unverified.
3. **Whether an employer-published directory entry satisfies "caused to be
   conspicuously published"** by the individual. This is the central risk in
   the basis we would most rely on for institutional contacts.
4. **PIPEDA interaction.** The business-contact-information exclusion is s. 4.01
   (an earlier draft of our notes cited this incorrectly) and is
   purpose-bound: it applies only where the information is used solely to
   communicate with the person about their business or profession. Public
   availability does not take information outside "personal information".
   PIPEDA's Regulations Specifying Publicly Available Information (SOR/2001-7)
   are directly relevant to directory collection and were not retrieved.
5. **Quebec Law 25** — not researched, likely the strictest Canadian regime.
6. **US and UK.** We target both. CAN-SPAM is opt-out and materially different;
   UK PECR treats corporate subscribers differently from sole traders, and the
   ICO advises treating ambiguous addresses as individual subscribers. Neither
   was researched in any depth.
7. **National DNCL / Unsolicited Telecommunications Rules** — would apply if
   this system ever texts or dials. It does not today.

## Design decisions taken on compliance grounds

- Consent is an append-only table with an expiry, not a boolean. A boolean
  cannot answer "how do you know?"
- Consent is scoped to (contact × brand); suppression is scoped to the whole
  organisation. Consent is narrow, withdrawal is broad.
- Every send stores the consent record it relied on, so a specific message to a
  specific recipient can be justified after the fact.
- The default for an unknown or missing basis is **not sendable**. One platform
  we studied reportedly defaults a null legal basis to subscribed; the gate
  here fails closed.
- No basis value exists for a purchased list, so it cannot be recorded even by
  a determined operator filling in a CSV.

## Security findings fixed before go-live

A security pass over the new code found three exploitable issues. All are
fixed, each with a test that reproduces the original exploit and requires it
to fail.

**1. Unauthenticated secret and database exposure. HIGH.** Static files were
served from the whole repository root, and static serving runs before the
authentication check, so an unauthenticated request could fetch
`/server/.dev-token` (a live API bearer token, which then granted full read and
write access to every endpoint) and `/server/drd.db` (the entire database:
contacts, message bodies, consent records, unsubscribe tokens). It worked in
the hardened posture too, with public mode on and a password set, because the
request never reached the auth check. Path traversal was never the hole;
normalisation held. The hole was that everything legitimately inside the root
was public. Static serving is now an allowlist of the seven files the browser
client needs, and an unknown extension is refused rather than served as
`application/octet-stream`.

**2. Stored XSS on the public unsubscribe page. MEDIUM.** A recipient's own
address was rendered back to them unescaped, and that address arrives from an
imported CSV. The email validator rejects whitespace, `@` and `;` but permits
angle brackets and quotes, so `"><script>alert(1)</script>@example.com` passes
validation and reached the page intact. Every interpolation is now escaped.

**3. Unauthenticated owner access from the local network. MEDIUM.** With no
admin password configured, every request was treated as the owning
organisation, and the listener bound every interface by default. Any peer on
the same network could read the contact graph, change suppressions and arm
sending. The fallback is now loopback-only, and the default bind is loopback
whenever there is no password and no explicit public intent.

Ruled out and worth recording so they are not re-litigated: SQL injection
(every query binds its parameters; the one concatenated `LIKE` pattern is
bound and its input is route-constrained), XSS in the browser client (every
interpolated value is escaped; the unescaped ones are numbers), path traversal
(normalisation plus an anchored prefix check), email header injection (the
encoder base64-wraps anything outside printable ASCII, which excludes CR and
LF), SSRF (hosts are compile-time constants and the one path segment is
URL-encoded), and CSRF on the unsubscribe POST (the 24-byte token in the URL
is the authorisation, so a cross-site post needs the secret it would be
stealing).
