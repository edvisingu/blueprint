/* Real contact import. The only way real contacts enter the system.
 *
 * Every row must arrive with its consent provenance. This is enforced rather
 * than encouraged, because consent provenance cannot be backfilled: once a
 * list is in the database without a recorded basis, there is no honest way to
 * reconstruct one, and under CASL the burden of proof sits with the sender.
 *
 * The import report names every rejected row and why. That is the feature
 * whose absence produces "I imported 5,000 contacts and 1,200 vanished" in
 * competing tools.
 *
 * NOT LEGAL ADVICE — pending qualified Canadian legal review.
 */
"use strict";

const dns = require("node:dns");
const consent = require("./consent");
const { id } = require("./db");

/* Minimal RFC-pragmatic CSV parser: quoted fields, embedded commas, escaped
 * quotes, CRLF. No dependency, and the shape of real exported lists. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQ = true; continue; }
    if (ch === ",") { row.push(field); field = ""; continue; }
    if (ch === "\r") continue;
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const records = rows.slice(1)
    .filter((r) => r.some((c) => String(c).trim() !== ""))
    .map((r) => {
      const o = {};
      header.forEach((h, i) => { o[h] = (r[i] === undefined ? "" : String(r[i]).trim()); });
      return o;
    });
  return { header, records };
}

const REQUIRED = ["email", "name", "company", "consent_basis", "consent_captured_at", "consent_source"];

/* Columns the importer understands. Published so the UI can show a template
 * and so a rejected file can be explained precisely. */
const COLUMNS = [
  { name: "email", required: true, note: "Work address" },
  { name: "name", required: true, note: "Full name" },
  { name: "title", required: false },
  { name: "company", required: true, note: "Organisation name" },
  { name: "domain", required: false, note: "Inferred from email if omitted" },
  { name: "industry", required: false },
  { name: "country", required: false },
  { name: "city", required: false },
  { name: "linkedin", required: false },
  { name: "phone", required: false },
  { name: "consent_basis", required: true, note: Object.keys(consent.BASES).join(" | ") },
  { name: "consent_captured_at", required: true, note: "ISO date when the basis arose" },
  { name: "consent_source", required: true, note: "URL for published addresses, otherwise a description" },
  { name: "consent_evidence", required: false, note: "Path/URL to a screenshot or PDF of the source" },
  { name: "role_relevance", required: false, note: "Why our message relates to this role" },
  { name: "anti_solicitation_checked", required: false, note: "yes/no — required for conspicuous publication" },
];

const EMAIL_RE = /^[^\s@,;]+@[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

const ROLE_ACCOUNTS = new Set([
  "info", "admin", "sales", "support", "contact", "hello", "office", "enquiries",
  "inquiries", "help", "noreply", "no-reply", "webmaster", "postmaster", "abuse",
]);

function parseDate(v) {
  if (!v) return null;
  if (/^\d{10}$/.test(v)) return Number(v) * 1000;
  if (/^\d{13}$/.test(v)) return Number(v);
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

const truthy = (v) => /^(y|yes|true|1)$/i.test(String(v || "").trim());

/* MX lookup with a cache, used to reject addresses whose domain cannot
 * receive mail at all. Deliberately a soft signal: DNS failure in a sandbox
 * must not reject a whole file, so an unresolvable lookup is recorded as
 * 'unknown' rather than treated as invalid. */
function mxChecker() {
  const cache = new Map();
  return function check(domain) {
    if (cache.has(domain)) return Promise.resolve(cache.get(domain));
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; cache.set(domain, v); resolve(v); } };
      const timer = setTimeout(() => finish("unknown"), 2500);
      try {
        dns.resolveMx(domain, (err, addrs) => {
          clearTimeout(timer);
          if (err) finish(err.code === "ENOTFOUND" || err.code === "ENODATA" ? "none" : "unknown");
          else finish(addrs && addrs.length ? "ok" : "none");
        });
      } catch (e) { clearTimeout(timer); finish("unknown"); }
    });
  };
}

/* The verification adapter. Bring-your-own-key: no vendor, no credentials and
 * no vendor data storage in this repo. Registered by the operator at runtime.
 * Unregistered means verification is skipped and SAID to be skipped, never
 * silently assumed to have passed. */
let verifier = null;
function registerVerifier(fn) { verifier = typeof fn === "function" ? fn : null; }
function verifierName() { return verifier ? (verifier.vendorName || "custom") : null; }

/* Import a CSV for an org. Returns a full report. Nothing is written for a
 * rejected row — a partial contact with no consent is worse than no contact.
 */
async function importCsv(db, orgId, text, opts) {
  const o = opts || {};
  const actor = o.actor || "import";
  const now = Date.now();
  const { header, records } = parseCsv(text);
  const importId = id("imp");

  const missingCols = REQUIRED.filter((c) => !header.includes(c));
  if (missingCols.length) {
    return {
      ok: false,
      error: "missing_required_columns",
      missing: missingCols,
      message:
        "The file is missing required columns: " + missingCols.join(", ") +
        ". Consent provenance is required at import because it cannot be reconstructed later.",
      columns: COLUMNS,
    };
  }

  const mx = mxChecker();
  const accepted = [], rejected = [];
  const seenInFile = new Set();

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const line = i + 2; // 1-based, plus header
    const reject = (reason, detail) => rejected.push({ line, email: r.email || "", reason, detail });

    const email = String(r.email || "").toLowerCase().trim();
    if (!email) { reject("missing_email"); continue; }
    if (!EMAIL_RE.test(email)) { reject("invalid_email_syntax", email); continue; }
    if (seenInFile.has(email)) { reject("duplicate_in_file", email); continue; }
    seenInFile.add(email);

    if (!r.name) { reject("missing_name"); continue; }
    if (!r.company) { reject("missing_company"); continue; }

    const capturedAt = parseDate(r.consent_captured_at);
    if (!capturedAt) { reject("unparseable_consent_date", r.consent_captured_at); continue; }

    const basis = String(r.consent_basis || "").trim();
    const src = String(r.consent_source || "").trim();
    const proposed = {
      basis,
      captured_at: capturedAt,
      captured_by: actor,
      source_url: /^https?:\/\//i.test(src) ? src : null,
      source_note: /^https?:\/\//i.test(src) ? null : src,
      evidence_ref: r.consent_evidence || null,
      role_relevance: r.role_relevance || null,
      anti_solicitation_checked: truthy(r.anti_solicitation_checked) ? 1 : 0,
    };
    const v = consent.validate(proposed);
    if (!v.ok) { reject("consent_invalid", v.errors.join("; ")); continue; }

    // Expiry is computed from the basis, never taken from the file.
    proposed.expires_at = consent.expiryFor(basis, capturedAt);
    if (proposed.expires_at !== null && proposed.expires_at <= now) {
      reject("consent_already_expired",
        consent.BASES[basis].label + " expired " + new Date(proposed.expires_at).toISOString().slice(0, 10));
      continue;
    }

    // Already suppressed anywhere in the org — do not re-add.
    const sup = db
      .prepare("SELECT value,type FROM suppressions WHERE org_id=? AND (value=? OR (type='Domain' AND ?=? AND ? LIKE '%@'||value)) LIMIT 1")
      .get(orgId, email, 1, 1, email);
    if (sup) { reject("suppressed", sup.type + ": " + sup.value); continue; }

    const domain = (r.domain || email.split("@")[1] || "").toLowerCase();
    const local = email.split("@")[0];

    // Existing contact anywhere in the graph: attach consent, do not duplicate.
    const existing = db.prepare("SELECT id, origin FROM contacts WHERE lower(email)=? LIMIT 1").get(email);

    const mxState = o.skipMx ? "skipped" : await mx(domain);
    if (mxState === "none") { reject("domain_cannot_receive_mail", domain); continue; }

    let verifyResult = null;
    if (verifier && !o.skipVerify) {
      try {
        const vr = await verifier(email);
        verifyResult = vr && vr.result ? String(vr.result) : null;
        if (verifyResult === "invalid") { reject("verifier_says_invalid", verifierName()); continue; }
      } catch (e) {
        verifyResult = "verifier_error";
      }
    }

    accepted.push({
      email, local, domain, name: r.name, title: r.title || null,
      company: r.company, industry: r.industry || null,
      country: r.country || null, city: r.city || null,
      linkedin: r.linkedin || null, phone: r.phone || null,
      roleAccount: ROLE_ACCOUNTS.has(local),
      mxState, verifyResult, existingId: existing ? existing.id : null,
      consent: proposed,
    });
  }

  // ---- write phase, one transaction ------------------------------------
  let inserted = 0, attached = 0;
  db.exec("BEGIN");
  try {
    for (const a of accepted) {
      let companyId = db
        .prepare("SELECT id FROM companies WHERE lower(domain)=? LIMIT 1")
        .get(a.domain);
      if (!companyId) {
        const cid = id("co");
        db.prepare(
          "INSERT INTO companies (id,name,domain,industry,country,city,origin) VALUES (?,?,?,?,?,?,'import')"
        ).run(cid, a.company, a.domain, a.industry, a.country, a.city);
        companyId = { id: cid };
      }
      let contactId = a.existingId;
      if (contactId) {
        db.prepare("UPDATE contacts SET origin='import', import_id=?, verified_at=?, verify_result=? WHERE id=?")
          .run(importId, a.verifyResult ? Date.now() : null, a.verifyResult, contactId);
        attached++;
      } else {
        contactId = id("ct");
        db.prepare(
          "INSERT INTO contacts (id,company_id,name,title,email,email_status,verified,phone,linkedin,city,country,origin,import_id,verified_at,verify_result)" +
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,'import',?,?,?)"
        ).run(contactId, companyId.id, a.name, a.title, a.email,
          a.mxState === "ok" ? "deliverable" : "unknown", a.verifyResult === "valid" ? 1 : 0,
          a.phone, a.linkedin, a.city, a.country, importId,
          a.verifyResult ? Date.now() : null, a.verifyResult);
        inserted++;
      }
      const cs = a.consent;
      db.prepare(
        "INSERT INTO consents (id,contact_id,org_id,basis,source_url,source_note,evidence_ref,role_relevance," +
          "anti_solicitation_checked,captured_at,captured_by,expires_at,created_at)" +
          " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
      ).run(id("cs"), contactId, orgId, cs.basis, cs.source_url, cs.source_note, cs.evidence_ref,
        cs.role_relevance, cs.anti_solicitation_checked, cs.captured_at, cs.captured_by,
        cs.expires_at, Date.now());
    }
    const report = {
      importId, rowsTotal: records.length,
      accepted: accepted.length, rejected: rejected.length,
      inserted, attachedToExisting: attached,
      roleAccounts: accepted.filter((a) => a.roleAccount).length,
      mxUnknown: accepted.filter((a) => a.mxState === "unknown").length,
      verifier: verifierName(),
      verificationSkipped: !verifier || !!o.skipVerify,
      byBasis: accepted.reduce((m, a) => { m[a.consent.basis] = (m[a.consent.basis] || 0) + 1; return m; }, {}),
      rejectedByReason: rejected.reduce((m, r) => { m[r.reason] = (m[r.reason] || 0) + 1; return m; }, {}),
      rejectedRows: rejected.slice(0, 500),
      rejectedTruncated: rejected.length > 500,
    };
    db.prepare(
      "INSERT INTO imports (id,org_id,filename,rows_total,rows_accepted,rows_rejected,report_json,created_at)" +
        " VALUES (?,?,?,?,?,?,?,?)"
    ).run(importId, orgId, o.filename || null, records.length, accepted.length, rejected.length,
      JSON.stringify(report), Date.now());
    db.prepare("INSERT INTO audit_logs (id,org_id,actor,action,detail,at) VALUES (?,?,?,?,?,?)")
      .run(id("au"), orgId, actor, "import",
        accepted.length + " accepted, " + rejected.length + " rejected from " + (o.filename || "upload"), Date.now());
    db.exec("COMMIT");
    return { ok: true, ...report };
  } catch (e) {
    db.exec("ROLLBACK");
    return { ok: false, error: "write_failed", message: e.message };
  }
}

/* A template file, so the required shape is discoverable rather than guessed. */
function template() {
  const head = COLUMNS.map((c) => c.name).join(",");
  const example = [
    "athletic.director@examplehigh.edu", "Sample Director", "Athletic Director",
    "Example High School", "examplehigh.edu", "School Athletics", "Canada", "Toronto",
    "", "", "implied_publication", new Date().toISOString().slice(0, 10),
    "https://examplehigh.edu/staff/athletics",
    "evidence/examplehigh-staff-page.png",
    "Message concerns athletic department website and player records", "yes",
  ].map((v) => (String(v).includes(",") ? '"' + v + '"' : v)).join(",");
  return head + "\n" + example + "\n";
}

module.exports = { parseCsv, importCsv, template, COLUMNS, REQUIRED, registerVerifier, verifierName };
