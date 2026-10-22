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

