# UdharCo — Institutional B2B Invoice Discounting & Escrow Engine

Governed under the **Factoring Regulation Act, 2011** and **RBI Digital Lending Directions**.

## Unified Monorepo Structure

```
e:\projects\udharco\
├── web\          # Next.js 16 (App Router) + Prisma ORM Web Platform (Corporate Anchors, Institutional Investors, Operations Admin)
└── mobile\       # Flutter Mobile Application (MSME Seller Portal)
```

## Quick Start Guide

### 1. Web Application (Next.js + Prisma)
```bash
cd web
npm install
npx prisma generate
npm run dev
```
Access points:
- Participant Login (Anchor / Investor): `http://localhost:3000/login`
- Isolated Operations Admin: `http://localhost:3000/admin/login`

### 2. Mobile Application (Flutter - MSME Seller)
```bash
cd mobile
flutter pub get
flutter run
```
Features:
- Mobile OTP Authentication
- 6-Step Paperless KYC Onboarding
- Invoice Upload with Government e-Invoice IRN Validation
- Real-time Escrow Disbursement & Recourse Tracking

---

## Two-Track Buyer Model & Fraud Defense Architecture

UdharCo enforces an institutional two-track onboarding model to balance fast SME execution with zero-trust fraud safety:

### 1. Deterministic Buyer Track Classifier (`RiskService.classifyBuyerTrack`)
A corporate buyer is automatically classified as **ENTERPRISE** if they satisfy ANY of:
- **Credit Rating**: Prime CRISIL/ICRA rating of `AAA`, `AA+`, `AA`, or `A`
- **Exposure Limit**: Approved Sanctioned Credit Ceiling $\ge ₹5\text{ Crore}$
- **Procurement Scale**: Annual MSME Procurement $\ge ₹50\text{ Crore}$

All other buyers default to **SME_COMMERCIAL** track.

### 2. Fraud Safeguards & Ramp-Up Controls
1. **Ramp-Up Graduated Disbursement (`RiskService.calculateRampUpDisbursement`)**:
   - For new/unproven SME buyers ($< 3$ successful settlements), advance is capped at **60% (max ₹2,00,000)**.
   - 39% margin is retained in escrow until the buyer pays. Full 84% advance is unlocked only after 3 successful cycles.
2. **High-Risk Collusion Combo Detection (`FraudService.evaluateCollusionRisk`)**:
   - Condition: **New Seller** ($< 3$ settlements) + **New Buyer** (0 settlements) + **Large Invoice** ($> ₹2,00,000$).
   - Action: Auto-funding is **strictly blocked** (`FRAUD_RISK_COLLUSION_FLAGGED`) and redirected to physical risk callback.
3. **Mandatory Recourse & e-NACH**:
   - All SME Commercial invoices carry non-negotiable **WITH-RECOURSE** status, backed by the seller's verified e-NACH auto-debit mandate.

### 3. Corporate Anchor Exposure Underwriting (Route A & B)
1. **Tenure-Dynamic Working Capital Formula**:
   $$\text{Suggested Exposure Limit} = \text{Annual Procurement} \times \left(\frac{\text{Tenure Days}}{365}\right)$$
   - **30-Day Cycle**: $\approx 8.22\%$ of Annual Procurement
   - **60-Day Cycle**: $\approx 16.44\%$ of Annual Procurement
   - **90-Day Cycle**: $\approx 24.66\%$ of Annual Procurement
   - **120-Day Cycle**: $\approx 32.88\%$ of Annual Procurement
2. **Standardized Probationary Exposure Ceiling**:
   - Strictly standardized at **₹50.00 Lakhs (`₹50,00,000`)** as the maximum conservative ceiling for unrated / new corporate anchors with no past platform repayment history.
   - Higher limits require prime rating (`AAA`/`AA`) or verified audited P&L statements.
3. **Non-Statutory Heuristic Estimate Disclosure**:
   - The ~40%–60% procurement-to-revenue ratio represents an industry heuristic (Cost of Materials Consumed / COGS in manufacturing).
   - **Statutory Clarification**: This is **NOT an RBI guideline or statutory benchmark**; it is an underwriting rule-of-thumb. Underwriters must cross-check unlisted corporate filings against audited financial statements before approving large exposures.
4. **Verification Pathways**:
   - **Route A (Active, Free & Zero-Cost)**: Direct 1-click clipboard copy + official Government GST Portal lookup (`https://services.gst.gov.in/services/searchtp`) to review taxpayer status, filing regularity, and turnover slab without incurring third-party API billing.
   - **Route B (Live Automated API)**: Instant Surepass GSTIN verification with in-memory caching shield.
5. **Strict Decoupling: Onboarding Estimate vs. Per-Invoice Execution**:
   - **Onboarding Heuristic Only (`Anchor.standardPaymentTerms`)**: The self-declared typical payment cycle (30/45/60/90 days) collected on `/corporate/apply` is strictly an unverified starting estimate to assist the Admin in setting the initial bilateral exposure ceiling.
   - **Individual Invoice Integrity (`Invoice.tenureDays` & `Invoice.dueDate`)**: When MSME suppliers upload invoices, financial discounting, investor returns, platform fees, and escrow repayment maturities are **always calculated from that specific invoice's real due-date (`Invoice.dueDate`)**. The system NEVER reuses or inherits the anchor's profile-declared standard terms for actual invoice discounting.

---

## Third-Party Integrations & Providers

| Capability | Primary Provider | Fallback / Alternative | Purpose |
|---|---|---|---|
| **Identity & KYC** | Surepass / Karza | Setu / Signzy | PAN, Aadhaar OTP, Bank Penny Drop, GSTIN verification |
| **Corporate Email Auth** | DNS MX / RFC 5322 | Company Domain Auth | Blocks free webmails (`@gmail`, `@yahoo`) for Anchors |
| **WhatsApp Business API** | Gupshup | Twilio / Interakt | Automated NOA dispatch & 1-click 30s OTP consent |
| **Escrow & Virtual Accounts** | ICICI / Yes Bank | RazorpayX Escrow | Nodal trustee escrow accounts & automated split payouts |
| **e-NACH Mandates** | Digio / Cashfree | Setu | Auto-debit registration for seller recourse recovery |
| **Fraud Registry** | Internal SHA-256 | CERSAI | Double-financing & duplicate bill blocking |

---

## 9. Core Engineering Non-Negotiables & The "Fail-Closed" Rule

Any code, database schema, or architectural addition to UdharCo must strictly pass the **Fail-Closed Golden Question**:

> *"Agar ye field accidentally set hi na ho (default use ho jaaye), kya system sabse safe/restrictive state mein rahega, ya sabse risky/permissive state mein?"*

### Mandatory Rules:

1. **Fail-Closed Schema Defaults (Never Fail-Open)**:
   - Every `status` field representing trust, money-movement, or access must default to `"PENDING"` (Never `"ACTIVE"` or `"VERIFIED"`).
   - Every `limit` or `exposure` field must default to `0` (Zero rupee disbursement allowed until explicit underwriter sanction).
   - Every provenance/source field must default to the highest-scrutiny channel (e.g. `sourceChannel: "VENDOR_PUSH"`).

2. **Strict With-Recourse Standard (Option A)**:
   - No invoice is ever processed without an active NPCI e-NACH mandate from the seller.
   - The platform does not offer non-recourse factoring to SME suppliers.

3. **Two-Way Provenance Distinction**:
   - `Channel 1 (VENDOR_PUSH)`: Initial limit locked at ₹0, maker-checker admin underwriting mandatory.
   - `Channel 2 (ENTERPRISE_SALES)`: Sanctioned limit backed by pre-vetted corporate master factoring agreement.

4. **Production Database Migration Policy**:
   - `prisma db push` is restricted to local sandbox prototyping.
   - Production deployments MUST use versioned `prisma migrate dev` and `prisma migrate deploy` to guarantee audited, reversible, and collaborative SQL schema history.


