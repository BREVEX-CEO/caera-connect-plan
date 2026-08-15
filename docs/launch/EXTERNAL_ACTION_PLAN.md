# CAERA CADANE / OCADE External Action Plan

**Research date:** 15 August 2026
**Boundary:** no account, filing, payment, contract or public claim is authorized by this document

## 1. Incorporation decision

For a solo owner, an Indian One Person Company (OPC) can have one member and one
director but requires a nominee. An ordinary private company needs at least two
subscribers and two directors. At least one director must satisfy the Indian
resident-director rule. See Companies Act [section 3](https://www.indiacode.nic.in/show-data?actid=AC_CEN_22_29_00008_201318_1517807327856&orderno=3&sectionId=186&sectionno=3)
and [section 149](https://www.indiacode.nic.in/show-data?actid=AC_CEN_22_29_00008_201318_1517807327856&orderno=153&sectionId=49078&sectionno=149).

**Practical recommendation:** obtain a company secretary/lawyer comparison
before choosing. OPC is simpler for a truly solo start; a private limited company
is usually more compatible with near-term co-founders/investors but requires a
genuine second member/director. Do not appoint a nominal person without informed
consent and proper rights.

Founder control cannot be absolute. A company is governed by the Companies Act,
its articles, shareholder rights, directors’ duties and later investment terms.
Section 169 permits removal of a director by the required member process in many
cases. Use a lawyer to design lawful founder protections: initial voting majority,
reserved matters, board appointment rights, share-transfer restrictions,
pre-emption, vesting and IP assignment. Each protection has investor, tax and
enforceability trade-offs.

## 2. SPICe+ preparation

Use the MCA SPICe+ online process with a practicing company secretary/chartered
accountant/lawyer. The official [SPICe+ FAQ](https://www.mca.gov.in/Ministry/pdf/SpicePlusFAQS_20112020.pdf)
lists the core attachments:

- proposed names and main objects;
- electronic memorandum and articles;
- subscriber/first-director declarations and consent;
- PAN plus current identity/residential proof for subscribers/directors;
- registered-office proof, recent utility bill, owner NOC, and lease/rent proof
  where applicable;
- nominee identity/address and INC-3 if OPC;
- digital signature certificates and required director identifiers; and
- AGILE-PRO-S linked registrations for bank account and applicable GST, EPFO,
  ESIC, Karnataka professional tax and shops/establishment items.

The filing is electronic; do not visit an office unless MCA/professional support
requires it. The Karnataka ROC has historically been at Kendriya Sadan,
Koramangala, Bengaluru, but verify the current MCA contact before travel.

There is no single official all-in price. Government filing/stamp duty varies by
entity, authorized capital and Karnataka rules; DSC and professional fees vary.
For planning only—not a quote—reserve roughly **₹15,000–₹30,000** for a simple
domestic incorporation and obtain two itemized fixed quotes showing government
fees separately. Name objections, bespoke articles, foreign subscribers or
complex capital increase cost and time.

No agent can guarantee incorporation by a specific date. Submit a clean name and
documents early, keep backup names, and avoid describing 28 August as the company
founding date unless the certificate actually bears that date. Product launch
and company incorporation are separate events.

## 3. GST and tax

CBIC’s general registration threshold for services is ₹20 lakh aggregate annual
turnover in Karnataka, subject to exceptions. CBIC also clarified an exemption
from compulsory GST registration for inter-State taxable service suppliers up to
the threshold in [Circular 88/2019](https://cbic-gst.gov.in/pdf/circular-cgst-88.pdf).
Exports, overseas B2C digital services, place-of-supply, app-store merchant flows,
TDS/equalisation and foreign remittances need a CA’s transaction-specific review.

Do not copy “billionaire tax” stories. Lawful planning means keeping clean company
and personal accounts, documenting salary/dividends/expenses, filing returns,
valuing shares properly and taking only commercial loans. A bank may accept
shares as collateral only under its own valuation, margin and documentation; it
is not guaranteed or automatically tax-free.

## 4. Trademark and IP

Search OCADE and CAERA CADANE across relevant classes and similar marks before
launch. IP India lists TM-A e-filing at **₹4,500 per mark per class** for an
individual/startup/small enterprise and **₹9,000** otherwise. Fees and workflow:
[IP India forms and official fees](https://www.ipindia.gov.in/pages/trade-marks/learn/forms-and-official-fees).

Software/downloadable apps and SaaS commonly involve classes 9 and 42, with
other classes possible for marketplace, communications or business services.
Classification and registrability require a trademark professional. File the
word marks first if advised, preserve evidence of use, use ™ while pending and
use ® only after registration. Search separately for FICIA, MADEE and CANIA
before investing in them.

Keep signed invention/IP assignments from every contributor. After incorporation,
execute written assignments for repository copyright, domains, trademarks,
designs, social accounts and contracts if the company is to own them.

## 5. Domain and Cloudflare

`ocade.in` was purchased and activated by the owner on 15 August 2026. This is
domain ownership evidence only; it is not evidence of company incorporation or
product launch. `ocade.ai` remains a possible later global-primary domain.

Preferred order:

1. Confirm trademark risk.
2. Add `ocade.in` to the owner’s Cloudflare account and copy every existing DNS
   record before changing the GoDaddy nameservers.
3. Point Cloudflare DNS to the verified deployment, enable the available domain
   security controls, redirects, rate limits and certificate monitoring.
4. Activate and test `support@ocade.in` plus privacy/security contacts.
5. Configure production canonical URLs, sitemap and Search Console only after
   the domain is controlled.
6. Consider `ocade.ai` later only after a fresh availability and total-cost
   check; no agent should accept registrar terms or spend without approval.

Cloudflare Pages static requests can be low-cost; Functions share Workers usage.
The free Workers plan has stricter CPU and bundle limits than paid. Run the real
server bundle/deployment check before choosing Pages/Workers, and set spend alerts.

## 6. Payments

Recommended staged approach:

- **India first:** evaluate Razorpay for cards plus UPI Intent/QR. Its onboarding
  requires KYC and a live website with legal/refund/contact pages. UPI Collect was
  deprecated from 28 February 2026; do not implement a VPA-entry Collect flow.
- **International optional:** PayPal India can receive eligible international
  payments but not domestic India-to-India payments.
- **Stripe later/if approved:** new India accounts remain invite-only, so do not
  make the launch depend on Stripe activation.

Payment pages: [Razorpay international](https://razorpay.com/docs/payments/international-payments/),
[Razorpay UPI](https://razorpay.com/docs/payments/payment-methods/upi/),
[PayPal India receiving](https://www.paypal.com/in/cshelp/article/how-do-i-receive-payments-through-paypal-HELP667),
[Stripe India availability](https://support.stripe.com/questions/stripe-accounts-are-invite-only-in-india).

Never handle full card/UPI credentials in OCADE. Verify webhook signatures,
idempotency, refunds, tax invoices and entitlement reconciliation. Do not expose
checkout until the final terms/privacy/refund policy and support contact work.

## 7. App stores and platform releases

- Apple Developer Program: **US$99/year** in most regions; digital subscriptions
  generally require In-App Purchase and review under guideline 3.1.
- Google Play Console: **US$25 one-time** registration; digital subscriptions
  generally require Play Billing unless an applicable program/exception is
  followed.
- Windows/macOS need code-signing identity, installer startup proof, update and
  uninstall testing. macOS additionally needs Apple signing/notarization.
- iOS/Android projects need real-device tests, privacy/data-safety disclosures,
  screenshots, age rating, support URL, account-deletion path and store review.

Official sources: [Apple membership](https://developer.apple.com/support/compare-memberships/),
[Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/),
[Google Play registration](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en),
[Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en).

## 8. Search and launch claims

Publish consistent visible company, founder and product pages with matching
Organization/ProfilePage/SoftwareApplication data. Google states that structured
data can help understanding but does not guarantee display. Never buy fake press,
reviews, backlinks, accounts or launch history. On 28 August, only after the
public product is independently reachable, change “planned” to “launched” and add
the verified date—not 8:28 AM—to public SEO metadata.

Submit the sitemap to Search Console, request indexing for the three identity
pages, and build legitimate third-party corroboration through product directories,
press and customer references. Official guidance:
[Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization),
[Profile page structured data](https://developers.google.com/search/docs/appearance/structured-data/profile-page),
[structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).
