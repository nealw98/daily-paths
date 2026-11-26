#!/usr/bin/env node
/**
 * Build, check, and publish an OTA update.
 *
 *   npm run ota:production -- "What changed"
 *   npm run ota:preview -- "What changed"
 *   npm run ota:production -- --dry-run      # build and check only
 *
 * Why this exists: `eas update` does NOT use the `env` blocks in eas.json
 * (those only apply to native builds). It uses the variables stored on
 * expo.dev for the matching environment. The Nov 2026 production OTA went
 * out without the Mixpanel token because of this, and analytics went quiet
 * for every phone that installed it.
 *
 * So this script:
 *   1. Builds the JS bundles with the expo.dev variables for the environment
 *      (cache cleared, so no stale values get reused).
 *   2. Checks that every value in eas.json's matching build profile that the
 *      app's code reads made it into the bundles. Values whose name contains
 *      _IOS_ / _ANDROID_ only need to be in that platform's bundle.
 *   3. Publishes those exact bundles, or stops without publishing if
 *      anything is missing.
 *
 * If the check fails: on expo.dev → Environment variables, add or fix the
 * listed variable for this environment (plain text, not "Secret" — secret
 * values can't be used for a locally built update), then run this again.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function run(args, label) {
  console.log(`\n→ ${label}`);
  const r = spawnSync(NPX, args, { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) fail(`${label} failed (exit ${r.status}). Nothing was published.`);
}

// ---- Arguments --------------------------------------------------------------
const argv = process.argv.slice(2);
const environment = argv[0];
const dryRun = argv.includes("--dry-run");
const message = argv.slice(1).filter((a) => a !== "--dry-run").join(" ").trim();

if (!["production", "preview"].includes(environment)) {
  fail('Usage: node scripts/publish-ota.js <production|preview> "message" [--dry-run]');
}
if (!dryRun && !message) {
  fail(`Add a message describing the update, e.g. npm run ota:${environment} -- "Fix reading layout"`);
}

const easJson = JSON.parse(fs.readFileSync(path.join(ROOT, "eas.json"), "utf8"));
const profile = easJson.build?.[environment];
if (!profile) fail(`eas.json has no "${environment}" build profile.`);
const expected = profile.env || {};
const branch = profile.channel || environment;

// ---- 1. Build ---------------------------------------------------------------
fs.rmSync(DIST, { recursive: true, force: true });
run(
  [
    "eas-cli", "env:exec", environment,
    "npx expo export --output-dir dist --platform all --clear",
    "--non-interactive",
  ],
  `Building bundles with the expo.dev "${environment}" variables`
);

// ---- 2. Check ---------------------------------------------------------------
function bundleFor(platform) {
  const dir = path.join(DIST, "_expo", "static", "js", platform);
  const file = fs.existsSync(dir) && fs.readdirSync(dir).find((f) => /^entry-.*\.(hbc|js)$/.test(f));
  if (!file) fail(`No ${platform} bundle was produced in dist/. Nothing was published.`);
  return fs.readFileSync(path.join(dir, file));
}
const bundles = { ios: bundleFor("ios"), android: bundleFor("android") };

// Only values the app's code actually reads can end up in a bundle.
function sourceText() {
  const skip = new Set(["node_modules", "dist", ".git", "ios", "android", ".expo"]);
  let text = "";
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|jsx?)$/.test(entry.name) && full !== __filename) text += fs.readFileSync(full, "utf8");
    }
  })(ROOT);
  return text;
}
const source = sourceText();

console.log(`\n→ Checking bundles against eas.json "${environment}" values`);
const problems = [];
for (const [name, value] of Object.entries(expected)) {
  if (!source.includes(name)) {
    console.log(`  – ${name} (not used by the app's code, skipped)`);
    continue;
  }
  const platforms = /_IOS_/.test(name) ? ["ios"] : /_ANDROID_/.test(name) ? ["android"] : ["ios", "android"];
  for (const p of platforms) {
    const found = bundles[p].includes(Buffer.from(String(value)));
    console.log(`  ${found ? "✓" : "✖"} ${name} (${p})`);
    if (!found) problems.push(`${name} is missing or different in the ${p} bundle`);
  }
}
if (problems.length) {
  fail(
    "Not publishing — these values didn't make it into the update:\n  - " +
      problems.join("\n  - ") +
      `\n\nOn expo.dev → Environment variables, make sure each one exists for "${environment}",` +
      "\nmatches eas.json, and is plain text (not Secret). Then run this again."
  );
}
console.log("  All values present.");

if (dryRun) {
  console.log("\n✔ Dry run: bundles built and checked. Nothing was published.\n");
  process.exit(0);
}

// ---- 3. Publish -------------------------------------------------------------
run(
  [
    "eas-cli", "update",
    "--branch", branch,
    "--environment", environment,
    "--skip-bundler", "--input-dir", "dist",
    "--platform", "all",
    "--message", message,
  ],
  `Publishing to the "${branch}" branch`
);
console.log("\n✔ Published.\n");
