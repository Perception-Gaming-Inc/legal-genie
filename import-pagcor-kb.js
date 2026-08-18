'use strict';
/**
 * One-time enrichment script for the Knowledge Base module — run this once
 * against your OWN running server (local-mock or, later, your real Supabase
 * deployment) after `node server.js` is already up.
 *
 * What it does: pulls in the PAGCOR Electronic Gaming Licensing Department's
 * announcement/memorandum catalog (as of Aug 2026) — 38 items your existing
 * 14-entry seed didn't have — plus real extracted summaries for the ones
 * whose PDFs were actual text (not scanned images). It is IDEMPOTENT: safe
 * to run more than once — it matches existing kbDocuments by sourceUrl and
 * updates them in place instead of creating duplicates.
 *
 * IMPORTANT — three tiers of confidence, clearly marked in each entry's
 * `notes` field so nobody mistakes one for the other:
 *   [VERIFIED]   — the PDF's actual text was read directly; summary is
 *                  sourced from the primary document itself.
 *   [UNVERIFIED] — the PDF is a scanned image with no extractable text.
 *                  The summary below is reconstructed from THIRD-PARTY
 *                  reporting (news sites, law-firm client alerts), NOT the
 *                  primary PAGCOR document. Confirm against the original
 *                  before relying on this for a real compliance decision.
 *   (no summary) — the PDF is a scanned image and no secondary source could
 *                  be found either. Only title/date/link are on file; open
 *                  the link directly to read it.
 *
 * Everything is inserted/updated as status 'Pending Review' — matching how
 * your existing 14 entries already work, this script does NOT decide
 * anything is Active. Review each one in Settings > Knowledge Base (or the
 * Knowledge Base module itself) and flip to Active yourself once you've
 * actually read it.
 *
 * Usage:
 *   1. Make sure `node server.js` is already running (this script talks to
 *      http://localhost:3000 — change BASE_URL below if yours differs).
 *   2. node import-pagcor-kb.js
 */

const BASE_URL = process.env.LMS_BASE_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.LMS_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.LMS_ADMIN_PASS || 'admin123';

const ANN = 'https://www.pagcor.ph/regulatory/pdf/announcements';

// ---------------------------------------------------------------------------
// The data. `sourceUrl` is the dedupe key — an existing kbDocuments row with
// the same sourceUrl gets updated in place; otherwise a new row is created.
// ---------------------------------------------------------------------------
const ENTRIES = [
  // ---- Corrections/enrichments to your EXISTING 14 seeded entries --------
  {
    title: 'Regulatory Framework for the Accreditation of Service Providers and Processing of System-Related Requests (Rev. No. 2)',
    category: 'Regulatory Framework', documentType: 'External Link',
    sourceUrl: `${ANN}/Memorandum-on-Regulatory-Framework-for-the-Accreditation-of-Service-Providers-and-Processing-of-System-Related-Requests-Rev-No-2.pdf`,
    // Your original seed had this under a "Rev. No. 3" title pointing at a
    // now-dead URL (that revision doesn't actually exist — see notes below).
    // Matched by that OLD sourceUrl too, so this corrects that row in place
    // instead of leaving a stray duplicate with a dead link.
    alsoMatchSourceUrl: 'https://www.pagcor.ph/regulatory/pdf/GSRM/Regulatory%20Manuals/Regulatory%20Framework%20for%20the%20Accreditation%20of%20Service%20Providers%20and%20Processing%20of%20System-Related%20Requests%20Rev.%20No.%203.pdf',
    version: 'Rev. No. 2', revisionNumber: '2', effectivityDate: '2024-09-24',
    notes: '(no summary — PDF is a scanned image, text not extractable) CONFIRMED: no "Rev. No. 3" of this document exists as of Aug 2026 — Rev. No. 2 (Sept 24, 2024) is the current version; it supersedes the original June 13, 2024 memo. Governs service provider accreditation and processing of system-related requests (e.g. new system/game/machine requests), paired elsewhere on PAGCOR\'s site with EG Form No. 14 (Accreditation of Service Providers) and EG Form No. 51 (Accreditation of Support Service Provider). Open the link directly for the actual requirements.',
  },
  {
    title: 'PAGCOR Memorandum — Amendments to Existing Regulatory Frameworks for Electronic Gaming Operations',
    category: 'Regulatory Framework', documentType: 'External Link',
    sourceUrl: `${ANN}/AMENDMENTS%20TO%20THE%20PROVISIONS%20OF%20EXISTING%20REGULATORY%20FRAMEWORKS%20FOR%20ELECTRONICS%20GAMING%20OPERATIONS.pdf`,
    publicationDate: '2025-02-27',
    notes: '(no summary — PDF is a scanned image, text not extractable) 2025 amendments; use for cross-checking whether older requirements have been amended. Open the link directly for the actual text.',
  },
  {
    title: 'PAGCOR Memorandum — Approval of Currently Implemented Games',
    category: 'Game Approval', documentType: 'External Link',
    sourceUrl: `${ANN}/Memorandum-on-Approval-of-Currently-Implemented-Games.pdf`,
    publicationDate: '2025-06-02',
    notes: '[VERIFIED] Ref. EGLD-20250605-9915. Games already EGLD-approved and currently implemented do NOT need to be re-evaluated for reapproval — GSAs launching such games instead notify EGLD and submit a proposed Game List and Parameters Settings Checklist, confirming compliance with the required minimum bet and RTP percentages. Games with progressive jackpots are EXCLUDED from this exemption and still need formal approval via EG Form No. 9 with supporting attachments. Both existing and newly accredited Game Content Providers must use EG Form No. 9 for new game approval requests. Non-compliance with minimum bet/RTP requirements is penalized under the "Regulatory Framework for Offenses and Penalties (Remote Gaming Operations) Rev. No. 2," enforced by the Compliance Monitoring and Enforcement Department.',
  },
  {
    title: 'Clarification on the Scope of the Unified Gaming License and Form 57 Requirements',
    category: 'System / Platform', documentType: 'External Link', sourceUrl: `${ANN}/Memorandum-on-Clarification-on-the-scope-of-the-Unified-Gaming-License-and-Form-57-Requirements.pdf`,
    publicationDate: '2026-07-16',
    notes: '[VERIFIED] Issued by the OIC, Electronic Gaming Licensing Department, to clarify misunderstandings about recent issuances. The Unified Gaming License (UGL) applies ONLY to land-based gaming venues, not online operators — licensing fees/equipment standards/regulations target only physical locations. Form 57 (appointing an Exclusive Distributor/Reseller for overseas partnerships) is an administrative procedure under the existing Gaming Affiliates/Support Service Providers framework, introduced for monitoring/oversight — it does NOT create new licensing obligations. The memo explicitly states nothing in these issuances "authorizes, revives, or otherwise permits offshore gaming operations in any form." Stakeholders should rely only on PAGCOR\'s official communications for interpretation; direct questions to EGLD\'s official emails.',
  },
  {
    title: 'Post-Operational Activities for GSAs and B2B Providers',
    category: 'Distributor / Reseller', documentType: 'External Link', sourceUrl: `${ANN}/Memorandum-on-the-Provisions-on-Post-Operational-Activities-for-GSAs-and-B2B-Providers.pdf`,
    publicationDate: '2026-07-13',
    notes: '(no summary — PDF is a scanned image, text not extractable) Open the link directly to read.',
  },
  {
    title: 'Unified Gaming License',
    category: 'System / Platform', documentType: 'External Link', sourceUrl: `${ANN}/Memorandum-on-Unified-Gaming-License-for-Gaming-Venue-Operations-as-Alternative-Licensing-Approach.pdf`,
    publicationDate: '2026-07-06',
    notes: '(no summary — PDF is a scanned image, text not extractable) See also the July 16, 2026 clarification memo (same source page) which confirms this only applies to land-based venues, not online operations. Open the link directly to read the full text.',
  },
  {
    title: 'Implementation of EG Form No. 57 — Appointment as Exclusive Distributor/Reseller Declaration Form',
    category: 'Distributor / Reseller', documentType: 'External Link', sourceUrl: `${ANN}/Memorandum-on-Implementation-of-EG-Form-No-57-Appointment-as-Exclusive-Distributor-Reseller-Declaration-Form.pdf`,
    publicationDate: '2026-07-06',
    notes: '(no summary — PDF is a scanned image, text not extractable) See also the July 16, 2026 clarification memo (same source page): Form 57 is an administrative procedure, not a new licensing requirement. Open the link directly to read the full text.',
  },
  {
    title: 'Migration to New OneDrive Repository for Game-Related Applications and Game Deployment of Currently Implemented Games',
    category: 'OneDrive / Submission Repository', documentType: 'External Link', sourceUrl: `${ANN}/Memorandum-on-Migration-to-New-OneDrive-Repository-for-Game-Related-Applications-and-Game-Deployment-of-Currently-Implemented-Games.pdf`,
    publicationDate: '2026-02-09',
    notes: '(no summary — PDF is a scanned image, text not extractable) By title, appears to direct operators to submit game-related applications/deployment docs for currently-implemented games via a new OneDrive repository — directly relevant to how this system\'s Document Center workflow should map to PAGCOR\'s actual submission channel. Worth reading in full given the relevance. Open the link directly.',
  },

  // ---- NEW verified entries (real PDF text extracted) ---------------------
  {
    title: 'Updated Lists of Approved Brands and Domain Names/URLs',
    category: 'Regulatory Framework', documentType: 'External Link',
    sourceUrl: `${ANN}/memorandum-on-updated-lists-of-approved-brands-and-domain-names-uniform-resource-locators.pdf`,
    publicationDate: '2025-09-04',
    notes: '[VERIFIED] Updated lists of approved brands/domain names/URLs for accredited GSAs and licensed integrated resort casinos are posted on PAGCOR\'s site. Recipients had until Sept 11, 2025 to raise questions/clarifications with EGLD, after which the lists became final. Any previously registered brand/domain name NOT in the finalized list is reported to the DICT for blocking. Compliance implication: partner brand/domain names must match the finalized registry or risk being blocked.',
  },
  {
    title: 'Approved Brands and Domain Names/URLs',
    category: 'Regulatory Framework', documentType: 'External Link',
    sourceUrl: `${ANN}/approved-brands-and-domain-names-urls.pdf`,
    publicationDate: '2025-08-24',
    notes: '[VERIFIED] Dated Aug 22, 2025 (posted Aug 24). Publishes an updated roster of PAGCOR-accredited Gaming System Administrators and Online Gaming Platforms of licensed casinos, with each entity\'s approved brands/domain names/URLs. Recipients had a 7-day window to raise concerns with EGLD — if no objection was raised, the listed brands/domains are automatically "final and deemed duly accepted." Relevant precedent for how PAGCOR handles brand/domain approvals generally.',
  },
  {
    title: 'Moratorium on Application for Accreditation of Service Providers',
    category: 'Regulatory Framework', documentType: 'External Link',
    sourceUrl: `${ANN}/memorandum-regarding-moratorium-on-application-for--ccreditation-of-service-providers.pdf`,
    publicationDate: '2024-02-29',
    notes: '[VERIFIED] Effective March 1, 2024, PAGCOR imposed a moratorium on NEW applications for accreditation as a Gaming System Service Provider (does not appear to affect renewals or already-accredited providers). Remains in effect "until further notice" — no stated end date and no rationale given in the memo. Worth periodically checking whether this has since been lifted, since it directly affects whether a new Service Provider can even apply.',
  },
  {
    title: 'Official E-mail Addresses of E-Games Licensing Department',
    category: 'General', documentType: 'External Link',
    sourceUrl: `${ANN}/memorandum-regarding-official-e-mail-addresses-of-e-games-licensing-department.pdf`,
    publicationDate: '2023-11-13',
    notes: '[VERIFIED] EGLD\'s four official email channels (stated as "the only official email addresses" — submissions elsewhere may not be recognized): eGaming_Licensing@pagcor.ph (new licenses/renewals/amendments/terminations), eGaming_Compliance@pagcor.ph (compliance document submissions incl. annual filings), eGaming_Forms@pagcor.ph (operational request forms/notifications/approvals), eGaming_Policy@pagcor.ph (new game/system applications, service provider accreditation, policy questions). Useful reference for routing correspondence correctly.',
  },
  {
    title: 'Regulatory Framework for the Issuance of Gaming License for the Establishment of Gaming Venues (for All Operators)',
    category: 'Regulatory Framework', documentType: 'External Link',
    sourceUrl: `${ANN}/memorandum-regarding-the-regulatory-framework-for-the-issuance-of-gaming-license-for-the-establishment-of-gaming-venues-for-all-operators.pdf`,
    publicationDate: '2023-10-19',
    notes: '[VERIFIED] Board-approved framework for gaming venue establishment licenses, applicable to all current/prospective venue operators. The memo itself is a transmittal notice only (attaches the full framework rather than stating the rules directly) — open the linked framework document itself for actual requirements/fees/procedures.',
  },
  {
    title: 'Regulatory Framework for the Accreditation of Gaming System Service Providers (Electronic Games, E-Bingo, Sports Betting, Specialty Games)',
    category: 'Regulatory Framework', documentType: 'External Link',
    sourceUrl: `${ANN}/memorandum-regarding-the-regulatory-framework-for-the-accreditation-of-gaming-system-service-providers-for-electronic-games-electronic-bingo-sports-betting-and-specialty-games.pdf`,
    publicationDate: '2023-05-31',
    notes: '[VERIFIED] Board-approved accreditation framework for service providers supporting electronic games, e-bingo, sports betting, and specialty games. Transmittal notice only — the actual accreditation criteria/technical standards/fees are in the linked framework document, not the memo itself.',
  },
  {
    title: 'Updated Fees for Data/Content Streaming Provider of Electronic Gaming Sites',
    category: 'Fees & Rates', documentType: 'External Link',
    sourceUrl: `${ANN}/04.03.2023-EGEBLD-Notice-Re-Updated-Fees-For-Data-Content-Streaming-Provider-of-Electronic-Gaming-Sites.pdf`,
    publicationDate: '2023-04-04',
    notes: '[VERIFIED] Following Board approval Mar 23, 2023, revised fees for data/content streaming provider accreditation: Application & Processing Fee ₱250,000 → ₱1,000,000; additional/transfer site in a different building ₱100,000 → ₱250,000; additional/transfer site within the same building ₱75,000 → ₱150,000; Replacement Fee ₱75,000 → ₱150,000. Note: this is a 2023 figure — confirm current fees are unchanged before quoting to a partner.',
  },
  {
    title: 'Regulatory Framework for Electronic Billiards (E-Billiards)',
    category: 'Regulatory Framework', documentType: 'External Link',
    sourceUrl: `${ANN}/memorandum-regarding-the-regulatory-framework-for-electronic-billiards.pdf`,
    publicationDate: '2023-02-06',
    notes: '[VERIFIED] Board-approved (Feb 2, 2023) framework governing wagering on live local billiards games/matches/events streamed in real time from registered billiard halls. EGEBLD is the office responsible for E-Billiards licensing/accreditation/registration. Transmittal notice only — full requirements in the linked regulatory manual.',
  },
  {
    title: 'Responsible Use of Text Blasts',
    category: 'General', documentType: 'External Link',
    sourceUrl: `${ANN}/responsible-use-of-text-blasts.pdf`,
    publicationDate: '2022-08-16',
    notes: '[VERIFIED] SMS-based promotions/advertisements are PROHIBITED except when directed to an operator\'s EXISTING pool of registered players — text blasts may NOT be used to recruit/acquire new players. Marketing texts must comply with the Regulatory Framework for Remote Gaming and include mandatory responsible-gaming elements. Violations subject to fines/suspension/loss of approval authority per the Table of Penalties for Remote Gaming Platforms. Directly relevant if partners ever ask about SMS marketing campaigns.',
  },
  {
    title: 'New Official E-mail Addresses of EG/EBLD',
    category: 'General', documentType: 'External Link',
    sourceUrl: `${ANN}/egebld-memo-new-email-addresses.pdf`,
    publicationDate: '2021-10-02',
    notes: '[VERIFIED, SUPERSEDED] Older version of the official-email-addresses memo — see the Nov 13, 2023 memo above for the current version. Kept here as historical reference only; use the 2023 memo for the current addresses.',
  },

  // ---- NEW entries — [UNVERIFIED]: PDF unreadable, summary from news/law-firm reporting only, NOT the primary source ----
  {
    title: 'Implementation of Cash Rebate and Cashback Programs for Electronic Games',
    category: 'Regulatory Framework', documentType: 'External Link',
    sourceUrl: `${ANN}/Memorandum-on-Implementation-of-Cash-Rebate-and-Cashback-Programs-for-Electronic-Games.pdf`,
    publicationDate: '2026-05-07',
    // Upgraded from UNVERIFIED to VERIFIED — Tiffany confirmed against the
    // actual "Guidelines on Cash Rebate and Cashback Programs" document
    // (Aug 12, 2026), which matched the earlier third-party-sourced summary
    // and added one previously-missing detail (item c, below).
    notes: '[VERIFIED — confirmed by Tiffany against the source document] Cash Rebate or Cashback Programs for Players may be implemented subject to: (a) Cash Rebate based on Player\'s Turnover (Gross Bets Placed) or Deposit, up to a maximum rate of 1.50%, for Slot Machine Games, Electronic Bingo Games, Numeric Games, and Sports Betting — EXCLUDING Casino Table Games and Arcade-type Games; (b) Cashback based on Player\'s Net Losses, up to a maximum rate of 15%, for ALL types of electronic games; (c) for electronic games NOT covered in item (a), EGLD evaluates and determines the appropriate rate(s) and issues approval to the proposed Cash Rebate program, taking into consideration the RTP of each game. The GSA / IR Licensee / Operator must submit its Marketing and/or Promotional Form (EG Form No. 28) to EGLD for approval prior to implementation. (Earlier third-party reporting also mentioned a May 15, 2026 transition deadline for previously-approved non-compliant programs — not shown in the excerpt confirmed so far, so still treat that specific detail as unverified.)',
  },
  {
    title: 'Deferment of Period for the Implementation of the Imposition of Minimum Guaranteed Fee',
    category: 'Fees & Rates', documentType: 'External Link',
    sourceUrl: `${ANN}/Memorandum-on-Deferment-of-Period-for-the-Implementation-of-the-Imposition-of-Minimum-Guaranteed-Fee.pdf`,
    publicationDate: '2026-03-30',
    notes: '⚠️ [UNVERIFIED — reconstructed from third-party reporting (AGB, GGRAsia, Yogonet), not the primary PDF, which is a scanned image. Confirm against the original before relying on this.] Reportedly, PAGCOR\'s Board (citing economic conditions) pushed the Minimum Guaranteed Fee start date back from April 1, 2026 to June 1, 2026 for all 65 accredited GSAs, with a two-tranche fee schedule based on GGR thresholds. See the Dec 15, 2025 and Jan 19, 2026 entries below for the underlying fee structure as separately reported.',
  },
  {
    title: 'Amendments to the Transition Guidelines and Regulatory Framework',
    category: 'Distributor / Reseller', documentType: 'External Link',
    sourceUrl: `${ANN}/Memorandum-on-Amendments-to-the-Transition-Guidelines-and-Regulatory-Framework.pdf`,
    publicationDate: '2026-03-25',
    notes: '⚠️ [UNVERIFIED — reconstructed from third-party reporting (Arden Consult, AGB, Asia Gaming Brief), not the primary PDF, which is a scanned image. Confirm against the original before relying on this.] Reportedly expands the "Gaming Affiliate" classification to explicitly cover Electronic Gaming Systems/Online Gaming Platforms/system software providers, and creates a new "exclusive distributor" category (max 5 exclusive distribution arrangements per local distributor). GSAs reportedly barred from acting as distributor for any unaccredited foreign provider. Compliance-critical if this company works through any distributor arrangement — verify against the primary document.',
  },
  {
    title: 'Amendments to the Regulatory Framework for the Fees and Rates on Gaming Venue Operations',
    category: 'Fees & Rates', documentType: 'External Link',
    sourceUrl: `${ANN}/Memorandum-on-Amendments-to-the-Regulatory-Framework-for-the-Fees-and-Rates-on-Gaming-Venue-Operations.pdf`,
    publicationDate: '2026-01-19',
    notes: '⚠️ [UNVERIFIED — reconstructed from third-party reporting (Philstar, BusinessWorld), not the primary PDF, which is a scanned image. Confirm against the original before relying on this.] Reportedly sets GGR share rates for sports betting (15% live / 30% virtual, retroactive to Nov 2025), and formalizes the two-tranche Minimum Guaranteed Fee schedule (later deferred by the Mar 30, 2026 memo). Also reportedly covers venue relocation/expansion fees and payment gateway provider licensing requirements.',
  },
  {
    title: 'Imposition of Minimum Guaranteed Fee to Gaming System Administrator',
    category: 'Fees & Rates', documentType: 'External Link',
    sourceUrl: `${ANN}/Memorandum-on-Imposition-of-Minimum-Guaranteed-Fee-to-Gaming-System-Administrator.pdf`,
    publicationDate: '2025-12-15',
    notes: '⚠️ [UNVERIFIED — reconstructed from third-party reporting (GGRAsia, iGaming Express, Tribuna), not the primary PDF, which is a scanned image. Confirm against the original before relying on this.] Reportedly establishes the original Minimum Guaranteed Fee regime for all accredited GSAs (originally effective April 1, 2026, later deferred — see Mar 30, 2026 entry above). If this company operates as or through a GSA, this fee structure is directly financially material — verify against the primary document before using these figures.',
  },
  {
    title: 'Implementation of Probity Checking Framework',
    category: 'Regulatory Framework', documentType: 'External Link',
    sourceUrl: `${ANN}/Memorandum-on-Implementation-of-Probity-Checking-Framework.pdf`,
    publicationDate: '2025-09-10',
    notes: '⚠️ [UNVERIFIED — this specific memo\'s PDF is a scanned image and could not be read; the summary below is from a DIFFERENT, related PAGCOR "Probity Checking Framework" document found separately, not this exact memo. Treat as background context only, not confirmed content of this document.] The related framework describes a 3-tier risk-based suitability/integrity vetting system (Level 1 minimum internal checks, Level 2 external bankruptcy/credit checks, Level 3 full international review) applying to new/renewal license applicants, board members/officers, and 20%+ shareholders, with a 30-day completion target and 15-day reporting requirement for material ownership/board changes.',
  },
  {
    title: 'Responsible Gaming Advisory',
    category: 'Responsible Gaming', documentType: 'External Link',
    sourceUrl: `${ANN}/Memorandum-on-Responsible-Gaming-Advisory.pdf`,
    publicationDate: '2026-04-20',
    notes: '⚠️ [UNVERIFIED — this specific memo\'s PDF is a scanned image and could not be read; available secondary reporting actually describes a DIFFERENT June 9, 2026 memo about the National Problem Gambling Helpline, not confirmed to be this April 20, 2026 document. Treat with extra caution — open the primary link directly.] Likely a responsible-gaming related advisory given the title and date proximity to other NPGH-related memos in this list, but the specific content of THIS document is not confirmed.',
  },

  // ---- NEW entries — unreadable, catalog only (no summary available) ------
  ...[
    ['Implementing Rules and Guidelines for the Foundations of Gaming System Administrators', 'Regulatory Framework', `${ANN}/Memorandum-on-Implementing-Rules-and-Guidelines-for-the-Foundations-of-Gaming-System-Administrators.pdf`, '2025-11-27'],
    ['Implementation of Amended and New Regulatory Frameworks for Electronic Gaming Operations', 'Regulatory Framework', `${ANN}/Memorandum-on-the-Implementation-of-Amended-and-New-Regulatory-Frameworks-for-Electronic-Gaming-Operations.pdf`, '2025-11-11'],
    ['Transition Guidelines for the Existing Business-to-Business (B2B) Providers and Implementation of the Regulatory Framework', 'Regulatory Framework', `${ANN}/Memorandum-on-Transition-Guidelines-for-the-Existing-Business-To-Business-B2b-Providers-and-Implementation-of-the-Regulatory-Framework.pdf`, '2025-10-09'],
    ['List of EGLD-Approved Electronic Games (September 2025)', 'Game Approval', `${ANN}/Memorandum-on-List-of-EGLD-Approved-Electronic-Games.pdf`, '2025-09-15'],
    ['List of EGLD-approved Electronic Games (July 2025)', 'Game Approval', `${ANN}/Memorandum-on-List-of-EGLD-approved-Electronic-Games.pdf`, '2025-07-30'],
    ['Notice to the Public — GlobalX Digital Corporation', 'General', `${ANN}/Memorandum-on-Notice-to-the-Public-GlobalX-Digital-Corporation.pdf`, '2025-07-14'],
    ['Prohibition on Subleasing, Subletting and/or Sublicensing of Accreditations of Licenses, and Streamlining of Gaming Brands', 'Regulatory Framework', `${ANN}/Memorandum-on-Prohibition-on-Subleasing-Subletting-and-or-Sublicensing-of-Accreditations-of-Licenses-and-Streamlining-of-Gaming-Brands.pdf`, '2025-06-30'],
    ['Regulatory Framework for the Accreditation of Gaming Affiliates and Support Service Providers', 'Regulatory Framework', `${ANN}/Memorandum-on-Regulatory-Framework-for-the-Accreditation-of-Gaming-Affiliates-and-Support-Service-Providers.pdf`, '2025-04-30'],
    ['CES25-0288 — Memo to All GSSP and DCSP: Reminder on the Coverage of Executive Order No. 74', 'General', `${ANN}/CES25-0288_02.06.2025_OUT%20-%20MEMO%20TO%20ALL%20GSSP%20AND%20DCSP%20-%20REMINDER%20ON%20THE%20COVERAGE%20OF%20EXECUTIVE%20ORDER%20NO.%2074.pdf`, '2025-02-06'],
    ['Coverage of Executive Order No. 74', 'General', `${ANN}/Memorandum-on-Coverage-of-Executive-Order-No-74.pdf`, '2024-11-20'],
    ['Clarification on the Remittance Procedures for PAGCOR Share and Audit Fee', 'Fees & Rates', `${ANN}/Memorandum-on-the-Clarification-on-the-Remittance-Procedures-for-PAGCOR-Share-and-Audit-Fee.pdf`, '2024-08-27'],
    ['Transition Period for the New Regulatory Framework and Implementation of the Updated Existing Regulatory Frameworks', 'Regulatory Framework', `${ANN}/Transition-Period-for-the-New-Regulatory-Framework-and-Implementation-of-the-Updated-Existing-Regulatory-Frameworks.pdf`, '2024-08-05'],
    ['New Game Offering — Numeric Games', 'Game Approval', `${ANN}/EGLD-memo-New-Game-Offering-Numeric-Games.pdf`, '2024-07-02'],
    ['Regulatory Framework for the Accreditation of Service Providers and Processing of System-Related Requests (original, superseded by Rev. No. 2)', 'Regulatory Framework', `${ANN}/EGLD-memo-Regulatory-Framework-for-the-Accreditation-of-Service-Providers-and-Processing-of-System-Related-Requests.pdf`, '2024-06-13'],
    ['Acceptance of Philippine Identification (PhilID) Card as Valid Government-Issued ID for Gaming Transactions', 'General', `${ANN}/EGLD-memo-to-all-sps-acceptence-of-philippine-id-2024.pdf`, '2024-04-16'],
    ['Regulatory Frameworks for Offenses and Penalties (Remote Gaming Operations) and for Fees and Rates on Gaming Venue Operations', 'Regulatory Framework', `${ANN}/Regulatory-Frameworks-for-Offenses-and-Penalties-Remote-Gaming-Operations-and-for-Fees-and-Rates-on-Gaming-Venue-Operations.pdf`, '2024-04-01'],
    ['Amendment to the Regulatory Framework for the Issuance of Gaming License for the Establishment of Gaming Venues', 'Regulatory Framework', `${ANN}/memorandum-regarding%20-amendment-to-the-regulatory-framework-for-the-issuance-of-gaming-license-for-the-establishment-of-gaming-venues.pdf`, '2023-11-23'],
    ['Specialty Games as New Game Offering', 'Game Approval', `${ANN}/memorandum-regarding-the-speciality-games-as-new-game-offering.pdf`, '2023-09-12'],
    ['Revised Regulatory Framework for the Remote Gaming Platform', 'Regulatory Framework', `${ANN}/memorandum-regarding-the-revised-regulatory-framework-for-the-remote-gaming-platform.pdf`, '2023-05-15'],
    ['Live Dealer as Game Content for PAGCOR-Approved Electronic Gaming System/Platform', 'System / Platform', `${ANN}/04.03.2023-EGEBLD-Memo-Re-Live-Dealer-as-Game-Content-for-PAGCOR-Approved-Electronic-Gaming-System-or-Platform.pdf`, '2023-04-04'],
    ['Reiteration on Prohibition of Banned Personalities to Access the Remote Gaming Platforms', 'Responsible Gaming', `${ANN}/reiteration-on-prohibition-of-banned-personalities-to-access-the-remote-gaming-platforms.pdf`, '2022-08-18'],
  ].map(([title, category, sourceUrl, publicationDate]) => ({
    title, category, documentType: 'External Link', sourceUrl, publicationDate,
    notes: '(no summary — PDF is a scanned image, text not extractable by this system) Open the link directly to read.',
  })),

  // ---- NEW: page-level index summaries (not single PDFs) -------------------
  {
    title: 'PAGCOR Application Kits', category: 'Application Forms', documentType: 'External Link',
    sourceUrl: 'https://www.pagcor.ph/regulatory/application-kit.php',
    notes: '[VERIFIED — page overview] Central hub for downloadable licensing/accreditation forms: gaming venue establishment, service provider accreditation, data streaming provider permits, support service provider accreditation, and gaming affiliate accreditation, organized by category.',
  },
  {
    title: 'PAGCOR Regulatory Manuals (EBLD)', category: 'Regulatory Framework', documentType: 'External Link',
    sourceUrl: 'https://www.pagcor.ph/regulatory/regulatory-manual-ebld.php',
    notes: '[VERIFIED — page overview] Hosts PAGCOR\'s regulatory manuals/frameworks: casino operations, offenses & penalties, problem-gambling treatment accreditation, gaming employment licensing, venue operations, system administrator accreditation, probity checking, and gaming affiliate/support service provider accreditation (with amendment annexes).',
  },
  {
    title: 'PAGCOR Operational Request Forms (page overview)', category: 'Operational Forms', documentType: 'External Link',
    sourceUrl: 'https://www.pagcor.ph/regulatory/operational-request-forms.php',
    notes: '[VERIFIED — page overview, supplements the existing "PAGCOR Operational Request Forms" entry] Forms/templates for ongoing operational matters: licensing requests, equipment transfers, financial reporting, operational changes (new system/game/machine requests, brand/game offering approvals). Also references the Security Seal verification system.',
  },
];

// ---------------------------------------------------------------------------

async function main() {
  console.log(`Logging in to ${BASE_URL} as ${ADMIN_USER}...`);
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  const { token } = await loginRes.json();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  console.log('Fetching existing kb-documents...');
  const existingRes = await fetch(`${BASE_URL}/api/kb-documents`, { headers });
  if (!existingRes.ok) throw new Error(`Failed to list kb-documents: ${existingRes.status}`);
  const existing = await existingRes.json();
  const bySourceUrl = new Map(existing.filter((d) => d.sourceUrl).map((d) => [d.sourceUrl, d]));

  let created = 0, updated = 0, failed = 0;
  for (const entry of ENTRIES) {
    const match = bySourceUrl.get(entry.sourceUrl)
      || (entry.alsoMatchSourceUrl && bySourceUrl.get(entry.alsoMatchSourceUrl));
    const payload = {
      title: entry.title, category: entry.category, documentType: entry.documentType,
      sourceUrl: entry.sourceUrl,
      fileName: null, filePath: match ? match.filePath : null,
      version: entry.version || null, revisionNumber: entry.revisionNumber || null,
      publicationDate: entry.publicationDate || null, effectivityDate: entry.effectivityDate || null,
      status: match ? match.status : 'Pending Review', // don't clobber a status you already reviewed
      approvedBy: match ? match.approvedBy : null,
      supersedesDocumentId: match ? match.supersedesDocumentId : null,
      notes: entry.notes,
    };
    try {
      if (match) {
        const res = await fetch(`${BASE_URL}/api/kb-documents/${match.id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        updated++;
        console.log(`  updated: ${entry.title}`);
      } else {
        const res = await fetch(`${BASE_URL}/api/kb-documents`, { method: 'POST', headers, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        created++;
        console.log(`  created: ${entry.title}`);
      }
    } catch (err) {
      failed++;
      console.error(`  FAILED: ${entry.title} — ${err.message}`);
    }
  }

  console.log(`\nDone. Created ${created}, updated ${updated}, failed ${failed}, out of ${ENTRIES.length} total.`);
  console.log('All entries kept their existing status if they already existed, or default to "Pending Review" if new — nothing was auto-approved to Active.');
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
