# Launch checklist

Work through this list in order. `node scripts/prelaunch-check.mjs` checks the file-based items and exits with an error while any blocker remains.

## 1. Owner information (launch blockers)

- [ ] Operator legal or trading name. Fill in the footer of every page, privacy.html and terms.html. Don't infer it from the brand name.
- [ ] ABN, if applicable. If there is no ABN, delete the “, ABN …” text.
- [ ] Privacy contact email, ideally on the domain, such as privacy@sydneytreeconnect.com.
- [ ] Business-name and trade mark checks for “Sydney Tree Connect”. Owning the domain doesn't confirm these.
- [ ] Contractor identity and written agreement to receive enquiries. Record how they will handle and delete customer data.
- [ ] Services the contractor confirms. Remove any unconfirmed card in the Services section of index.html, and the matching option in the form `<select>` and in `STC_SERVICES` in api/enquiry.php. Then delete the `data-provisional-service` attributes and the PROVISIONAL SERVICES comment.
- [ ] Coverage. Add regions only after the contractor confirms them in writing, using the commented COVERAGE template in index.html.
- [ ] Typical forwarding or response time, or delete those placeholder sentences if you can't commit to one (FAQ, thank-you page, terms).
- [ ] Retention period for enquiry emails, who has inbox access, two-factor authentication, overseas storage by providers, and how deletion requests are handled (privacy.html).
- [ ] Referral fee or other benefit from the contractor. Disclose it plainly in terms.html, or state that there is none.
- [ ] Any qualification or insurance claim you want to add. Verify it first and record the evidence in docs/content-sources.md. None are currently made.
- [ ] Final privacy notice and referral terms approval. Consider a legal review, then remove the yellow draft banners.

## 2. Form delivery (launch blocker)

- [ ] Hosting supports PHP 8.1+ with fileinfo, mbstring and openssl. Hostinger shared hosting does. GitHub Pages and other static-only hosts cannot run the handler.
- [x] Enquiry account confirmed by the owner (4 Nov 2026): one Gmail account both sends and receives, through Gmail SMTP with an App Password. Local settings, including the App Password, are in `private/stc-enquiry.env`. It is git-ignored, blocked from web access, and read only by PHP's local dev server. The live copy goes outside `public_html` and stays `ENQUIRY_ENABLED=false` until real delivery is confirmed.
- [x] 2-Step Verification on and App Password created by the owner, saved only in `private/stc-enquiry.env` (4 Nov 2026).
- [x] Gmail SMTP login verified locally over TLS with certificate verification, without sending (4 Nov 2026).
- [x] **Local Gmail delivery verified (4 Nov 2026, confirmed by the owner).** Three test enquiries were sent from the local PHP dev server: STC-20261104-024C2A (no photos), STC-20261104-A6D1D2 (3 photos: JPEG, WebP, PNG) and STC-20261104-4C216D (browser form, phone preferred, 1 photo). All arrived in Gmail with the correct details and attachments, and Reply-To went to the customer address.
- [ ] Upload a copy of `private/stc-enquiry.env` to `domains/sydneytreeconnect.com/private/stc-enquiry.env`, outside `public_html`. Remove the local `http://` origins from `ALLOWED_ORIGINS`, set `ENQUIRY_ENABLED=false`, and set permissions to 600. Never upload the project's `private/` folder into `public_html`, and never share the App Password in chat or commit it.
- [ ] In Gmail, add a filter for `subject:"Tree enquiry STC-"` with “Never send it to Spam”.
- [ ] PHP limits in hPanel > Advanced > PHP Configuration: `upload_max_filesize` ≥ 8M, `post_max_size` ≥ 20M, `max_file_uploads` ≥ 5, `display_errors` Off.
- [ ] **Live Hostinger delivery (not yet tested, launch blocker):** after deployment, temporarily set `ENQUIRY_ENABLED=true` in the live settings file and send test enquiries from https://sydneytreeconnect.com (no photos, 5 photos, phone preference). Confirm each one arrives in Gmail with all fields, the consent record, a working Reply-To and the attachments. If any fails, set it back to `false` and check the PHP error log. Hostinger must allow outbound SMTP to smtp.gmail.com; local success doesn't prove that.
- [ ] **Live delivery confirmed on:** ____ (date, by whom). Until this is filled in, delivery from the live host counts as untested.
- [ ] Confirm a deliberately broken config (for example one wrong letter in the App Password) shows the error message on the site, not success. Then restore it.
- [ ] Confirm the private env file is in `domains/sydneytreeconnect.com/private/`, outside `public_html`, so it has no URL. Also confirm `/private/stc-enquiry.env`, `/.env.example`, `/README.md`, `/docs/`, `/scripts/`, `/tests/` and `/api/lib/PHPMailer/PHPMailer.php` all return 404 on the live host.

## 3. Hosting, DNS and HTTPS

- [ ] Point sydneytreeconnect.com (and www) at the hosting. See README, “DNS and HTTPS”.
- [ ] SSL certificate active for both the apex and www.
- [ ] `http://` and `www.` redirect to `https://sydneytreeconnect.com/` (rules in .htaccess).
- [ ] After HTTPS has worked reliably for a few days, consider enabling the HSTS header in .htaccess.

## 4. Make the site indexable (only after sections 1 to 3 are done)

- [ ] Remove the two `STAGING-NOINDEX` lines (comment and meta tag) from index.html, privacy.html and terms.html. Keep the noindex tags on thank-you.html and 404.html.
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
