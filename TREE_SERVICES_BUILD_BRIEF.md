# Sydney Tree Connect: Claude Code Build Brief

## Task

Build this website in the current GitHub-backed project. Read the existing repository and any AGENTS.md or CLAUDE.md instructions first. Preserve unrelated work. Implement the website, generate its visual assets using an available image-generation tool, test it and provide setup instructions. Do not stop at a design proposal.

Use plain HTML, CSS and minimal vanilla JavaScript. No React, WordPress or unnecessary build system. The owner has purchased sydneytreeconnect.com and will arrange hosting, configure deployment and manually request Google indexing. GitHub stores the source; do not assume GitHub Pages is the final host. Do not purchase services or deploy publicly as part of this brief. Commit/push only according to the owner's repository instructions; otherwise leave reviewed changes ready to commit.

## Business model and non-negotiables

- This is an enquiry/referral website covering Sydney, not the business performing tree work.
- Visitors submit enquiries; the website owner receives them by email and manually forwards them to a tree contractor.
- The contractor calls or emails the customer, assesses the job, checks required permissions, provides a quote and arranges the work directly.
- Display no business phone number, click-to-call button or invented telephone data in structured metadata.
- Customers CAN supply their own phone number in the enquiry form so the contractor can call them.
- Clearly disclose the referral role near the form and in the introduction/FAQ. Do not hide it only in the terms.
- Do not invent qualifications, insurance, reviews, staff, completed jobs, years of experience, partnerships or coverage commitments.
- Use Australian spelling and natural, straightforward copy. Avoid exaggerated claims and em dashes.

## Confirmed brand and domain

- Website brand: Sydney Tree Connect.
- Purchased domain: sydneytreeconnect.com (confirmed by the owner).
- Production base URL: https://sydneytreeconnect.com. Use consistently in canonical URLs, sitemap, social metadata and structured data. Hosting and DNS setup remain the owner's responsibility.
- Use Sydney Tree Connect consistently in the logo, header, footer, page titles and form confirmation. Domain ownership does not confirm business-name or trade mark clearance; those checks remain separate. Do not infer the legal operator name from the website brand.
- Suggested headline: “Tree removal and pruning enquiries across Sydney”.
- Main CTA: “Request a tree service quote”.
- Suggested disclosure: “We connect Sydney property owners with a tree contractor. Submit your details and we’ll pass your enquiry on so they can contact you about an assessment and quote.”
- Do not promise free quotes, instant prices, emergency response or response times unless confirmed.

## Logo requirements

Create an original logo for Sydney Tree Connect as part of the build. Use a clean tree or leaf symbol with a subtle connection motif and a readable wordmark. Match the forest-green, warm-white and charcoal website palette. Avoid detailed tree illustrations, stock logos and claims of certification.

- Deliver a horizontal symbol-plus-wordmark logo for the header and footer.
- Deliver a standalone symbol for the favicon and mobile use.
- Provide transparent-background SVG and PNG versions, plus a light version for dark backgrounds.
- Keep the exact wording “Sydney Tree Connect” crisp and correctly spelt. Use vector text/shapes for the final wordmark rather than relying on image-generated lettering.
- Use available image-generation tools for concepts if useful; produce clean scalable final assets.
- Save the logo assets under assets/images/brand/ and favicon files in an appropriate public location.
- Verify the logo remains legible on mobile and the symbol works at favicon size. Include logo colours and font details in the README.

## Visual direction and generated imagery

Create a distinctive, uncluttered design with forest green, warm white, charcoal text, generous spacing and strong typography. Prioritise mobile use, legibility and a short path to the form. Avoid a generic stock-template appearance.

Generate one high-quality landscape hero image showing a leafy Sydney-style residential garden with mature trees and natural Australian light. Compose it with calm space for nearby text and a crop that works on mobile. No embedded text, logos, people operating machinery, fake staff, dramatic hazards or before/after comparisons.

Use simple consistent SVG icons for services and process steps. All photographic website assets may be AI-generated. Never present generated imagery as evidence of actual work or customers. Add a discreet “AI-generated illustrative image” caption where it could be mistaken for a real job.

Save generated assets locally in the repository, optimise to WebP/AVIF with appropriate fallbacks and include dimensions and responsive image sizes. Do not hotlink external images. Record generation prompts in docs/image-prompts.md. If no image tool is available, provide the exact prompt and a tasteful clearly documented temporary visual; do not claim a photo was generated.

## Initial pages and sections

Build index.html, privacy.html, terms.html, a noindex thank-you page and a useful 404 page.

Homepage order:

1. Compact brand header with navigation and quote CTA.
2. Hero explaining the Sydney enquiry/referral service.
3. Services: tree removal, pruning and stump grinding as provisional offerings pending contractor confirmation. Keep unconfirmed offerings out of launch content until verified.
4. How it works: submit enquiry, contractor contacts you, assessment/quote and permission checks, arrange work directly.
5. “Before removing a tree” guidance with official links.
6. Coverage across Sydney, with regions included only when actual contractor coverage is confirmed. Do not imply offices in each suburb.
7. FAQs on enquiries, contact, photos, approval uncertainty and who performs/pays for work.
8. Enquiry form.
9. Footer with actual operator identity, privacy and referral terms.

Do not create a fabricated reviews/gallery section. Make future real project examples easy to add. Avoid dozens of near-identical suburb pages.

## Enquiry form and email delivery

Fields:

- Name: required.
- Email: required.
- Customer phone: optional, with explanation that the contractor may call if supplied.
- Preferred contact method: email or phone; require a phone number when phone is selected.
- Suburb and postcode: required.
- Service required and job description: required; include “Not sure”.
- Tree photos: optional, maximum 5 images with a documented size limit supported by the chosen handler.
- Property authority: owner / authorised representative / other or unsure. Unsure enquiries may request guidance but do not authorise work.
- Council approval status: obtained / application pending / not sure / believe exempt, needs verification.
- Required unchecked consent checkbox allowing the operator to share enquiry details and photos with the contractor for assessment, contact and quotation. Link the privacy notice.

Do not require a permit upload at initial enquiry. Do not treat the form as legal approval or a binding work booking. Tell visitors this is not a monitored emergency channel.

Send submissions to the owner's configured enquiry inbox, not directly to the contractor. Include all fields and the consent record in the email. The owner manually forwards enquiries. No CRM or automatic lead sale is required.

HTML alone cannot send email. Choose a suitable hosted form endpoint or server-side handler based on the actual hosting. If the hosting/inbox is not supplied, build the frontend and document the integration clearly as a launch blocker. Never show successful submission without an accepted response from the configured endpoint. Do not use mailto as the form backend.

Implement accessible field validation, server-side validation, spam protection/rate limiting, safe error messages, loading state and duplicate-click prevention. Validate file count, actual file type and size on the server/provider; do not accept executable/SVG uploads. Keep uploaded photos private and out of GitHub/public assets. Use a fixed verified sender and validated customer Reply-To to avoid email header injection. Keep all credentials server-side. Document provider retention/access settings and how the operator can delete enquiries.

## NSW and council permission guidance

Provide a concise general checklist, not an automated legal eligibility decision:

1. Confirm ownership or authority and identify the particular tree.
2. Identify the local council and check its current tree protection rules.
3. Check whether permits, development consent, arborist reports or other approvals apply.
4. Obtain required approvals or documented evidence of an applicable exemption.
5. Have the contractor verify documents, tree identity and approval conditions before work.

Do not say ownership, a dead tree, perceived danger or a particular tree size automatically permits removal. Do not present a universal Sydney exemption. Street/public trees and neighbouring trees need the relevant authority/consent pathway. Mention pruning may also need approval. Do not offer DIY felling instructions.

Verify the current official guidance before publishing, including any council-specific statements. If offering council links, verify each one and provide a fallback when the visitor's council is unknown. Record the review date and sources in docs/content-sources.md.

Official starting sources:

- https://www.service.nsw.gov.au/referral/removing-trees-on-your-property
- https://www.planning.nsw.gov.au/the-planning-system/environment-and-heritage/protecting-our-urban-trees-and-vegetation
- https://planning.nsw.gov.au/the-planning-system/environment-and-heritage/protecting-our-urban-trees-and-vegetation/roles-and-responsibilities

## SEO and performance

Aim to improve visibility for relevant Sydney tree removal, pruning and tree lopping enquiries. First-page ranking is a goal, never a guarantee. Manual indexing requests do not guarantee indexing or rankings.

- Semantic HTML, one descriptive H1 per page, useful visible text and logical headings.
- Unique titles/descriptions, final-domain canonical URLs and social sharing metadata.
- Truthful structured data describing the actual referral operator. Do not misrepresent it as an arborist or invent addresses, ratings or phone numbers.
- Responsive images, appropriate alt text, explicit dimensions and lazy loading below the fold. Do not lazy-load the hero if it is the main loading element.
- Minimal scripts and fonts; no unnecessary trackers or third-party widgets.
- sitemap.xml with genuine public canonical pages, robots.txt and favicon.
- Exclude thank-you/error pages from the sitemap; mark the thank-you page noindex.
- Keep staging unindexed and document removing staging restrictions for launch. Do not put placeholder domains into a production sitemap.
- Plan future service and location pages around genuinely useful original content and verified coverage.

Reference: https://developers.google.com/search/docs/fundamentals/seo-starter-guide

## Privacy, terms and GitHub

Write plain-language draft privacy and referral terms reflecting the actual form provider and business model. Explain the operator's identity, information collected, why it is collected, sharing with the contractor, contact methods, storage/retention, provider involvement and how to request access/deletion. Mark missing operational details for owner completion; do not claim legal review.

Clarify that the contractor provides the assessment, quotation, work and payment arrangements. Referral fees are an internal business arrangement to confirm separately; do not invent a fee or describe the service as independent comparison if it refers to one contractor.

Use .gitignore and .env.example with dummy values. Never commit credentials, API keys, customer submissions, uploaded photos, private agreements or environment files. Inspect the diff for secrets before any commit. If an existing repository contains secrets, report the issue without printing their values.

## Deliverables and checks

Deliver the site files and assets, README.md, .gitignore, .env.example if relevant, docs/image-prompts.md, docs/content-sources.md and docs/launch-checklist.md. Include instructions for local preview, ordinary static hosting, form configuration, DNS/HTTPS considerations and Search Console submission. Keep deployment dependencies explicit; GitHub Pages cannot execute a PHP/Node email handler.

Test mobile/tablet/desktop layouts, keyboard navigation, labels/focus states, contrast, all links, image loading and console errors. Test form invalid inputs, phone preference, file limits, missing consent, endpoint failure and success. Use dummy enquiries only. Verify actual inbox delivery when configuration is available; otherwise clearly state it remains untested. Check metadata, sitemap, robots rules and absence of false business claims. Summarise what was built, what passed and remaining launch blockers.

## Inputs still needed before launch

- GitHub repository destination. Brand and purchased domain are confirmed above.
- Operator legal/trading name, ABN if applicable and privacy contact.
- Enquiry recipient email and hosting/form provider configuration.
- Contractor identity, agreement to receive enquiries, actual service coverage and services.
- Any qualifications/insurance claims verified before publication.
- Expected response time, retention period and final privacy/terms approval.

Proceed with the build using clearly identified development placeholders. Ask only for information that genuinely blocks implementation. Do not publish unfinished placeholders or activate a non-working form.
