/* Loads the browser data + intelligence modules into a Node context.
 * The scoring, research, classification and email logic is therefore the
 * SAME code on the server and in the client — one engine, two runtimes.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const shim = {};                 // stands in for `window`
const window = shim;             // eslint-disable-line no-unused-vars

function load(file) {
  const src = fs.readFileSync(path.join(root, file), "utf8");
  // eslint-disable-next-line no-eval
  eval(src);
}

load("data.js");
load("engine.js");

module.exports = { DATA: shim.DRD_DATA, ENGINE: shim.DRD_ENGINE };
