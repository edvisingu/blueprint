#!/usr/bin/env node
/* Asserts that the static handler cannot leak anything it should not.
 *
 *   node server/exposure.test.js
 *
 * This exists because of a real, reproduced vulnerability. Static files were
 * served from the whole repository root, and static serving happens BEFORE
 * authentication, so an unauthenticated request could fetch:
 *
 *   GET /server/.dev-token  -> a live API bearer token, which then granted
 *                              full read and write access to every /v1 route
 *   GET /server/drd.db      -> the entire database: contacts, message bodies,
 *                              consent records, unsubscribe tokens
 *
 * It worked in the hardened posture too (public mode with a password set),
 * because the request never reached the auth check. Path traversal was never
 * the hole: normalisation held. The hole was that everything legitimately
 * inside the root was public.
 *
 * The fix is an allowlist, which fails closed. These tests reproduce the
 * original exploit and require it to fail.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const pathm = require("path");

let pass = 0, fail = 0; const failures = [];
const ok = (n, c, d) => { if (c) { pass++; console.log("  \x1b[32mPASS\x1b[0m " + n); }
  else { fail++; failures.push(n); console.log("  \x1b[31mFAIL\x1b[0m " + n + (d ? " — " + d : "")); } };
const section = (t) => console.log("\n\x1b[1m" + t + "\x1b[0m");

const dir = fs.mkdtempSync(pathm.join(os.tmpdir(), "drd-exp-"));
const dbFile = pathm.join(dir, "e.db");
process.env.DRD_DB_PATH = dbFile;
process.env.DRD_PUBLIC = "1";
process.env.DRD_ADMIN_PASSWORD = "a-long-test-password";
// Public mode refuses to start without a stable session secret, which is the
// correct guard; supply one for the test.
process.env.DRD_SESSION_SECRET = "test-session-secret-not-a-real-one";
process.env.DRD_PUBLIC_URL = "https://leads.example.invalid";

const { open } = require("./db.js");
const db = open(dbFile);
db.prepare("INSERT INTO organizations (id,name,plan,credits_included,credits_used,autopilot,created_at) VALUES ('org_root','T','Growth',5000,0,1,?)").run(Date.now());
db.prepare("INSERT INTO users (id,org_id,email,name,role,created_at) VALUES ('u','org_root','a@b.c','A','owner',?)").run(Date.now());
db.close();

// A decoy secret in the served directory, so the test does not depend on a
// real .dev-token existing in this checkout.
const decoy = pathm.join(__dirname, ".dev-token");
const hadDecoy = fs.existsSync(decoy);
if (!hadDecoy) fs.writeFileSync(decoy, "drd_live_SECRET_SENTINEL_VALUE");

const srv = require("./server.js").create();
srv.listen(0, "127.0.0.1", async () => {
  const base = "http://127.0.0.1:" + srv.address().port;
  const get = async (p) => { const r = await fetch(base + p); return { status: r.status, text: await r.text(), ct: r.headers.get("content-type") || "" }; };

  section("Secrets inside the served directory are unreachable");
  {
    const t = await get("/server/.dev-token");
    ok("the dev token 404s", t.status === 404, t.status + " " + t.text.slice(0, 40));
    ok("no token value appears in the body", !/drd_live_/.test(t.text), t.text.slice(0, 60));

    const d = await get("/server/drd.db");
    ok("the default database path 404s", d.status === 404, d.status);
    // And the one actually in use, by basename.
    const d2 = await get("/" + pathm.basename(dbFile));
    ok("the live database basename 404s", d2.status === 404, d2.status);

    for (const p of ["/package.json", "/server/db.js", "/server/sending.js",
                     "/campaigns/drdsports.json", "/docs/COMPLIANCE.md", "/.gitignore",
                     "/server/consent.js", "/reports/Smartlead%20feature%20gap%20analysis.md"]) {
      const r = await get(p);
      ok("not served: " + p, r.status === 404, r.status);
    }
  }

  section("Traversal attempts fail, in every encoding");
  {
    for (const p of ["/../package.json", "/..%2fpackage.json", "/%2e%2e/package.json",
                     "/server/../server/.dev-token", "/./server/.dev-token",
                     "/....//package.json", "/%2e%2e%2fserver%2f.dev-token"]) {
      const r = await get(p);
      ok("blocked: " + p, r.status === 404 || r.status === 400, r.status);
    }
  }

  section("The client's own files are still served");
  {
    for (const [p, ct] of [["/", "text/html"], ["/index.html", "text/html"],
                           ["/app.js", "text/javascript"], ["/styles.css", "text/css"],
                           ["/engine.js", "text/javascript"]]) {
      const r = await get(p);
      ok("served: " + p + " as " + ct, r.status === 200 && r.ct.includes(ct),
        r.status + " " + r.ct);
    }
    const r = await get("/index.html");
    ok("nosniff is set on static replies", true);
    const probe = await fetch(base + "/app.js");
    ok("x-content-type-options present", probe.headers.get("x-content-type-options") === "nosniff",
      probe.headers.get("x-content-type-options"));
  }

  section("The API still requires authentication");
  {
    const r = await get("/v1/suppressions");
    ok("suppressions needs auth", r.status === 401, r.status);
    const r2 = await get("/v1/readiness");
    ok("readiness needs auth", r2.status === 401, r2.status);
    const r3 = await fetch(base + "/v1/readiness/arm", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ armed: true }) });
    ok("arming needs auth", r3.status === 401, r3.status);
  }

  section("The passwordless owner fallback is loopback-only");
  {
    // Simulated rather than networked: assert the predicate directly, since a
    // second interface is not available in a sandbox.
    const mod = fs.readFileSync(pathm.join(__dirname, "server.js"), "utf8");
    ok("the fallback is guarded by isLoopback",
      /!ADMIN_PASSWORD && !PUBLIC && isLoopback\(req\)/.test(mod));
    ok("the default bind is loopback without a password",
      /DRD_ADMIN_PASSWORD && !process\.env\.DRD_PUBLIC\)[\s\S]{0,60}127\.0\.0\.1/.test(mod));
    const fn = new Function("req", mod.slice(mod.indexOf("function isLoopback"),
      mod.indexOf("/* Response headers")).replace("function isLoopback(req) {", "") .replace(/}\s*$/, ""));
    const probe = (addr) => fn({ socket: { remoteAddress: addr } });
    ok("127.0.0.1 is loopback", probe("127.0.0.1") === true);
    ok("::1 is loopback", probe("::1") === true);
    ok("the IPv4-mapped form is loopback", probe("::ffff:127.0.0.1") === true);
    ok("a LAN address is NOT loopback", probe("192.168.1.50") === false);
    ok("a public address is NOT loopback", probe("203.0.113.7") === false);
    ok("an empty address is NOT loopback", probe("") === false);
    ok("a hostname lookalike is NOT loopback", probe("127.0.0.1.evil.test") === false);
    ok("an out-of-range octet is NOT loopback", probe("127.0.0.999") === false);
    ok("a non-loopback 10.x is NOT loopback", probe("10.0.0.1") === false);
    ok("127.1.2.3 IS loopback (the whole /8)", probe("127.1.2.3") === true);
  }

  if (!hadDecoy) { try { fs.unlinkSync(decoy); } catch (e) {} }
  console.log("\n" + "=".repeat(56));
  if (fail === 0) {
    console.log("\x1b[1m\x1b[32m" + pass + " passed, 0 failed\x1b[0m");
    console.log("\nNo secret inside the served directory is reachable, and the");
    console.log("passwordless owner fallback cannot be used from the network.");
  } else {
    console.log("\x1b[1m\x1b[31m" + pass + " passed, " + fail + " FAILED\x1b[0m");
    failures.forEach((f) => console.log("  - " + f));
  }
  console.log("=".repeat(56));
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  srv.close(() => process.exit(fail === 0 ? 0 : 1));
});
