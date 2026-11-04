// Browser tests: layout, accessibility, links, images, console errors and the
// enquiry form (validation, failures and a real local submission).
// Dummy enquiries only; email goes to a local SMTP sink.
//
// Usage: PHP_BIN=/path/to/php NODE_PATH=<dir with puppeteer-core and axe-core> \
//        node tests/browser-tests.cjs [screenshot-dir]
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer-core");
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const root = path.resolve(__dirname, "..");
const php = process.env.PHP_BIN || "php";
const py = process.env.PYTHON_BIN || "python";
const browserPath =
  process.env.BROWSER_PATH ||
  ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome"].find((p) => fs.existsSync(p));
const shots = process.argv[2] || path.join(root, "tests/output");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stc-browser-"));
const mailDir = path.join(tmp, "mail");
const BASE = "http://127.0.0.1:18091";
const procs = [];
let passed = 0;
let failed = 0;
const notes = [];

function check(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? `\n        ${String(detail).slice(0, 600)}` : ""}`);
  }
}

function start(cmd, args, env = {}) {
  const p = spawn(cmd, args, { cwd: root, env: { ...process.env, ...env }, stdio: "ignore" });
  procs.push(p);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await sleep(150);
    }
  }
  throw new Error("Server did not start");
}

function fixture(name, data) {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, data);
  return p;
}

async function fillValid(page, overrides = {}) {
  const v = {
    name: "Test Person",
    email: "browser.test@example.test",
    phone: "",
    suburb: "Ryde",
    postcode: "2112",
    description: "DUMMY BROWSER TEST. Jacaranda branches over the driveway.",
    ...overrides,
  };
  for (const k of ["name", "email", "phone", "suburb", "postcode", "description"]) {
    await page.$eval(`#${k}`, (el, val) => (el.value = val), v[k]);
  }
  await page.select("#service", overrides.service || "tree-pruning");
  await page.click('input[name="property_authority"][value="owner"]');
  await page.click('input[name="council_status"][value="not-sure"]');
  const consent = await page.$eval("#consent", (el) => el.checked);
  if (!consent && overrides.consent !== false) await page.click("#consent");
  // The handler rejects forms filled in under 4 seconds.
  await page.$eval("#form_started", (el) => (el.value = String(Date.now() - 20000)));
}

(async () => {
  const envFile = path.join(tmp, "stc-enquiry.env");
  fs.writeFileSync(envFile, [
    "ENQUIRY_ENABLED=true", "ENQUIRY_TO=owner-inbox@example.test", "MAIL_FROM=website@example.test",
    "SMTP_HOST=127.0.0.1", "SMTP_PORT=12535", "SMTP_SECURE=none", `ALLOWED_ORIGINS=${BASE}`,
    "RATE_LIMIT_SECRET=browser-test-secret-0123456789", "RATE_LIMIT_PER_HOUR=50", "RATE_LIMIT_PER_DAY=100",
  ].join("\n"));
  start(py, ["tests/smtp-sink.py", "12535", mailDir]);
  start(php, ["-d", "upload_max_filesize=8M", "-d", "post_max_size=40M", "-d", "display_errors=0", "-S", "127.0.0.1:18091", "tests/router.php"], { STC_ENV_FILE: envFile });
  await waitFor(BASE + "/robots.txt");
  fs.mkdirSync(shots, { recursive: true });

  const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
  const pages = ["/", "/privacy.html", "/terms.html", "/thank-you.html", "/404.html"];

  try {
    console.log("\nPages: console errors, failed requests, headings, metadata, accessibility");
    for (const url of pages) {
      const page = await browser.newPage();
      const errors = [];
      const badRequests = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("requestfailed", (r) => badRequests.push(r.url()));
      page.on("response", (r) => r.status() >= 400 && badRequests.push(`${r.status()} ${r.url()}`));
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(BASE + url, { waitUntil: "networkidle0" });
      check(`${url} no console errors`, errors.length === 0, errors.join(" | "));
      check(`${url} no failed requests`, badRequests.length === 0, badRequests.join(" | "));
      const meta = await page.evaluate(() => ({
        h1: document.querySelectorAll("h1").length,
        title: document.title,
        desc: document.querySelector('meta[name="description"]')?.content || "",
        robots: document.querySelector('meta[name="robots"]')?.content || "",
        canonical: document.querySelector('link[rel="canonical"]')?.href || "",
        lang: document.documentElement.lang,
        skipped: [...document.querySelectorAll("h1,h2,h3,h4")].map((h) => +h.tagName[1]).some((l, i, a) => i > 0 && l - a[i - 1] > 1),
        telLinks: document.querySelectorAll('a[href^="tel:"]').length,
        imgsNoDims: [...document.querySelectorAll("img")].filter((i) => !i.getAttribute("width") || !i.getAttribute("height")).map((i) => i.src),
        imgsNoAlt: [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length,
        brokenImgs: [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== "lazy").map((i) => i.src),
      }));
      check(`${url} exactly one h1`, meta.h1 === 1, meta.h1);
      check(`${url} title and description present`, meta.title.length > 10 && meta.desc.length > 30);
      check(`${url} lang en-AU`, meta.lang === "en-AU");
      check(`${url} no skipped heading levels`, !meta.skipped);
      check(`${url} no click-to-call links`, meta.telLinks === 0);
      check(`${url} images have width/height and alt`, meta.imgsNoDims.length === 0 && meta.imgsNoAlt === 0, meta.imgsNoDims.join(", "));
      check(`${url} no broken images`, meta.brokenImgs.length === 0, meta.brokenImgs.join(", "));
      if (["/thank-you.html", "/404.html"].includes(url)) {
        check(`${url} is noindex and has no canonical`, /noindex/.test(meta.robots) && !meta.canonical);
      } else {
        check(`${url} canonical on production domain`, meta.canonical.startsWith("https://sydneytreeconnect.com/"), meta.canonical);
        notes.push(`${url} robots meta (staging): "${meta.robots}"`);
      }
      await page.evaluate(axeSource); // via DevTools, so the page CSP stays enforced
      const axe = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] });
        return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("; ")}`);
      });
      check(`${url} axe: no WCAG 2.1 AA / best-practice violations (incl. colour contrast)`, axe.length === 0, axe.join("\n        "));
      await page.close();
    }

    console.log("\nResponsive layouts");
    const sizes = [[360, 740, "mobile-360"], [390, 844, "mobile-390"], [768, 1024, "tablet-768"], [1024, 768, "tablet-1024"], [1440, 900, "desktop-1440"]];
    for (const [w, h, label] of sizes) {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      for (const url of ["/", "/privacy.html", "/thank-you.html"]) {
        await page.goto(BASE + url, { waitUntil: "networkidle0" });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(`${label} ${url} no horizontal scroll`, overflow <= 0, `overflow ${overflow}px`);
      }
      await page.goto(BASE + "/", { waitUntil: "networkidle0" });
      const info = await page.evaluate(() => {
        const img = document.querySelector(".hero__media img");
        const logo = document.querySelector(".brand img").getBoundingClientRect();
        const cta = document.querySelector(".site-header .button").getBoundingClientRect();
        return { src: img.currentSrc, loaded: img.complete && img.naturalWidth > 0, logoW: logo.width, logoH: logo.height, ctaRight: cta.right, vw: window.innerWidth, headerH: document.querySelector(".site-header").offsetHeight };
      });
      check(`${label} hero image loaded as WebP (${path.basename(info.src)})`, info.loaded && /\.webp$/.test(info.src));
      const hero = await page.evaluate(() => {
        const r = document.querySelector(".hero__media img").getBoundingClientRect();
        return { ratio: r.width / r.height, eager: document.querySelector(".hero__media img").loading !== "lazy", caption: document.querySelector(".hero__media figcaption").textContent };
      });
      check(`${label} hero not lazy-loaded, captioned as AI-generated`, hero.eager && /AI-generated illustrative image/.test(hero.caption), JSON.stringify(hero));
      await page.evaluate(() => document.getElementById("services").scrollIntoView());
      await page.waitForFunction(() => [...document.querySelectorAll(".card__figure img")].every((i) => i.complete && i.naturalWidth > 0), { timeout: 10000 }).catch(() => {});
      const svc = await page.evaluate(() => [...document.querySelectorAll(".card--media")].map((c) => {
        const img = c.querySelector("img");
        const r = img.getBoundingClientRect();
        return { title: c.querySelector("h3").textContent, src: img.currentSrc, loaded: img.complete && img.naturalWidth > 0, lazy: img.loading === "lazy", w: Math.round(r.width), h: Math.round(r.height), natural: img.naturalWidth, caption: c.querySelector("figcaption").textContent };
      }));
      check(`${label} removal and pruning images load lazily as WebP with AI caption`, svc.length === 2 && svc.every((x) => x.loaded && x.lazy && /\.webp$/.test(x.src) && /AI-generated illustrative image/.test(x.caption)) && /removal/.test(svc[0].src) && /pruning/.test(svc[1].src), JSON.stringify(svc));
      check(`${label} service images are sharp (source >= displayed width)`, svc.every((x) => x.natural >= x.w), JSON.stringify(svc.map((x) => [x.w, x.natural])));
      check(`${label} logo legible (>= 140px wide) and header CTA visible`, info.logoW >= 140 && info.ctaRight <= info.vw, JSON.stringify(info));
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(200);
      await page.screenshot({ path: path.join(shots, `${label}-home.png`), fullPage: true });
      if (w <= 390) await page.screenshot({ path: path.join(shots, `${label}-home-top.png`) });
      await page.close();
    }

    console.log("\nKeyboard and navigation");
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844 });
      await page.goto(BASE + "/", { waitUntil: "networkidle0" });
      await page.keyboard.press("Tab");
      let f = await page.evaluate(() => ({ cls: document.activeElement.className, top: document.activeElement.getBoundingClientRect().top }));
      check("First Tab focuses visible skip link", f.cls === "skip-link" && f.top >= 0, JSON.stringify(f));
      await page.keyboard.press("Enter");
      await sleep(200);
      const hashOk = await page.evaluate(() => location.hash === "#main");
      check("Skip link moves to main content", hashOk);
      await page.goto(BASE + "/", { waitUntil: "networkidle0" });
      const order = [];
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press("Tab");
        order.push(await page.evaluate(() => {
          const el = document.activeElement;
          const cs = getComputedStyle(el);
          return { label: el.getAttribute("aria-label") || el.textContent.trim().slice(0, 30), outline: cs.outlineStyle, width: cs.outlineWidth };
        }));
      }
      check("Focus outline visible on tabbed elements", order.slice(1).every((o) => o.outline !== "none" && parseFloat(o.width) >= 2), JSON.stringify(order));
      const menuBtn = await page.$(".nav-toggle");
      await menuBtn.click();
      const navOpen = await page.evaluate(() => ({ exp: document.querySelector(".nav-toggle").getAttribute("aria-expanded"), vis: getComputedStyle(document.getElementById("site-nav")).display !== "none" }));
      check("Mobile menu opens with aria-expanded=true", navOpen.exp === "true" && navOpen.vis);
      await page.click('#site-nav a[href="#faqs"]');
      await sleep(300);
      const closed = await page.evaluate(() => document.querySelector(".nav-toggle").getAttribute("aria-expanded"));
      check("Mobile menu closes after choosing a link", closed === "false");
      // FAQ disclosure works with keyboard
      await page.focus(".faq summary");
      await page.keyboard.press("Enter");
      check("FAQ opens with keyboard", await page.evaluate(() => document.querySelector(".faq details").open));
      await page.close();
    }

    console.log("\nNo-JavaScript fallback");
    {
      const page = await browser.newPage();
      await page.setJavaScriptEnabled(false);
      await page.setViewport({ width: 390, height: 844 });
      await page.goto(BASE + "/", { waitUntil: "networkidle0" });
      const r = await page.evaluate(() => ({ navVisible: getComputedStyle(document.getElementById("site-nav")).display !== "none", toggleHidden: getComputedStyle(document.querySelector(".nav-toggle")).display === "none", action: document.getElementById("enquiry-form").getAttribute("action") }));
      check("Without JS, nav links are visible and form posts to handler", r.navVisible && r.toggleHidden && r.action === "/api/enquiry.php");
      await page.close();
    }

    console.log("\nForm: client-side validation");
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    const formErrors = [];
    page.on("pageerror", (e) => formErrors.push(e.message));
    await page.goto(BASE + "/#enquiry", { waitUntil: "networkidle0" });
    await page.click("#submit-button");
    let st = await page.evaluate(() => ({
      summaryVisible: !document.getElementById("form-summary").hidden,
      focused: document.activeElement.id,
      items: document.querySelectorAll("#form-summary li").length,
      invalid: [...document.querySelectorAll('[aria-invalid="true"]')].map((e) => e.id),
    }));
    check("Empty submit shows error summary and moves focus to it", st.summaryVisible && st.focused === "form-summary", JSON.stringify(st));
    check("Empty submit flags required fields", ["name", "email", "suburb", "postcode", "service", "description", "property_authority", "council_status", "consent"].every((id) => st.invalid.includes(id)), st.invalid.join(","));
    await page.screenshot({ path: path.join(shots, "form-errors-mobile.png"), fullPage: false });

    await fillValid(page, { email: "bad@", postcode: "3000" });
    await page.click("#submit-button");
    st = await page.evaluate(() => ({ email: document.getElementById("email-error").textContent, postcode: document.getElementById("postcode-error").textContent }));
    check("Invalid email and non-NSW postcode rejected", /valid email/.test(st.email) && /NSW postcode/.test(st.postcode), JSON.stringify(st));

    await page.goto(BASE + "/", { waitUntil: "networkidle0" });
    await fillValid(page);
    await page.click('input[name="contact_method"][value="phone"]');
    await page.click("#submit-button");
    st = await page.evaluate(() => document.getElementById("phone-error").textContent);
    check("Phone preference requires a phone number", /phone number/.test(st), st);
    await page.click('input[name="contact_method"][value="email"]');
    st = await page.evaluate(() => document.getElementById("phone-error").textContent);
    check("Switching back to email clears the phone error", st === "", st);

    await page.goto(BASE + "/", { waitUntil: "networkidle0" });
    await fillValid(page);
    await page.click("#consent"); // untick
    await page.click("#submit-button");
    st = await page.evaluate(() => document.getElementById("consent-error").textContent);
    check("Missing consent blocks submission", /Tick the box/.test(st), st);

    const jpg = fs.readFileSync(path.join(root, "assets/images/services/tree-removal-800.jpg"));
    const six = Array.from({ length: 6 }, (_, i) => fixture(`p${i}.jpg`, jpg));
    await page.goto(BASE + "/", { waitUntil: "networkidle0" });
    await (await page.$("#photos")).uploadFile(...six);
    st = await page.evaluate(() => document.getElementById("photos-error").textContent);
    check("Selecting 6 photos shows the 5-photo limit", /up to 5/.test(st), st);
    await (await page.$("#photos")).uploadFile(fixture("drawing.svg", '<svg xmlns="http://www.w3.org/2000/svg"/>'));
    st = await page.evaluate(() => document.getElementById("photos-error").textContent);
    check("SVG upload rejected", /not a JPEG, PNG, WebP or HEIC/.test(st), st);
    await (await page.$("#photos")).uploadFile(fixture("big.heic", Buffer.alloc(4.5 * 1024 * 1024, 1)));
    st = await page.evaluate(() => document.getElementById("photos-error").textContent);
    check("HEIC over 4 MB rejected (cannot be resized in browser)", /larger than 4 MB/.test(st), st);

    console.log("\nForm: endpoint failures never show success");
    const failureCases = [
      ["HTTP 500 with HTML body", { status: 500, contentType: "text/html", body: "<h1>Server error</h1>" }],
      ["HTTP 200 but not JSON (e.g. static host without PHP)", { status: 200, contentType: "text/html", body: "<html>index</html>" }],
      ["HTTP 200 JSON ok:false", { status: 200, contentType: "application/json", body: '{"ok":false,"message":"Sorry, online enquiries are not available yet. Nothing has been sent."}' }],
      ["HTTP 404 (no handler deployed)", { status: 404, contentType: "text/html", body: "Not found" }],
      ["Network failure", "abort"],
    ];
    for (const [label, resp] of failureCases) {
      const p = await browser.newPage();
      await p.setViewport({ width: 1280, height: 800 });
      await p.setRequestInterception(true);
      p.on("request", (req) => {
        if (req.url().endsWith("/api/enquiry.php") && req.method() === "POST") {
          if (resp === "abort") req.abort("failed");
          else req.respond(resp);
        } else req.continue();
      });
      await p.goto(BASE + "/", { waitUntil: "networkidle0" });
      await fillValid(p);
      await p.click("#submit-button");
      await sleep(900);
      const res = await p.evaluate(() => ({ url: location.pathname, status: document.getElementById("form-status").textContent, cls: document.getElementById("form-status").className, btn: document.getElementById("submit-button").disabled }));
      check(`${label}: stays on form with error, button re-enabled`, res.url === "/" && /is-error/.test(res.cls) && res.status.length > 10 && !res.btn, JSON.stringify(res));
      if (label.startsWith("HTTP 500")) await p.screenshot({ path: path.join(shots, "form-endpoint-failure.png") });
      await p.close();
    }

    console.log("\nForm: server field errors are shown");
    {
      const p = await browser.newPage();
      await p.setRequestInterception(true);
      p.on("request", (req) => {
        if (req.url().endsWith("/api/enquiry.php") && req.method() === "POST") req.respond({ status: 422, contentType: "application/json", body: '{"ok":false,"message":"Please check the highlighted fields.","errors":{"email":"Enter a valid email address, like name@example.com."}}' });
        else req.continue();
      });
      await p.goto(BASE + "/", { waitUntil: "networkidle0" });
      await fillValid(p);
      await p.click("#submit-button");
      await sleep(600);
      const res = await p.evaluate(() => ({ err: document.getElementById("email-error").textContent, inv: document.getElementById("email").getAttribute("aria-invalid") }));
      check("422 field error from server displayed inline", /valid email/.test(res.err) && res.inv === "true", JSON.stringify(res));
      await p.close();
    }

    console.log("\nForm: duplicate-click prevention and loading state");
    {
      const p = await browser.newPage();
      let posts = 0;
      await p.setRequestInterception(true);
      p.on("request", async (req) => {
        if (req.url().endsWith("/api/enquiry.php") && req.method() === "POST") {
          posts++;
          await sleep(1500);
          req.respond({ status: 503, contentType: "application/json", body: '{"ok":false,"message":"Test failure."}' });
        } else req.continue();
      });
      await p.goto(BASE + "/", { waitUntil: "networkidle0" });
      await fillValid(p);
      await p.click("#submit-button");
      await sleep(100);
      const busy = await p.evaluate(() => ({ disabled: document.getElementById("submit-button").disabled, text: document.getElementById("submit-button").textContent, status: document.getElementById("form-status").textContent }));
      await p.$eval("#submit-button", (b) => b.click());
      await p.$eval("#enquiry-form", (f) => f.requestSubmit ? f.requestSubmit() : f.submit());
      await sleep(2200);
      check("Button disabled with 'Sending…' while submitting", busy.disabled && /Sending/.test(busy.text) && /Sending your enquiry/.test(busy.status), JSON.stringify(busy));
      check("Repeated clicks/submits send only one request", posts === 1, `posts=${posts}`);
      await p.close();
    }

    console.log("\nForm: real local submission (PHP handler + SMTP sink)");
    {
      const p = await browser.newPage();
      await p.setViewport({ width: 390, height: 844 });
      await p.goto(BASE + "/", { waitUntil: "networkidle0" });
      await fillValid(p, { phone: "0400 111 222" });
      await p.click('input[name="contact_method"][value="phone"]');
      // A ~5.9 MB noise PNG is over the 4 MB limit, so it must be resized to
      // JPEG in the browser before upload for this submission to succeed.
      const bigPng = path.join(tmp, "garden.png");
      require("child_process").execFileSync(py, ["-c", "import sys,os;from PIL import Image;Image.frombytes('RGB',(1400,1400),os.urandom(1400*1400*3)).save(sys.argv[1])", bigPng]);
      check("Fixture PNG is over 4 MB", fs.statSync(bigPng).size > 4 * 1024 * 1024, fs.statSync(bigPng).size);
      await (await p.$("#photos")).uploadFile(six[0], bigPng);
      await Promise.all([p.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }), p.click("#submit-button")]);
      check("Accepted response redirects to /thank-you.html", new URL(p.url()).pathname === "/thank-you.html", p.url());
      await sleep(300);
      const files = fs.existsSync(mailDir) ? fs.readdirSync(mailDir) : [];
      const eml = files.length ? fs.readFileSync(path.join(mailDir, files[files.length - 1]), "utf8") : "";
      check("Email captured by local SMTP sink with 2 attachments", files.length === 1 && (eml.match(/Content-Disposition: attachment/g) || []).length === 2, `files=${files.length}`);
      check("Email body records phone preference and consent", /Preferred contact method: Phone/.test(eml) && /Consent given: Yes/.test(eml));
      await p.screenshot({ path: path.join(shots, "thank-you-mobile.png"), fullPage: true });
      await p.close();
    }
    check("No script errors during form tests", formErrors.length === 0, formErrors.join(" | "));
    await page.close();

    console.log("\nInternal links and anchors");
    {
      const p = await browser.newPage();
      const hrefs = new Set();
      for (const url of pages) {
        await p.goto(BASE + url, { waitUntil: "domcontentloaded" });
        (await p.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")))).forEach((h) => hrefs.add(`${url}|${h}`));
      }
      const ids = {};
      for (const url of ["/"]) {
        await p.goto(BASE + url, { waitUntil: "domcontentloaded" });
        ids[url] = await p.$$eval("[id]", (els) => els.map((e) => e.id));
      }
      const bad = [];
      const external = new Set();
      const mailto = new Set();
      for (const entry of hrefs) {
        const [from, h] = entry.split("|");
        if (/^mailto:/i.test(h)) {
          mailto.add(h);
          continue;
        }
        if (/^https?:\/\//.test(h)) {
          external.add(h);
          continue;
        }
        const u = new URL(h, BASE + from);
        const r = await fetch(u.origin + u.pathname);
        if (r.status !== 200) bad.push(`${from} -> ${h} (${r.status})`);
        if (u.hash) {
          const target = u.pathname === "/" ? "/" : null;
          if (target && !ids[target].includes(u.hash.slice(1))) bad.push(`${from} -> ${h} (missing anchor)`);
          if (!target && u.pathname === from && !(await p.goto(BASE + from), await p.$(u.hash))) bad.push(`${from} -> ${h} (missing anchor)`);
        }
      }
      check(`All internal links and anchors resolve (${hrefs.size} checked)`, bad.length === 0, bad.join("\n        "));
      check("Email links use only the confirmed privacy address", mailto.size > 0 && [...mailto].every((h) => h === "mailto:sydneytree278@gmail.com"), [...mailto].join(", "));
      fs.writeFileSync(path.join(shots, "external-links.txt"), [...external].join("\n") + "\n");
      await p.close();
    }
  } finally {
    await browser.close();
    for (const p of procs) p.kill();
  }

  console.log("\nNotes:\n  " + notes.join("\n  "));
  console.log(`\n${passed} passed, ${failed} failed. Screenshots: ${shots}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
})();
