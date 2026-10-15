#!/usr/bin/env node
/* Builds drd-lead-engine.html — the single-file hosted artifact — from the same
 * sources the server ships. Run after ANY change to styles.css or the modules,
 * so the artifact can never drift from the repo:
 *
 *   node build.js
 *
 * The artifact publish skeleton supplies <!doctype>, <html>, <head> and the
 * charset/viewport metas, so the output starts at <title> and carries no
 * document wrapper of its own. The Google Fonts <link> becomes an @import at
 * the top of the inlined stylesheet; /config.js is dropped because there is no
 * server in artifact mode, which leaves the client in local-demo mode.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const dir = __dirname;
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");

const FONTS = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap";
const MODULES = ["data.js", "engine.js", "workspace.js", "app.js"];

// Body markup: everything between <body> and the first <script>.
const index = read("index.html");
const bodyStart = index.indexOf("<body>") + "<body>".length;
const bodyEnd = index.indexOf("<script", bodyStart);
if (bodyStart < 6 || bodyEnd < 0) throw new Error("index.html: cannot locate body markup");
const markup = index.slice(bodyStart, bodyEnd).trim();

const title = (index.match(/<title>([^<]*)<\/title>/) || [])[1] || "Dr. D Lead Engineering System";

const out = [
  "<title>" + title + "</title>",
  "<style>",
  "@import url('" + FONTS + "');",
  read("styles.css").trim(),
  "</style>",
  markup,
  ...MODULES.map((m) => "<script>\n" + read(m).trim() + "\n</script>"),
  "",
].join("\n");

const target = path.join(dir, "drd-lead-engine.html");
fs.writeFileSync(target, out);
const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
console.log("built drd-lead-engine.html — " + kb + " KB from " + (MODULES.length + 2) + " sources");
if (Buffer.byteLength(out) > 16 * 1024 * 1024) throw new Error("over the 16MB artifact limit");
