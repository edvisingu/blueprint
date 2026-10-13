/* Consent: who we are permitted to email, and the evidence for it.
 *
 * This module is deliberately the narrowest gate in the system. Nothing else
 * decides eligibility; the send path calls eligibility() and obeys it.
 *
 * NOT LEGAL ADVICE. The bases and clocks below are our implementation of
 * CASL as we understand it, and are pending qualified Canadian legal review.
 * Two things drove the design and are worth keeping in view:
 *
 *   - Under CASL the sender carries the burden of PROOF, not the recipient
 *     the burden of complaint. So a boolean "consented" column is useless:
 *     what matters is whether we can produce a record of how and when.
 *   - The CRTC has held that addresses obtained from a third party that
 *     scraped or sold them create no implied consent. CompuFinder was
 *     penalised $200,000 advancing essentially that argument. So "we bought
 *     a list" is not a basis, and this module has no code path that treats
 *     it as one.
 *
 * Clocks are enforced in code rather than documented and hoped for.
 */
"use strict";

const DAY = 86400000;

/* Each basis names: what it is, whether it expires, and what evidence a
 * record must carry to be worth anything if it is ever questioned. */
const BASES = {
  express: {
    label: "Express consent",
    // No clock: express consent stands until withdrawn.
    ttlDays: null,
    requires: ["source_note", "captured_at"],
    note: "Recipient actively agreed to receive messages. Record the exact wording shown and when.",
  },
  implied_transaction: {
    label: "Implied — existing business relationship",
    // Purchase, contract or accepted business opportunity.
    ttlDays: 730,
    requires: ["source_note", "captured_at"],
    note: "Purchase, contract or accepted opportunity. Runs 24 months from the transaction.",
  },
  implied_inquiry: {
    label: "Implied — inquiry or application",
    ttlDays: 180,
    requires: ["source_note", "captured_at"],
    note: "They enquired or applied. Runs 6 months from the inquiry.",
  },
  implied_publication: {
    label: "Implied — conspicuous publication",
    // No fixed clock, but the conditions must still hold at send time, which
    // is why this basis demands the strictest evidence set.
    ttlDays: null,
    requires: ["source_url", "evidence_ref", "role_relevance", "anti_solicitation_checked"],
    note:
      "The address was published by the person or their organisation, carried no statement refusing " +
      "unsolicited messages, and our message relates to their role. All three must be true, and the " +
      "burden of showing it is ours.",
  },
  b2b_exemption: {
    label: "Business-to-business exemption",
    ttlDays: null,
    requires: ["source_note", "role_relevance"],
    note:
      "Requires a pre-existing relationship between the two organisations AND a message about the " +
      "recipient organisation's activities. Read narrowly; usually unavailable for genuine cold outreach.",
  },
};

/* Bases that carry an expiry clock, for display. */
const EXPIRING = Object.keys(BASES).filter((k) => BASES[k].ttlDays !== null);

function basisList() {
  return Object.keys(BASES).map((k) => ({ id: k, ...BASES[k] }));
}

/* What expires_at should be for a basis captured at a given time.
 * Returns null for bases with no clock. */
function expiryFor(basis, capturedAt) {
  const b = BASES[basis];
  if (!b || b.ttlDays === null) return null;
  return capturedAt + b.ttlDays * DAY;
}

/* Validate a proposed consent record. Returns {ok, errors[]}.
 * Called on import and on manual entry — the only two ways consent enters. */
function validate(rec) {
  const errors = [];
  const b = BASES[rec.basis];
  if (!b) {
    errors.push(
      "basis must be one of: " + Object.keys(BASES).join(", ") +
        (rec.basis ? ' (got "' + rec.basis + '")' : " (missing)")
    );
    return { ok: false, errors };
  }
  if (!rec.captured_at || !Number.isFinite(Number(rec.captured_at))) {
    errors.push("captured_at must be a timestamp — when the basis arose, not when you imported it");
  } else if (Number(rec.captured_at) > Date.now() + DAY) {
    errors.push("captured_at is in the future");
  }
  if (!rec.captured_by) errors.push("captured_by is required — who recorded this");

  for (const field of b.requires) {
    if (field === "anti_solicitation_checked") {
      // Must be an affirmative check, not merely present.
      if (!Number(rec.anti_solicitation_checked)) {
        errors.push(
          "anti_solicitation_checked must be confirmed for " + b.label +
            ": the published address must not be accompanied by a statement refusing unsolicited messages"
        );
      }
      continue;
    }
    if (!rec[field] || String(rec[field]).trim() === "") {
      errors.push(field + " is required for " + b.label);
    }
  }
  if (rec.basis === "implied_publication" && rec.source_url && !/^https?:\/\//i.test(rec.source_url)) {
    errors.push("source_url must be an http(s) URL pointing at the page where the address is published");
  }
  return { ok: errors.length === 0, errors };
}

/* Is this contact eligible to be emailed right now, and if not, exactly why?
 *
 * Returns { eligible, reason, basis, expires_at }. `reason` is a stable
 * machine key so it can be counted, filtered and shown in a skip report
 * rather than collapsing into a generic failure.
 *
 * Order matters: the cheapest and most absolute checks run first, and demo
 * data is rejected before anything else so that fiction can never be sent
 * to regardless of what consent rows someone has attached to it.
 */
function eligibility(db, contactId, now, brandId) {
  const at = now || Date.now();
  const c = db
    .prepare("SELECT id, email, origin, company_id FROM contacts WHERE id = ?")
    .get(contactId);
  if (!c) return { eligible: false, reason: "contact_not_found" };

  // Invariant 1. Generated data is never sendable, full stop.
  if (c.origin === "demo") {
    return { eligible: false, reason: "demo_contact", detail: "Generated sample data is never sendable" };
  }
  if (!c.email) return { eligible: false, reason: "no_email" };

  // Suppression is org-wide by design: one opt-out covers every brand.
  const sup = db
    .prepare(
      "SELECT s.id, s.value, s.type FROM suppressions s" +
        " JOIN contacts ct ON ct.id = ?" +
        " WHERE s.value = ct.email OR (s.type = 'Domain' AND ct.email LIKE '%@' || s.value)" +
        " LIMIT 1"
    )
    .get(contactId);
  if (sup) return { eligible: false, reason: "suppressed", detail: sup.type + ": " + sup.value };

  // A basis counts for this brand if it names this brand, or names no brand
  // at all (consent given to the operator as a whole). A basis recorded for a
  // DIFFERENT brand does not transfer: that is the point of brand scoping.
  const rows = db
    .prepare(
      "SELECT id, basis, brand_id, expires_at, revoked_at, captured_at FROM consents" +
        " WHERE contact_id = ? AND (brand_id IS NULL OR brand_id = ? OR ? IS NULL)" +
        " ORDER BY captured_at DESC"
    )
    .all(contactId, brandId || null, brandId || null);
  if (!rows.length) {
    // Distinguish "no consent anywhere" from "consent, but not for this
    // brand" — they need different remedies and should not share a reason.
    const any = db.prepare("SELECT COUNT(*) n FROM consents WHERE contact_id=?").get(contactId).n;
    return {
      eligible: false,
      reason: any ? "no_consent_for_brand" : "no_consent_record",
      detail: any ? "Consent exists but not for this brand" : undefined,
    };
  }

  const live = rows.filter((r) => !r.revoked_at && (r.expires_at === null || r.expires_at > at));
  if (!live.length) {
    const revoked = rows.some((r) => r.revoked_at);
    return {
      eligible: false,
      reason: revoked ? "consent_revoked" : "consent_expired",
      detail: revoked
        ? "Consent was withdrawn"
        : "Newest basis expired " + new Date(Math.max(...rows.map((r) => r.expires_at || 0))).toISOString().slice(0, 10),
    };
  }
  // Prefer a non-expiring basis when several apply.
  // Prefer a brand-specific basis over a blanket one, then a non-expiring
  // basis over an expiring one: the most specific, most durable record is the
  // one we would want to produce if asked to justify the send.
  const best =
    live.find((r) => r.brand_id && r.expires_at === null) ||
    live.find((r) => r.brand_id) ||
    live.find((r) => r.expires_at === null) ||
    live[0];
  return {
    eligible: true, reason: "ok", basis: best.basis,
    consentId: best.id, brandId: best.brand_id, expires_at: best.expires_at,
  };
}

/* Consent coverage for ONE organisation: the numbers the readiness gate acts on.
 *
 * Scoping matters and is not obvious. The companies and contacts tables are a
 * shared graph with no org_id — they model "the world", not "our customers".
 * Ownership is expressed by the org-scoped rows that point AT a contact: an
 * import this org ran, or a consent this org recorded. Counting contacts
 * globally would let one org's readiness gate pass on another org's imported
 * list, which is exactly the bug the stress harness caught.
 */
function coverage(db, orgId) {
  const now = Date.now();
  // A contact belongs to this org if this org imported it or recorded consent.
  const OWNED =
    " (ct.import_id IN (SELECT id FROM imports WHERE org_id = ?)" +
    "  OR EXISTS (SELECT 1 FROM consents k WHERE k.contact_id = ct.id AND k.org_id = ?))";

  const real = db
    .prepare("SELECT COUNT(*) n FROM contacts ct WHERE ct.origin != 'demo' AND" + OWNED)
    .get(orgId, orgId).n;

  // Demo rows are global by nature (the seed writes one shared graph), so this
  // count is deliberately not org-scoped: any demo data present makes every
  // org's figures meaningless, and the gate should say so.
  const demo = db.prepare("SELECT COUNT(*) n FROM contacts WHERE origin = 'demo'").get().n;

  const withBasis = db
    .prepare(
      "SELECT COUNT(DISTINCT c.contact_id) n FROM consents c" +
        " JOIN contacts ct ON ct.id = c.contact_id" +
        " WHERE c.org_id = ? AND ct.origin != 'demo' AND c.revoked_at IS NULL" +
        " AND (c.expires_at IS NULL OR c.expires_at > ?)"
    )
    .get(orgId, now).n;

  const byBasis = db
    .prepare(
      "SELECT c.basis, COUNT(DISTINCT c.contact_id) n FROM consents c" +
        " JOIN contacts ct ON ct.id = c.contact_id" +
        " WHERE c.org_id = ? AND ct.origin != 'demo' AND c.revoked_at IS NULL" +
        " AND (c.expires_at IS NULL OR c.expires_at > ?) GROUP BY c.basis"
    )
    .all(orgId, now);

  const expiring30 = db
    .prepare(
      "SELECT COUNT(DISTINCT contact_id) n FROM consents" +
        " WHERE org_id = ? AND revoked_at IS NULL AND expires_at IS NOT NULL" +
        " AND expires_at BETWEEN ? AND ?"
    )
    .get(orgId, now, now + 30 * DAY).n;

  return { realContacts: real, demoContacts: demo, withLiveBasis: withBasis, byBasis, expiringIn30Days: expiring30 };
}

module.exports = { BASES, EXPIRING, basisList, expiryFor, validate, eligibility, coverage, DAY };
