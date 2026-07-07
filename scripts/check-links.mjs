#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(repoRoot, "index.html"), "utf8");

// rel="preconnect"/"dns-prefetch" hints point at a bare origin with no
// real resource at "/" - checking them as pages would always 404.
const preconnectPattern = /<link\b[^>]*\brel\s*=\s*"(?:preconnect|dns-prefetch)"[^>]*>/g;
const preconnectHosts = new Set();
for (const tag of html.matchAll(preconnectPattern)) {
  const hrefMatch = /\bhref\s*=\s*"([^"]+)"/.exec(tag[0]);
  if (hrefMatch) preconnectHosts.add(hrefMatch[1]);
}

const attrPattern = /\b(?:src|href)\s*=\s*"([^"]+)"/g;
const references = new Set();
let match;
while ((match = attrPattern.exec(html))) {
  references.add(match[1]);
}

const localRefs = [];
const externalRefs = [];
for (const ref of references) {
  if (preconnectHosts.has(ref)) continue;
  if (/^(https?:)?\/\//.test(ref) || ref.startsWith("mailto:")) {
    externalRefs.push(ref);
  } else if (!ref.startsWith("#")) {
    localRefs.push(ref);
  }
}

let failures = 0;

console.log(`Checking ${localRefs.length} local asset reference(s)...`);
for (const ref of localRefs) {
  const path = join(repoRoot, decodeURIComponent(ref));
  if (existsSync(path)) {
    console.log(`  OK    ${ref}`);
  } else {
    console.log(`  MISSING ${ref}`);
    failures++;
  }
}

// External sites are outside this repo's control and may block HEAD
// requests from datacenter IPs (bot protection, rate limiting, etc.),
// so a failure here is a warning, not a build-breaker.
let warnings = 0;
console.log(`\nChecking ${externalRefs.length} external reference(s) (warn-only)...`);
for (const ref of externalRefs) {
  const url = ref.startsWith("//") ? `https:${ref}` : ref;
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.ok) {
      console.log(`  OK    [${res.status}] ${ref}`);
    } else {
      console.log(`  WARN  [${res.status}] ${ref}`);
      warnings++;
    }
  } catch (err) {
    console.log(`  WARN  ${ref} (${err.message})`);
    warnings++;
  }
}

if (warnings > 0) {
  console.log(`\n${warnings} external reference(s) could not be verified (non-fatal).`);
}

if (failures > 0) {
  console.error(`\n${failures} broken local reference(s) found.`);
  process.exit(1);
} else {
  console.log("\nAll local references OK.");
}
