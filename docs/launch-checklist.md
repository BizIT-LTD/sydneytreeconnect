# Launch checklist

Last updated: 4 November 2026. The site is live at https://sydneytreeconnect.com (still noindex) and the repository is at https://github.com/BizIT-LTD/sydneytreeconnect (branch `main`).

Work through this list in order. `node scripts/prelaunch-check.mjs` checks the file-based items and exits with an error while any blocker remains.

## 1. Owner information (launch blockers)

- [ ] Operator legal or trading name. Still a placeholder in privacy.html and terms.html (“About us”). The footer line was removed on 4 Nov 2026 until it is supplied. When it is, add back to the first footer column of all five pages, after the description paragraph: `<p>Operated by NAME, ABN 00 000 000 000.</p>`. Don't use the brand “Sydney Tree Connect” as the legal operator.
- [ ] ABN, if applicable. Placeholder in privacy.html and terms.html, and not shown in the footer. If there is no ABN, delete the “, ABN …” text and leave it out of the footer line.
- [x] Privacy contact email: sydneytree278@gmail.com (owner, 4 Nov 2026), linked in privacy.html and in every page footer.
- [ ] General contact email for terms.html (“Questions about these terms”). Still a placeholder: the privacy address, or another one.
- [ ] Business-name and trade mark checks for “Sydney Tree Connect”. Owning the domain doesn't confirm these.
- [ ] Contractor identity and written agreement to receive enquiries. Record how they will handle and delete customer data.
- [ ] Services the contractor confirms. Remove any unconfirmed card in the Services section of index.html, and the matching option in the form `<select>` and in `STC_SERVICES` in api/enquiry.php. Then delete the `data-provisional-service` attributes and the PROVISIONAL SERVICES comment.
- [ ] Coverage. Add regions only after the contractor confirms them in writing, using the commented COVERAGE template in index.html.
- [ ] Typical forwarding or response time. The placeholders were removed from the home page FAQ and the thank-you page on 4 Nov 2026; both still say forwarding is manual and not instant. If you commit to a time, add it there and in terms.html, where the response-time placeholder remains.
- [x] Two-factor authentication on the enquiry Gmail account (confirmed by the owner, 4 Nov 2026; stated in privacy.html).
- [ ] Retention period for enquiry emails, who has inbox access, overseas storage by providers, and how deletion requests are handled (privacy.html).
- [ ] Referral fee or other benefit from the contractor. Disclose it plainly in terms.html, or state that there is none.
- [ ] Any qualification or insurance claim you want to add. Verify it first and record the evidence in docs/content-sources.md. None are currently made.
- [ ] Final privacy notice and referral terms approval. Consider a legal review, then remove the yellow draft banners.

## 2. Form delivery (live and verified, 4 Nov 2026)

- [x] Hosting runs the PHP handler: the live `/api/enquiry.php` answers GET with 405 and a disabled-config POST with 503 (checked 4 Nov 2026). GitHub Pages and other static-only hosts cannot run it.
- [x] Enquiry account confirmed by the owner (4 Nov 2026): one Gmail account both sends and receives, through Gmail SMTP with an App Password. Local settings, including the App Password, are in `private/stc-enquiry.env`. It is git-ignored, blocked from web access, and read only by PHP's local dev server. The production copy is `private/production/stc-enquiry.env` (also git-ignored): production origins only, its own rate-limit secret, `ENQUIRY_ENABLED=true`.
- [x] 2-Step Verification on and App Password created by the owner, saved only in `private/stc-enquiry.env` (4 Nov 2026).
- [x] Gmail SMTP login verified locally over TLS with certificate verification, without sending (4 Nov 2026).
- [x] **Local Gmail delivery verified (4 Nov 2026, confirmed by the owner).** Three test enquiries were sent from the local PHP dev server: STC-20261104-024C2A (no photos), STC-20261104-A6D1D2 (3 photos: JPEG, WebP, PNG) and STC-20261104-4C216D (browser form, phone preferred, 1 photo). All arrived in Gmail with the correct details and attachments, and Reply-To went to the customer address.
- [x] Production settings uploaded to `domains/sydneytreeconnect.com/private/stc-enquiry.env`, beside `public_html`, permissions 600 (owner, 4 Nov 2026). The live handler loads it: an incomplete test post returns 422, not 503. `ENQUIRY_ENABLED=true`; set it to `false` there to switch the form off. Never upload the project's `private/` folder into `public_html`, and never share the App Password in chat or commit it.
- [ ] In Gmail, add a filter for `subject:"Tree enquiry STC-"` with “Never send it to Spam”.
- [ ] PHP limits in hPanel > Advanced > PHP Configuration: `upload_max_filesize` ≥ 8M, `post_max_size` ≥ 20M, `max_file_uploads` ≥ 5, `display_errors` Off.
- [x] **Live Hostinger delivery verified (4 Nov 2026, confirmed by the owner).** Two test enquiries were posted to https://sydneytreeconnect.com/api/enquiry.php: STC-20261104-62F53D (no photos, email preferred) and STC-20261104-EFFAC1 (5 photos: 2 JPEG, 2 WebP, 1 PNG; phone preferred). Both arrived in Gmail with complete details and the consent record, all five attachments open, and Reply-To went to the customer address. Hostinger allows outbound SMTP to smtp.gmail.com on port 465. A post from another origin is rejected (403). If delivery later fails, set `ENQUIRY_ENABLED=false` and check the PHP error log for `[stc-enquiry] Send failed`.
- [x] **Live delivery confirmed on:** 4 November 2026, by the owner.
- [x] Wrong credentials show the error message, not success (4 Nov 2026). Tested in isolation, never on the live config: a throwaway copy of the settings with one wrong App Password letter was rejected by real Gmail, the handler returned 502 “could not be sent… Nothing has been sent”, the log recorded the authentication failure, and the password appeared in neither.
- [x] Live web access blocked (4 Nov 2026): 31 private and repository paths, including case, encoded and `../` variants, return 404 or 403 and no response contains a setting.
- [x] Env file location confirmed by the owner (4 Nov 2026): `domains/sydneytreeconnect.com/private/`, outside `public_html`. The live URL checks covered `/private/stc-enquiry.env`, `/stc-enquiry.env`, `/.env.example`, `/README.md`, `/docs/`, `/scripts/`, `/tests/` and `/api/lib/PHPMailer/PHPMailer.php` on the live host; all return 404.

## 3. Hosting, DNS and HTTPS

- [x] sydneytreeconnect.com and www point at Hostinger; the deployed pages, CSS and JS match the repository (4 Nov 2026).
- [x] Let's Encrypt certificate covers the apex and www, valid until 1 Feb 2027. Hostinger renews it automatically; check it after renewal.
- [x] `http://`, `http://www.` and `https://www.` redirect (301) to `https://sydneytreeconnect.com/`.
- [x] Live browser check (4 Nov 2026): no console or CSP errors, no failed requests, axe WCAG 2.1 AA clean on all pages, no horizontal scroll at 360 to 1440 px, WebP hero and service images with their AI captions, all links and assets 200.
- [x] Repository pushed to https://github.com/BizIT-LTD/sydneytreeconnect (`main`). `private/` is git-ignored and untracked. Keep deploying only tracked files so `private/` never reaches `public_html`.
- [ ] After HTTPS has worked reliably for a few days, consider enabling the HSTS header in .htaccess.

## 4. Make the site indexable (only after sections 1 to 3 are done)

- [ ] Remove the two `STAGING-NOINDEX` lines (comment and meta tag) from index.html, privacy.html and terms.html. Keep the noindex tags on thank-you.html and 404.html.
- [ ] Remove `Disallow: /thank-you.html` from robots.txt. While robots.txt blocks the page, Google can't read its noindex tag and may still list the URL. The noindex meta tag alone keeps it out of results.
- [ ] Update `<lastmod>` dates in sitemap.xml.
- [ ] Run `node scripts/prelaunch-check.mjs` and confirm 0 blockers.
- [ ] Run the tests (README, “Testing”).

## 5. Google Search Console

- [ ] Add a Domain property for sydneytreeconnect.com and verify it with the DNS TXT record.
- [ ] Submit `https://sydneytreeconnect.com/sitemap.xml`.
- [ ] Use URL Inspection on the home page and select “Request indexing”. Indexing and rankings are not guaranteed, and requesting indexing repeatedly doesn't speed it up.
- [ ] Check the Page indexing and Core Web Vitals reports after a couple of weeks.

## 6. After launch

- [ ] Delete enquiry emails according to the stated retention period.
- [ ] Re-check the official tree guidance at least every 6 months and update docs/content-sources.md.
- [ ] Add real project examples only with the customer's and contractor's permission. Never use AI or stock images as evidence of work.
- [ ] Plan any new service or location pages around genuinely useful, original content and confirmed coverage. Avoid near-identical suburb pages.
