// Server-side tests for api/enquiry.php using PHP's built-in server and a
// local SMTP sink. Uses dummy enquiries only. Nothing is sent to a real inbox.
//
// Usage: PHP_BIN=/path/to/php node tests/server-tests.mjs
// Needs: PHP 8.1+ with fileinfo, mbstring and openssl; Python 3.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const php = process.env.PHP_BIN || "php";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stc-server-tests-"));
const procs = [];
let passed = 0;
let failed = 0;

function check(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
}

function writeEnv(name, values) {
  const file = path.join(tmp, name, "stc-enquiry.env");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Object.entries(values).map(([k, v]) => `${k}=${v}`).join("\n"));
  return file;
}

const baseEnv = (smtpPort, origin, extra = {}) => ({
  ENQUIRY_ENABLED: "true",
  ENQUIRY_TO: "owner-inbox@example.test",
  ENQUIRY_TO_NAME: "Test Inbox",
  MAIL_FROM: "website@example.test",
  MAIL_FROM_NAME: "Sydney Tree Connect website",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: String(smtpPort),
  SMTP_SECURE: "none",
  SMTP_USER: "",
  SMTP_PASS: "",
  ALLOWED_ORIGINS: origin,
  RATE_LIMIT_SECRET: "test-secret-0123456789abcdef",
  RATE_LIMIT_PER_HOUR: "50",
  RATE_LIMIT_PER_DAY: "100",
  ...extra,
});

function start(cmd, args, env = {}) {
  const p = spawn(cmd, args, { cwd: root, env: { ...process.env, ...env }, stdio: "ignore" });
  procs.push(p);
  return p;
}

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  throw new Error("Server did not start: " + url);
}

function phpServer(port, envFile, ini = {}) {
  const iniArgs = Object.entries({ upload_max_filesize: "8M", post_max_size: "40M", max_file_uploads: "20", display_errors: "0", ...ini })
    .flatMap(([k, v]) => ["-d", `${k}=${v}`]);
  start(php, [...iniArgs, "-S", `127.0.0.1:${port}`, "tests/router.php"], envFile ? { STC_ENV_FILE: envFile } : { STC_ENV_FILE: path.join(tmp, "missing.env") });
  return `http://127.0.0.1:${port}`;
}

// --- fixtures -------------------------------------------------------------
const heroJpg = fs.readFileSync(path.join(root, "assets/images/services/tree-removal-800.jpg"));
const pngBuf = fs.readFileSync(path.join(root, "apple-touch-icon.png"));
const webpBuf = fs.readFileSync(path.join(root, "assets/images/services/tree-pruning-480.webp"));
const bigJpg = Buffer.concat([heroJpg, Buffer.alloc(4.3 * 1024 * 1024, 0)]);
const midJpg = Buffer.concat([heroJpg, Buffer.alloc(3.5 * 1024 * 1024, 0)]);
const svgAsJpg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const exeAsJpg = Buffer.concat([Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "binary"), Buffer.alloc(2048, 1)]);
const gifBuf = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

function validFields(overrides = {}) {
  return {
    name: "Test Person",
    email: "test.person@example.test",
    phone: "",
    contact_method: "email",
    suburb: "Epping",
    postcode: "2121",
    service: "tree-pruning",
    description: "DUMMY TEST ENQUIRY. Large gum tree overhanging the back fence.",
    property_authority: "owner",
    council_status: "not-sure",
    consent: "yes",
    website: "",
    form_started: String(Date.now() - 20000),
    ...overrides,
  };
}

async function post(base, fields, { files = [], json = true, origin = base, headers = {} } = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.append(k, v);
  for (const f of files) fd.append("photos[]", new Blob([f.data], { type: f.type }), f.name);
  const h = { ...headers };
  if (json) h.Accept = "application/json";
  if (origin) h.Origin = origin;
  const res = await fetch(base + "/api/enquiry.php", { method: "POST", body: fd, headers: h, redirect: "manual" });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: res.status, body, text, location: res.headers.get("location") };
}

function mails(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort().map((f) => fs.readFileSync(path.join(dir, f), "utf8"));
}

function header(eml, name) {
  const head = eml.split("\r\n\r\n")[0].replace(/\r\n[ \t]+/g, " ");
  const m = head.match(new RegExp(`^${name}: (.*)$`, "mi"));
  return m ? m[1] : null;
}

// --- run --------------------------------------------------------------------
const mailDir = path.join(tmp, "mail");
const py = process.env.PYTHON_BIN || "python";
start(py, ["tests/smtp-sink.py", "12525", mailDir]);
start(py, ["tests/smtp-sink.py", "12526", path.join(tmp, "mail-reject"), "--reject"]);

const A = "http://127.0.0.1:18081";
const B = "http://127.0.0.1:18082";
const C = "http://127.0.0.1:18083";
const D = "http://127.0.0.1:18084";
phpServer(18081, writeEnv("a", baseEnv(12525, A)));
phpServer(18082, writeEnv("b", baseEnv(12526, B)));
phpServer(18083, writeEnv("c", { ...baseEnv(12525, C), ENQUIRY_ENABLED: "false" }));
phpServer(18084, writeEnv("d", baseEnv(12525, D, { RATE_LIMIT_PER_HOUR: "2" })), { post_max_size: "1M" });
phpServer(18085, writeEnv("e", baseEnv(12599, "http://127.0.0.1:18085")));
const E = "http://127.0.0.1:18085";

// Authenticated SMTP, as used with Gmail. The sink records the credentials it receives.
const authMailDir = path.join(tmp, "mail-auth");
const authLog = path.join(tmp, "smtp-auth.log");
start(py, ["tests/smtp-sink.py", "12527", authMailDir, "--auth-log", authLog]);
const F = "http://127.0.0.1:18086";
const G = "http://127.0.0.1:18087";
const H = "http://127.0.0.1:18088";
const authEnv = (origin, pass) =>
  baseEnv(12527, origin, { MAIL_FROM: "sender@example.test", SMTP_USER: "sender@example.test", SMTP_PASS: pass, ENQUIRY_TO: "sender@example.test" });
phpServer(18086, writeEnv("f", authEnv(F, "abcd efgh ijkl mnop")));
phpServer(18087, writeEnv("g", authEnv(G, "")));
phpServer(18088, writeEnv("h", authEnv(H, "Two Words!")));

try {
  await Promise.all([A, B, C, D, E, F, G, H].map((u) => waitFor(u + "/robots.txt")));
  await new Promise((r) => setTimeout(r, 500));

  console.log("\nRouting and static files");
  for (const [p, code] of [["/", 200], ["/privacy.html", 200], ["/does-not-exist", 404], ["/docs/launch-checklist.md", 404], ["/README.md", 404], ["/.env.example", 404], ["/api/lib/PHPMailer/PHPMailer.php", 404], ["/scripts/build-brand.py", 404], ["/private/stc-enquiry.env", 404], ["/private/", 404], ["/PRIVATE/stc-enquiry.env", 404]]) {
    const r = await fetch(A + p);
    check(`GET ${p} -> ${code}`, r.status === code, `got ${r.status}`);
  }
  const g = await fetch(A + "/api/enquiry.php");
  check("GET /api/enquiry.php -> 405", g.status === 405, `got ${g.status}`);

  console.log("\nConfiguration and delivery failures");
  let r = await post(C, validFields());
  check("Form disabled/not configured -> 503, ok:false", r.status === 503 && r.body && r.body.ok === false, r.text.slice(0, 200));
  r = await post(B, validFields());
  check("SMTP rejects message -> 502, ok:false, no success", r.status === 502 && r.body && r.body.ok === false, r.text.slice(0, 200));
  r = await post(E, validFields());
  check("SMTP server unreachable -> 502, ok:false", r.status === 502 && r.body && r.body.ok === false, r.text.slice(0, 200));

  console.log("\nValidation");
  r = await post(A, validFields({ name: "", email: "not-an-email", suburb: "", postcode: "3000", service: "chainsaw", description: "short", property_authority: "", council_status: "x", consent: "" }));
  const e = (r.body && r.body.errors) || {};
  check("Invalid inputs -> 422", r.status === 422, `got ${r.status}`);
  for (const k of ["name", "email", "suburb", "postcode", "service", "description", "property_authority", "council_status", "consent"]) {
    check(`  field error for ${k}`, typeof e[k] === "string" && e[k].length > 0);
  }
  r = await post(A, validFields({ consent: undefined }));
  check("Missing consent -> 422 consent error", r.status === 422 && r.body.errors.consent);
  r = await post(A, validFields({ contact_method: "phone", phone: "" }));
  check("Phone preferred without number -> 422 phone error", r.status === 422 && r.body.errors.phone);
  r = await post(A, validFields({ phone: "abc123" }));
  check("Invalid phone -> 422", r.status === 422 && r.body.errors.phone);
  r = await post(A, validFields({ contact_method: "fax" }));
  check("Unknown contact method -> 422", r.status === 422 && r.body.errors.contact_method);
  r = await post(A, validFields({ email: "a@example.test\r\nBcc: victim@example.test" }));
  check("Email with header injection -> 422", r.status === 422 && r.body.errors.email);
  r = await post(A, validFields({ description: "x".repeat(3001) }));
  check("Description over 3000 chars -> 422", r.status === 422 && r.body.errors.description);

  console.log("\nSpam protection");
  let before = mails(mailDir).length;
  r = await post(A, validFields({ website: "http://spam.example" }));
  check("Honeypot filled -> 400, not sent", r.status === 400 && r.body.ok === false && mails(mailDir).length === before);
  r = await post(A, validFields({ form_started: String(Date.now()) }));
  check("Submitted too quickly -> 400", r.status === 400 && r.body.ok === false);
  r = await post(A, validFields(), { origin: "https://evil.example" });
  check("Cross-site origin -> 403", r.status === 403);

  console.log("\nPhoto validation");
  r = await post(A, validFields(), { files: Array.from({ length: 6 }, (_, i) => ({ data: heroJpg, type: "image/jpeg", name: `p${i}.jpg` })) });
  check("6 photos -> 422 photos error", r.status === 422 && r.body.errors.photos, r.text.slice(0, 200));
  r = await post(A, validFields(), { files: [{ data: bigJpg, type: "image/jpeg", name: "big.jpg" }] });
  check("Photo over 4 MB -> 422", r.status === 422 && r.body.errors.photos, r.text.slice(0, 200));
  r = await post(A, validFields(), { files: [1, 2, 3, 4].map((i) => ({ data: midJpg, type: "image/jpeg", name: `m${i}.jpg` })) });
  check("Photos over 12 MB total -> 422", r.status === 422 && r.body.errors.photos, r.text.slice(0, 200));
  r = await post(A, validFields(), { files: [{ data: svgAsJpg, type: "image/jpeg", name: "photo.jpg" }] });
  check("SVG disguised as JPEG -> 422", r.status === 422 && r.body.errors.photos);
  r = await post(A, validFields(), { files: [{ data: exeAsJpg, type: "image/jpeg", name: "photo.jpg" }] });
  check("Executable disguised as JPEG -> 422", r.status === 422 && r.body.errors.photos);
  r = await post(A, validFields(), { files: [{ data: gifBuf, type: "image/gif", name: "anim.gif" }] });
  check("GIF (not allowed) -> 422", r.status === 422 && r.body.errors.photos);
  r = await post(A, validFields(), { files: [{ data: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(500, 7)]), type: "image/jpeg", name: "broken.jpg" }] });
  check("Corrupt JPEG -> 422", r.status === 422 && r.body.errors.photos);
  r = await post(D, validFields(), { files: [{ data: midJpg, type: "image/jpeg", name: "x.jpg" }] });
  check("Body over post_max_size -> 413 with photos error", r.status === 413 && r.body && r.body.errors.photos, `got ${r.status} ${r.text.slice(0, 120)}`);

  console.log("\nSuccessful delivery");
  before = mails(mailDir).length;
  r = await post(A, validFields({
    name: "Test Person\r\nBcc: victim@example.test",
    phone: "0400 000 000",
    contact_method: "phone",
    service: "tree-removal",
    council_status: "believe-exempt",
    property_authority: "other-or-unsure",
  }), { files: [
    { data: heroJpg, type: "image/jpeg", name: "../../evil name.jpg" },
    { data: pngBuf, type: "image/png", name: "tree.png" },
    { data: webpBuf, type: "image/webp", name: "tree.webp" },
  ] });
  check("Valid enquiry with 3 photos -> 200 ok:true", r.status === 200 && r.body && r.body.ok === true, r.text.slice(0, 300));
  await new Promise((res) => setTimeout(res, 300));
  const all = mails(mailDir);
  const eml = all[all.length - 1] || "";
  check("Exactly one email delivered to sink", all.length === before + 1);
  check("To is the owner inbox (not contractor)", /owner-inbox@example\.test/.test(header(eml, "To") || ""));
  check("From is the fixed sender", /website@example\.test/.test(header(eml, "From") || ""));
  check("Reply-To is the customer", /test\.person@example\.test/.test(header(eml, "Reply-To") || ""));
  check("No injected Bcc header", header(eml, "Bcc") === null && !/victim@example\.test/.test(eml.split("\r\n\r\n")[0]), eml.split("\r\n\r\n")[0]);
  check("Subject has reference and service", /Tree enquiry STC-\d{8}-[0-9A-F]{6}: Tree removal, Epping/.test(header(eml, "Subject") || ""), header(eml, "Subject"));
  const bodyText = eml.replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  for (const s of ["Name: Test Person Bcc: victim@example.test", "Phone: 0400 000 000", "Preferred contact method: Phone", "Postcode: 2121", "Council approval status: Believes exempt (needs verification)", "Connection to property: Other or unsure", "Consent given: Yes", "Consent wording (version", "Photos attached: 3", "DUMMY TEST ENQUIRY"]) {
    check(`  email body includes "${s.slice(0, 50)}"`, bodyText.includes(s));
  }
  const attachments = [...eml.matchAll(/filename="?([^"\r\n;]+)"?/g)].map((m) => m[1]);
  check("3 attachments with safe generated names", attachments.length === 3 && attachments.every((n) => /^STC-\d{8}-[0-9A-F]{6}-photo-\d\.(jpg|png|webp)$/.test(n)), attachments.join(", "));

  r = await post(A, validFields(), { json: false });
  check("No-JS post success -> 303 to /thank-you.html", r.status === 303 && r.location === "/thank-you.html", `${r.status} ${r.location}`);
  r = await post(A, validFields({ email: "bad" }), { json: false });
  check("No-JS post error -> HTML error page, 422", r.status === 422 && /Your enquiry was not sent/.test(r.text));

  console.log("\nSMTP authentication (Gmail App Password format, same sending and receiving address)");
  r = await post(G, validFields());
  check("SMTP_USER set but SMTP_PASS empty -> 503, not sent", r.status === 503 && r.body && r.body.ok === false, r.text.slice(0, 200));
  r = await post(F, validFields(), { files: [{ data: heroJpg, type: "image/jpeg", name: "tree.jpg" }] });
  check("Authenticated send with App Password -> 200 ok:true", r.status === 200 && r.body && r.body.ok === true, r.text.slice(0, 200));
  r = await post(H, validFields());
  check("Authenticated send with an ordinary password -> 200 ok:true", r.status === 200 && r.body && r.body.ok === true, r.text.slice(0, 200));
  await new Promise((res) => setTimeout(res, 300));
  const creds = fs.existsSync(authLog) ? fs.readFileSync(authLog, "utf8").trim().split(/\r?\n/) : [];
  check("App Password pasted with spaces is sent without them", creds[0] === "sender@example.test\tabcdefghijklmnop", JSON.stringify(creds[0]));
  check("Other passwords are sent unchanged", creds[1] === "sender@example.test\tTwo Words!", JSON.stringify(creds[1]));
  const authMail = mails(authMailDir)[0] || "";
  check("Same address in From and To, customer in Reply-To", /sender@example\.test/.test(header(authMail, "From") || "") && /sender@example\.test/.test(header(authMail, "To") || "") && /test\.person@example\.test/.test(header(authMail, "Reply-To") || ""));
  check("Photo attachment preserved", (authMail.match(/Content-Disposition: attachment/g) || []).length === 1);

  console.log("\nRate limiting");
  r = await post(D, validFields());
  const r2 = await post(D, validFields());
  const r3 = await post(D, validFields());
  check("Third enquiry within an hour -> 429", r.status === 200 && r2.status === 200 && r3.status === 429, `${r.status} ${r2.status} ${r3.status}`);
  const rateFiles = fs.readdirSync(path.join(tmp, "d", "stc-rate-limit"));
  check("Rate-limit records store a hash, not the IP", rateFiles.every((f) => !f.includes("127.0.0.1")) && rateFiles.some((f) => /^[0-9a-f]{64}\.json$/.test(f)));
} finally {
  for (const p of procs) p.kill();
}

console.log(`\n${passed} passed, ${failed} failed`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
