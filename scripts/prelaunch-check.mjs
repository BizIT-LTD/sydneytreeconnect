// Pre-launch check. Lists anything that must be resolved before the site is
// made indexable or the form is switched on. Exits 1 while blockers remain.
//
// Usage: node scripts/prelaunch-check.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = ["index.html", "privacy.html", "terms.html", "thank-you.html", "404.html", "tree-removal/index.html", "tree-pruning/index.html", "stump-grinding/index.html", "tree-removal-cost/index.html", "council-tree-rules/index.html", "council-tree-rules/ku-ring-gai/index.html", "council-tree-rules/hornsby/index.html", "council-tree-rules/northern-beaches/index.html"];
const blockers = [];
const warnings = [];
const ok = [];

const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

for (const p of pages) {
  const html = read(p);
  const placeholders = [...html.matchAll(/\[Owner to confirm:([^\]]*)\]/g)].map((m) => m[1].trim());
  if (placeholders.length) blockers.push(`${p}: ${placeholders.length} owner placeholder(s): ${[...new Set(placeholders)].join("; ")}`);
  if (html.includes("STAGING-NOINDEX")) blockers.push(`${p}: staging noindex tag still present (remove at launch)`);
  if (/draft-banner/.test(html)) blockers.push(`${p}: draft banner still present (remove after owner/legal review)`);
  if (/href="tel:/i.test(html)) blockers.push(`${p}: contains a tel: link (no business phone number allowed)`);
  if (/example\.(com|test)|localhost|127\.0\.0\.1/.test(html)) blockers.push(`${p}: contains a placeholder or local domain`);
  if (/data-provisional-service/.test(html)) {
    warnings.push(p === "index.html"
      ? "index.html: service cards are marked provisional. Confirm each with the contractor, then remove the data-provisional-service attribute (and any unconfirmed card)."
      : `${p}: provisional service page. Confirm the service with the contractor, or delete the page, its sitemap entry and links to it.`);
  }
  if (["thank-you.html", "404.html"].includes(p) && !/name="robots" content="noindex/.test(html)) blockers.push(`${p}: must stay noindex`);
}

// Owner decisions now live only in the checklist, so unticked items in section 1 are blockers.
const owner = (read("docs/launch-checklist.md").split(/^## 1\./m)[1] || "").split(/^## /m)[0];
const openItems = [...owner.matchAll(/^- \[ \] (.+)$/gm)].map((m) => m[1].replace(/\*\*/g, "").replace(/^Owner-managed[^:]*:\s*/, "").split(/[.(:]/)[0].trim());
if (openItems.length) blockers.push(`docs/launch-checklist.md: ${openItems.length} open owner decision(s): ${openItems.join("; ")}`);
else ok.push("All owner decisions in the launch checklist are ticked");

const sitemap = read("sitemap.xml");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (locs.some((l) => !l.startsWith("https://sydneytreeconnect.com/"))) blockers.push("sitemap.xml: contains a URL outside https://sydneytreeconnect.com/");
if (locs.some((l) => /thank-you|404/.test(l))) blockers.push("sitemap.xml: must not list thank-you or 404 pages");
else ok.push(`sitemap.xml lists ${locs.length} canonical pages`);

if (!/Sitemap: https:\/\/sydneytreeconnect\.com\/sitemap\.xml/.test(read("robots.txt"))) blockers.push("robots.txt: missing production sitemap line");

// Indexing consistency: sitemap URLs must be indexable, and noindex pages must stay crawlable.
const fileFor = (loc) => { const p = new URL(loc).pathname; return p.endsWith("/") ? p.slice(1) + "index.html" : p.slice(1); };
const noindex = (f) => /<meta name="robots" content="[^"]*noindex/i.test(read(f));
const listedNoindex = locs.filter((l) => fs.existsSync(path.join(root, fileFor(l))) && noindex(fileFor(l)));
if (listedNoindex.length) blockers.push(`sitemap.xml lists noindex page(s): ${listedNoindex.join(", ")}`);
if (noindex("index.html")) blockers.push("index.html: home page is noindex");
const disallowed = [...read("robots.txt").matchAll(/^Disallow:\s*(\S+)/gim)].map((m) => m[1]);
const hidden = pages.filter((p) => noindex(p) && disallowed.some((d) => ("/" + p).startsWith(d)));
if (hidden.length) blockers.push(`robots.txt blocks noindex page(s), so crawlers can't read the tag: ${hidden.join(", ")}`);
else ok.push("Noindex pages are crawlable, and sitemap.xml lists only indexable pages");
if (/Disallow:\s*\/\s*$/m.test(read("robots.txt"))) blockers.push("robots.txt: blocks the whole site");

// Secrets and private files that must never be in the repository
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if ([".git", "node_modules"].includes(d.name)) return [];
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
const files = walk(root).map((f) => path.relative(root, f).replace(/\\/g, "/"));
const isPrivate = (f) => /(^|\/)\.env$|\.env$|(^|\/)config\.php$|(^|\/)(uploads|submissions|enquiries|private|stc-rate-limit)\/|\.eml$/.test(f) && !f.endsWith(".env.example");
let tracked = null;
try {
  tracked = execFileSync("git", ["ls-files", "--cached"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
} catch {}
if (tracked) {
  const leaked = tracked.filter(isPrivate);
  if (leaked.length) blockers.push(`Private files are tracked by git (remove with git rm --cached): ${leaked.join(", ")}`);
  else ok.push("No private files are tracked by git");
} else {
  const present = files.filter(isPrivate);
  if (present.length) blockers.push(`Private files present and git is unavailable to confirm they are ignored: ${present.join(", ")}`);
}
if (fs.existsSync(path.join(root, "private"))) {
  warnings.push("private/ exists locally (git-ignored, blocked by .htaccess). Never upload it into public_html; the live settings file belongs in domains/sydneytreeconnect.com/private/.");
}
const secretPattern = /(SMTP_PASS|PASSWORD|API_KEY|SECRET)\s*[=:]\s*["']?(?!replace-with|test-|browser-test|""|''|\s*$)[^\s"']{8,}/i;
for (const f of files.filter((f) => /\.(php|js|mjs|cjs|html|json|md|example|txt|py)$/.test(f) && !f.startsWith("api/lib/"))) {
  const text = read(f);
  const line = text.split("\n").find((l) => secretPattern.test(l) && !/getenv|\$get\(|\$config\[|process\.env|RATE_LIMIT_SECRET must|_SECRET=replace|SECRET\)\s*[=:]/.test(l));
  if (line) warnings.push(`${f}: possible credential, review manually`);
}

console.log("\nSydney Tree Connect pre-launch check\n");
ok.forEach((m) => console.log("  OK       " + m));
warnings.forEach((m) => console.log("  WARNING  " + m));
blockers.forEach((m) => console.log("  BLOCKER  " + m));
console.log(`\n${blockers.length} blocker(s), ${warnings.length} warning(s).`);
console.log("Also confirm manually: form env file configured, ENQUIRY_ENABLED=true, a real test enquiry reached the inbox.\n");
process.exit(blockers.length ? 1 : 0);
