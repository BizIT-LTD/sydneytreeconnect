# Launch checklist

Last updated: 4 November 2026. The site is live at https://sydneytreeconnect.com (still noindex) and the repository is at https://github.com/BizIT-LTD/sydneytreeconnect (branch `main`).

The public pages have no placeholders (removed 4 Nov 2026). Unresolved decisions are tracked only here, and the public wording was written to stay accurate without them. Don't publish anything below until the owner has confirmed it. `node scripts/prelaunch-check.mjs` reports every unticked item in section 1 as a blocker.

Work through this list in order. `node scripts/prelaunch-check.mjs` checks the file-based items and exits with an error while any blocker remains.

## 1. Owner information (launch blockers)

- [x] Operator (owner, 4 Nov 2026): the website is run personally by an individual with no ABN, whose name is not published. “Sydney Tree Connect” is used only as the website's name, never as a company or registered business. privacy.html and terms.html say “run by an individual … the name of the website, not a company”. The footer has no “Operated by” line, and the home page structured data is a `WebSite` only, with no `Organization` or publisher.
- [x] ABN: none (owner, 4 Nov 2026). All ABN placeholders removed.
- [ ] **Review operator identification before launch** (internal only; the public wording is “run by an individual … the name of the website, not a company”, with no name or ABN). Points to check, ideally with advice:
  - Business name: in Australia, carrying on a business under a name other than your own usually requires registering that business name with ASIC, which needs an ABN. Check whether receiving referral fees or other benefits means you are carrying on a business under “Sydney Tree Connect”.
  - Privacy notice and terms: whether an unnamed individual with only an email contact is enough for customers to know who holds their information and who the terms are with.
  - Update the wording in privacy.html and terms.html only if the review requires it.
- [x] Privacy contact email: sydneytree278@gmail.com (owner, 4 Nov 2026), linked in privacy.html and in every page footer.
- [x] Contact email for terms.html: sydneytree278@gmail.com (owner, 4 Nov 2026).
- [ ] Business-name and trade mark checks for “Sydney Tree Connect”. Owning the domain doesn't confirm these.
- [ ] **Owner-managed:** contractor selection, identity and written agreement to receive enquiries. Record how they will handle and delete customer data. terms.html says only that enquiries go “to a tree contractor”; if you want to name the contractor or describe the arrangement, add it to “What Sydney Tree Connect is” in terms.html.
- [ ] Services the contractor confirms. Remove any unconfirmed card in the Services section of index.html, and the matching option in the form `<select>` and in `STC_SERVICES` in api/enquiry.php. Then delete the `data-provisional-service` attributes and the PROVISIONAL SERVICES comment.
- [ ] Coverage. Add regions only after the contractor confirms them in writing, using the commented COVERAGE template in index.html.
- [ ] Forwarding or response time (optional). Public wording makes no promise: the home FAQ and thank-you page say forwarding is manual and not instant, and terms.html says “We can’t promise that the contractor will contact you within a particular time”. If you commit to a time, add it to those three places.
- [x] Two-factor authentication on the enquiry Gmail account (confirmed by the owner, 4 Nov 2026; stated in privacy.html).
- [ ] Privacy decisions (privacy.html). Current public wording, written to be accurate without a decision, is quoted after each item:
  - Retention period for enquiry emails. Public: “stay in our email account until we delete them. You can ask us to delete yours at any time”. Add a period when you choose one, for example “for 12 months and then delete them”.
  - Who can access the enquiry inbox. Public: nothing beyond the password and two-factor authentication. Add “only the operator can read enquiries” if that's true and stays true.
  - Overseas storage. Public: “Hostinger and Google may store or process this information on servers outside Australia.” Confirm the Hostinger data centre for this plan (hPanel) and add countries where practicable.
  - Deletion requests already forwarded. Public: “we will tell you. Deleting our copy does not delete the contractor’s copy, so you can also ask the contractor directly.” Decide whether you will pass deletion requests on to the contractor yourself, and agree it with them.
  - Complaint response time. Public: “contact us first at sydneytree278@gmail.com”, with no time stated. Add a period (for example 30 days) if you will commit to one.
  - Contractor named in the privacy notice. Public: “the tree contractor we pass enquiries to”. Name them once the agreement is in place, if they agree.
- [ ] **Owner-managed, resolve before relying on the terms:** referral fee or other benefit from the contractor. The “Fees” section of terms.html now says only that enquiries are free and customers aren't charged. It is silent on any payment from the contractor. If you receive, or expect to receive, any fee or benefit, add a plain disclosure there, for example “We receive a fee from the contractor for each enquiry we pass on.” (only if accurate). If you receive nothing, you may say so.
- [ ] Any qualification or insurance claim you want to add. Verify it first and record the evidence in docs/content-sources.md. None are currently made.
- [ ] Liability wording (terms.html, optional, after legal advice). Public: only the Australian Consumer Law sentence, which stays whatever is added.
- [ ] Publication date. Both pages show “Last updated: 4 November 2026”, the date the draft wording was last changed. Update it whenever the wording changes, and set it to the date of the approved version.
- [ ] Final privacy notice and referral terms approval. Consider a legal review, then remove the draft banners (“has not been legally reviewed and may change before it is finalised”).

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
