# Sydney Tree Connect

Source for **https://sydneytreeconnect.com**, an enquiry and referral website for tree removal, pruning and stump grinding enquiries across Sydney. Visitors submit an enquiry. The operator receives it by email and forwards it manually to a tree contractor, who contacts the customer, assesses the job, checks permissions, quotes and arranges the work directly.

The site does **not** carry out tree work and displays **no business phone number**.

> **Status: live, with the enquiry form enabled (delivery verified 4 Nov 2026).** The home page is indexable. The privacy notice and terms are drafts and stay noindex until the owner decisions are resolved. See [docs/launch-checklist.md](docs/launch-checklist.md) and run `node scripts/prelaunch-check.mjs`.

## What's here

```
index.html            Home: hero, services, how it works, guidance, coverage, FAQs, enquiry form
privacy.html          Draft privacy notice (owner placeholders highlighted)
terms.html            Draft referral terms (owner placeholders highlighted)
thank-you.html        Shown only after the handler accepts an enquiry (noindex)
404.html              Helpful not-found page (noindex)
api/enquiry.php       Form handler: validation, spam checks, rate limit, email via SMTP
api/lib/PHPMailer/    PHPMailer 7.1.1 (LGPL-2.1), vendored, blocked from direct access
assets/css/styles.css Site styles
assets/js/main.js     Mobile nav, form validation, photo resizing, submission
assets/fonts/         Figtree variable font (latin subset, SIL OFL)
assets/images/        brand/ (logo), hero/ and services/ (responsive WebP + JPEG fallback), social/ (share image)
favicon.*, icon-*.png, apple-touch-icon.png, site.webmanifest
robots.txt, sitemap.xml, .htaccess
docs/                 image-prompts.md, content-sources.md, launch-checklist.md
scripts/              Brand/hero asset builders and the pre-launch check
tests/                Server and browser test suites, local router and SMTP sink
.env.example          Form configuration template (dummy values only)
```

There's no build step and no framework. Pages are plain HTML. Header and footer markup is repeated in each page, so change all five pages together.

## Brand

| Use | Colour |
| --- | --- |
| Forest green (primary, buttons, footer tint) | `#1F5135` |
| Deep green (footer, hovers) | `#143823` |
| Leaf green (logo symbol on light) | `#2F6B45` |
| Sage (logo symbol and “Connect” on dark) | `#A9C8A4` |
| Warm white (background, light wordmark) | `#FAF7F0` |
| Charcoal (text, wordmark “Sydney Tree”) | `#23272A` |
| Soft charcoal (secondary text) | `#4A5157` |

**Typeface:** Figtree (Erik Kennedy, SIL Open Font License 1.1), self-hosted as one variable WOFF2 file (weights 400 to 800, latin subset). The wordmark is Figtree at weight 720, converted to vector outlines with kerning applied, so it never depends on an installed font. Body text falls back to the system UI font.

**Logo files** (`assets/images/brand/`):

- `stc-logo-horizontal.svg` / `.png` / `@3x.png`: symbol plus wordmark, for light backgrounds (header).
- `stc-logo-horizontal-light.svg` / `.png` / `@3x.png`: for dark backgrounds (footer).
- `stc-symbol.svg`, `stc-symbol-512.png`, `stc-symbol-light.svg`, `stc-symbol-light-512.png`: standalone symbol. These are transparent.
- `stc-app-icon.svg`, `stc-app-icon-maskable.svg`: symbol on a forest-green tile for favicons and app icons.
- Root: `favicon.ico` (16/32/48), `favicon.svg`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.

The symbol is a single leaf whose veins end in small nodes, a quiet “connection” idea. It was checked at 16 px on light and dark tabs and at the mobile header size (144 × 25 px). To regenerate after a change, run `python scripts/build-brand.py`, then `node scripts/render-brand-png.cjs` (needs `npm i puppeteer-core` and Chrome or Edge).

**Imagery:** the hero and the Tree removal and Tree pruning cards use owner-supplied images. Their C2PA credentials show they were made with ChatGPT image generation, so each one is captioned “AI-generated illustrative image”. The originals, with credentials intact, are in `scripts/source/images/`, which isn't served. `python scripts/build-images.py` rebuilds the WebP files (with JPEG fallbacks) and the social image. See [docs/image-prompts.md](docs/image-prompts.md).

## Local preview

Pages only (the form will show its “could not reach the enquiry service” error, which is expected):

```sh
python -m http.server 8080
# open http://localhost:8080
```

With the PHP handler (PHP 8.1+ with fileinfo, mbstring and openssl). On PHP's local dev server, the handler reads the git-ignored `private/stc-enquiry.env` automatically. With the real Gmail settings and `ENQUIRY_ENABLED=true`, **local submissions send real email**. Windows builds of PHP need a CA bundle to verify Gmail's certificate; Git for Windows includes one:

```sh
php -d "openssl.cafile=C:\Program Files\Git\mingw64\etc\ssl\certs\ca-bundle.crt" -S 127.0.0.1:8080 tests/router.php
# open http://127.0.0.1:8080 (this origin is allowed in the local settings file)
```

Setting `STC_ENV_FILE` makes the handler use only that file, which the test suites rely on so they never touch the real settings:

```sh
php -S 127.0.0.1:8080 tests/router.php
# the form returns "not available yet" until STC_ENV_FILE points at a config file
```

To try a full submission locally without sending real email, run the local SMTP sink and point a test env file at it:

```sh
python tests/smtp-sink.py 2525 ./tests/output/mail
# test.env: ENQUIRY_ENABLED=true, SMTP_HOST=127.0.0.1, SMTP_PORT=2525, SMTP_SECURE=none,
#           ALLOWED_ORIGINS=http://127.0.0.1:8080, plus the other keys from .env.example
STC_ENV_FILE=./tests/output/test.env php -S 127.0.0.1:8080 tests/router.php
```

`tests/output/` is git-ignored.

## Hosting

### Recommended: Hostinger (or any Apache/LiteSpeed host with PHP)

1. Upload the repository contents to `public_html` for sydneytreeconnect.com, either with hPanel > Git (connect the GitHub repo and deploy to `public_html`) or with File Manager/SFTP. The whole repo can be deployed: `.htaccess` returns 404 for `docs/`, `scripts/`, `tests/`, `api/lib/`, dotfiles and `.md`/`.env`/script files.
2. Set the PHP version to 8.1 or newer in hPanel, and check the PHP limits listed in the launch checklist.
3. Configure the form (below).

### Static-only hosts (GitHub Pages, Netlify/Cloudflare Pages without functions)

The pages will work, but **the form cannot send email** because these hosts can't run `api/enquiry.php`. The form will show an error, never a false success. You would need to replace the handler with a server-side function or a hosted form service that meets the same rules: server-side validation, file-type checks, private photo handling, fixed sender, consent record. Update `action` on the form and the privacy notice accordingly. GitHub stores the source only. Don't assume GitHub Pages is the host.

## Form configuration

The handler emails each enquiry, with photos as attachments, to the **owner's inbox**, never directly to the contractor. It uses authenticated SMTP through the vendored PHPMailer.

**Confirmed setup (owner, 4 Nov 2026):** one Gmail account both sends and receives enquiries, through Gmail SMTP with a Google App Password. The settings, including the App Password, are in `private/stc-enquiry.env` inside the project folder. That folder is **git-ignored** (never committed), returns 404 over the web (`.htaccess`), and is only read when running PHP's local dev server. On the live host the handler reads only `domains/sydneytreeconnect.com/private/stc-enquiry.env`, outside `public_html`. **Never upload the project's `private/` folder into `public_html`.** If you deploy by File Manager or FTP rather than Git, skip it, along with `docs/`, `scripts/` and `tests/`. A ready-to-upload production copy is in `private/production/stc-enquiry.env` (also git-ignored): the same App Password, production origins only, its own rate-limit secret and `ENQUIRY_ENABLED=true`. Set it to `false` on the server to switch the form off.

Settings in the private file:

| Setting | Value |
| --- | --- |
| `ENQUIRY_TO`, `MAIL_FROM`, `SMTP_USER` | The Gmail address. All three must be the same: Gmail sends as the signed-in account. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | `smtp.gmail.com` / `465` / `ssl`. Fallback if port 465 is blocked: `587` / `tls`. |
| `SMTP_PASS` | The 16-letter Google App Password, **not** the normal Gmail password. It's fine to paste it with or without the spaces Google shows. |
| `RATE_LIMIT_SECRET` | Already generated (random, private). |
| `ENQUIRY_ENABLED` | `true` on the live server (delivery verified 4 Nov 2026). Set `false` to switch the form off. |

### Gmail SMTP setup, step by step

Never paste the App Password into chat, email, a ticket or any file inside the project folder or GitHub. It only goes in the private file on the server.

1. **Turn on 2-Step Verification** for the Gmail account: Google Account > Security > 2-Step Verification. App Passwords aren't offered without it.
2. **Create an App Password:** go to https://myaccount.google.com/apppasswords while signed in to the Gmail account, name it “Sydney Tree Connect website”, and select Create. Google shows a 16-letter password once. Keep the window open for step 4. If the page says the setting isn't available, check that 2-Step Verification is on, and note that Advanced Protection accounts can't use App Passwords.
3. **Create the private folder** in hPanel > File Manager, next to (not inside) `public_html`: `domains/sydneytreeconnect.com/private/`.
4. **Upload** `private/production/stc-enquiry.env` from the project into that folder (hPanel File Manager > Upload). Keep the name `stc-enquiry.env`. Don't upload the local `private/stc-enquiry.env`: it allows local origins. If you ever create a new App Password, paste it into `SMTP_PASS` in the File Manager editor, never in chat.
5. **Set permissions** on the file to `600` (File Manager > Permissions).
6. **Check the PHP settings** in hPanel > Advanced > PHP Configuration: PHP 8.1 or newer, `upload_max_filesize` ≥ 8M, `post_max_size` ≥ 20M, `max_file_uploads` ≥ 5, `display_errors` Off.
7. **Test:** the production copy is already `ENQUIRY_ENABLED=true`. Send dummy enquiries from the live site: one with no photos, one with 5 photos, and one preferring phone.
8. **Check Gmail.** Each enquiry should show the subject “Tree enquiry STC-…”, every field, the consent record, the photos, and the customer's address when you press Reply. Messages you send to yourself normally appear in the Inbox. If they don't, look in All Mail or Sent.
9. **If nothing arrives,** the site shows “could not be sent right now” and the reason is in hPanel's PHP error log, starting `[stc-enquiry] Send failed`. Common causes:
   - Wrong or revoked App Password: create a new one.
   - Spaces or quotes typed around the value.
   - Port 465 blocked: try `SMTP_PORT=587` and `SMTP_SECURE=tls`.
   - Hostinger blocking outbound SMTP to Gmail: ask Hostinger support.

   Set `ENQUIRY_ENABLED=false` again while you fix it.
10. **Only after real enquiries have arrived** should the form stay enabled. Record the date in docs/launch-checklist.md.

**Good practice for the Gmail account:** it will hold customer details and photos, so keep 2-Step Verification on and limit who can sign in. Add a Gmail filter for `subject:"Tree enquiry STC-"` that applies a label and “Never send it to Spam”. Forward each enquiry to the contractor from Gmail; attachments are included. Revoke the App Password at https://myaccount.google.com/apppasswords if the website is retired or the password may have been exposed. Changing the main Google password also revokes App Passwords, so you would then need to create a new one. Gmail accepts messages up to 25 MB, and the photo limits (12 MB in total, about 16 MB once encoded) stay under that.

**Other hosting setups:** to send through a mailbox on the domain instead, set `MAIL_FROM`/`SMTP_USER` to that mailbox and use `smtp.hostinger.com`, `465`, `ssl`. You'd then also need SPF, DKIM and DMARC records for the domain. The handler looks for the private file at `../../private/stc-enquiry.env` relative to `api/`. To use another location, set the `STC_ENV_FILE` environment variable.

**How it behaves**

- Success only after the SMTP server accepts the message. JavaScript users then go to `/thank-you.html`. Without JavaScript, the handler redirects there.
- If the config file is missing, or `ENQUIRY_ENABLED` isn't `true`, the form replies “online enquiries are not available yet”. SMTP failures reply “could not be sent right now”. Neither shows success.
- **Validation** runs in the browser for accessibility and again on the server: required fields, email, phone format, a phone number when phone is preferred, 4-digit NSW postcode, allowed values only, length limits and consent.
- **Photos:** optional, at most 5, each at most **4 MB**, at most **12 MB** in total. Types are checked by reading the actual file content: JPEG, PNG, WebP or HEIC/HEIF. JPEG/PNG/WebP must also decode as images. SVG, GIF, executables and everything else are refused. In the browser, JPEG/PNG/WebP photos over 1.5 MB are resized to a 2000 px long edge, which also strips location metadata. Photos are attached to the email and **never stored on the website**. PHP deletes its temporary upload files when the request ends.
- **Spam and abuse:** a hidden honeypot field, a minimum fill time of 4 seconds, an Origin check, and file-based rate limits (5 per hour and 15 per day per connection, 200 per day overall). Rate-limit records are keyed by an HMAC of the IP, not the IP itself, and are deleted after about 2 days.
- **Email safety:** a fixed sender (`From`, the Gmail account), the customer's validated address only in `Reply-To`, control characters stripped from every single-line field, plain-character display names, and attachment names generated by the server.
- **Consent record:** each email includes the consent wording and version, a timestamp in Sydney time, the IP address and the browser.
- **Errors** shown to visitors are generic. Details go to the PHP error log without customer data.

**Retention, access and deletion.** Enquiries exist only as emails: in the owner inbox, plus any copies forwarded to the contractor. To delete an enquiry, delete the email and its forwarded copy from Sent, then empty Trash. Ask the contractor to delete their copy if the customer requests it. Because the same Gmail account sends and receives, each enquiry is in both the Inbox and Sent, so delete both. Gmail empties Trash automatically after 30 days; use “Delete forever” to remove an enquiry sooner. Protect the account with 2-Step Verification and limit who can sign in. Set and publish a retention period in privacy.html. Server access logs are kept by the host under its own retention settings (hPanel > Advanced > Access logs).

## DNS and HTTPS

- If the domain and hosting are both at Hostinger, the default nameservers handle everything. Otherwise point the apex `A` record and `www` `CNAME` (or `A`) to the hosting values shown in hPanel.
- Email records: the form sends through Gmail as the Gmail account, so SPF/DKIM/DMARC records for sydneytreeconnect.com are not needed for enquiries. Add them only if you later send email from a mailbox on the domain.
- Install or confirm the free SSL certificate in hPanel for both `sydneytreeconnect.com` and `www.sydneytreeconnect.com`.
- `.htaccess` redirects `http://` and `www.` to `https://sydneytreeconnect.com/` only on the production host name, so temporary preview domains still work. HSTS is commented out. Enable it once HTTPS is stable.
- DNS changes can take up to 24 to 48 hours to propagate.

## Search Console and SEO

- All canonical URLs, Open Graph URLs, structured data and the sitemap use `https://sydneytreeconnect.com`.
- Structured data describes a WebSite only (no Organization, address, phone, rating or arborist claims).
- **Indexing (4 Nov 2026):** the home page is indexable and is the only URL in sitemap.xml. privacy.html and terms.html keep a `STAGING-NOINDEX` robots meta tag until they are approved. thank-you.html and 404.html are always noindex. robots.txt blocks only `/api/`, so crawlers can read those noindex tags.
- After launch: add a Domain property in Google Search Console, verify it by DNS, submit `/sitemap.xml`, and request indexing of the home page with URL Inspection. Requesting indexing doesn't guarantee indexing or rankings, and first-page ranking is a goal, not a promise.
- Future pages: write genuinely useful service or guidance pages, and location pages only for confirmed coverage with original content. Don't create many near-identical suburb pages.

## Testing

Both suites use dummy enquiries and a local SMTP sink. **Nothing is sent to a real inbox.**

```sh
# Server-side handler (68 checks): validation, phone preference, file count/size/type
# (SVG, executable and corrupt files disguised as JPEG), consent, honeypot, timing,
# origin, rate limit, post_max_size, SMTP rejection, SMTP unreachable, success email contents,
# SMTP authentication (App Password with spaces, missing password, same From/To)
PHP_BIN=php node tests/server-tests.mjs

# Browser (125 checks, headless Chrome/Edge): console errors, failed requests, one h1,
# metadata, axe-core WCAG 2.1 AA including contrast, 5 viewports with no horizontal
# scroll, hero and service images (WebP, lazy-loading, AI captions, sharpness), logo size, keyboard/skip link/focus outlines, mobile menu,
# no-JS fallback, form validation, file limits, endpoint failures (500, non-JSON, ok:false,
# 404, network), duplicate-click prevention, a real local submission, internal links
npm i --prefix /tmp/stc-tools puppeteer-core axe-core
PHP_BIN=php NODE_PATH=/tmp/stc-tools/node_modules node tests/browser-tests.cjs tests/output

# Launch readiness
node scripts/prelaunch-check.mjs
```

**Delivery status:** local delivery through Gmail SMTP was **verified on 4 Nov 2026**: three test enquiries sent from the local dev server arrived in Gmail with correct details, attachments and Reply-To. **Live delivery from Hostinger was verified on 4 Nov 2026** (owner confirmed): STC-20261104-62F53D (no photos) and STC-20261104-EFFAC1 (5 photos, phone preferred) arrived complete, with working attachments and Reply-To. The live form is enabled.

## Security notes for GitHub

- Never commit `.env` files, the private env file, customer emails, uploaded photos, rate-limit data or contractor agreements. `.gitignore` covers the usual names.
- Before each commit, review `git diff --cached` for secrets. `node scripts/prelaunch-check.mjs` also flags credential-like strings.
- The SMTP password lives only in the private env file on the server.

## Licences

- Figtree font: SIL Open Font License 1.1 (`assets/fonts/Figtree-OFL.txt`).
- PHPMailer: LGPL-2.1 (`api/lib/PHPMailer/LICENSE`).
- Site code, copy and logo: created for Sydney Tree Connect.
- Photographic images: AI-generated with ChatGPT and supplied by the owner (see docs/image-prompts.md).
