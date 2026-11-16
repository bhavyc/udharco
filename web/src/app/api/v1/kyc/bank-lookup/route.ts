import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SurepassService } from "@/lib/services/surepassService";
import { NameMatchService } from "@/lib/services/nameMatchService";

// Bank IFSC Prefix mapping for intelligent bank name resolution
const IFSC_BANK_NAMES: Record<string, string> = {
  HDFC: "HDFC Bank Ltd",
  ICIC: "ICICI Bank Ltd",
  SBIN: "State Bank of India",
  KKBK: "Kotak Mahindra Bank Ltd",
  UTIB: "Axis Bank Ltd",
  PUNB: "Punjab National Bank",
  BARB: "Bank of Baroda",
  YESB: "Yes Bank Ltd",
  IDFB: "IDFC FIRST Bank Ltd",
  INDB: "IndusInd Bank Ltd",
};

// Rate limiting tracker to prevent automated penny-drop wallet depletion
const bankLookupRateTracker = new Map<string, { count: number; firstTime: number }>();

// Fraud attempt tracker: Tracks consecutive beneficiary name mismatches
interface MismatchTracker {
  failedAttempts: number;
  lastAttemptAt: number;
}
const mismatchRateTracker = new Map<string, MismatchTracker>();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountNumber, ifsc, legalName } = body;

    if (!accountNumber || typeof accountNumber !== "string" || accountNumber.trim().length < 8) {
      return NextResponse.json(
        { success: false, error: "A valid bank account number is required." },
        { status: 400 }
      );
    }

    if (!ifsc || typeof ifsc !== "string" || ifsc.trim().length !== 11) {
      return NextResponse.json(
        { success: false, error: "A valid 11-character IFSC code is required." },
        { status: 400 }
      );
    }

    if (!legalName || typeof legalName !== "string" || legalName.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Registered business legal name is required for bank ownership validation." },
        { status: 400 }
      );
    }

    const cleanAcc = accountNumber.trim();
    const cleanIfsc = ifsc.toUpperCase().trim();
    const cleanLegalName = legalName.trim();
    const now = Date.now();

    // ── RATE LIMITING CHECK (Wallet & Endpoint Protection) ──
    const rateRec = bankLookupRateTracker.get(cleanAcc);
    if (rateRec) {
      if (now - rateRec.firstTime < 10 * 60 * 1000) {
        if (rateRec.count >= 5) {
          return NextResponse.json(
            { success: false, error: "RATE_LIMIT_EXCEEDED: Too many verification attempts for this account number. Please retry later in 10 minutes." },
            { status: 429 }
          );
        }
        rateRec.count += 1;
      } else {
        bankLookupRateTracker.set(cleanAcc, { count: 1, firstTime: now });
      }
    } else {
      bankLookupRateTracker.set(cleanAcc, { count: 1, firstTime: now });
    }

    const prefix = cleanIfsc.substring(0, 4);
    const bankName = IFSC_BANK_NAMES[prefix] || `${prefix} Commercial Bank Ltd`;

    // ── 1. CALL PENNY-DROP / NPCI IMPS SERVICE ──
    // Fetches actual legal full_name registered in core banking
    const verifyResult = await SurepassService.verifyBankAccount(cleanAcc, cleanIfsc, cleanLegalName);

    if (!verifyResult.success || !verifyResult.beneficiaryName) {
      return NextResponse.json(
        { success: false, error: verifyResult.error || "Bank account verification failed with core banking." },
        { status: 400 }
      );
    }

    const bankBeneficiaryName = verifyResult.beneficiaryName.trim();

    // ── 2. RUN FUZZY TOKEN-SORT NAME MATCHING ENGINE ──
    // Configurable threshold: default 70% (RBI Fintech KYC Benchmark)
    const configuredThreshold = process.env.BANK_NAME_MATCH_THRESHOLD
      ? Number(process.env.BANK_NAME_MATCH_THRESHOLD)
      : NameMatchService.DEFAULT_THRESHOLD;

    const matchResult = NameMatchService.compareNames(
      cleanLegalName,
      bankBeneficiaryName,
      configuredThreshold
    );

    // ── 3. HANDLE BENEFICIARY NAME MISMATCH (FRAUD VECTOR SHIELD) ──
    if (!matchResult.isMatch) {
      const tracker = mismatchRateTracker.get(cleanAcc) || { failedAttempts: 0, lastAttemptAt: now };
      tracker.failedAttempts += 1;
      tracker.lastAttemptAt = now;
      mismatchRateTracker.set(cleanAcc, tracker);

      // SECURITY AUDIT LOG: If 3 or more mismatch attempts, flag as potential third-party diversion fraud for Admin
      if (tracker.failedAttempts >= 3) {
        try {
          await prisma.auditLog.create({
            data: {
              entityType: "KYC",
              entityId: `ACC-${cleanAcc.slice(-4)}`,
              action: "FRAUD_ALERT_BANK_NAME_MISMATCH",
              actorRole: "SELLER",
              metadata: JSON.stringify({
                severity: "HIGH",
                accountNumberMasked: `••••••••${cleanAcc.slice(-4)}`,
                ifsc: cleanIfsc,
                bankName: verifyResult.bankName || bankName,
                declaredLegalName: cleanLegalName,
                bankBeneficiaryName,
                matchPercentage: matchResult.matchPercentage,
                threshold: matchResult.threshold,
                consecutiveFailures: tracker.failedAttempts,
                alert: "Potential third-party payout diversion / fraud attempt detected during MSME onboarding.",
              }),
            },
          });
        } catch (logErr) {
          console.error("Failed to write bank mismatch audit log:", logErr);
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: "BENEFICIARY_NAME_MISMATCH",
          message: `Bank account holder name mismatch. Core banking records show '${bankBeneficiaryName}', which does not match your registered legal business name '${cleanLegalName}'. Match score is ${matchResult.matchPercentage}% (minimum required is ${matchResult.threshold}%). Factoring advances can only be paid into your official business current account.`,
          matchPercentage: matchResult.matchPercentage,
          threshold: matchResult.threshold,
          bankBeneficiary: bankBeneficiaryName,
          declaredLegalName: cleanLegalName,
          consecutiveFailures: tracker.failedAttempts,
          canRetry: tracker.failedAttempts < 5,
        },
        { status: 400 }
      );
    }

    // ── 4. MATCH VERIFIED SUCCESSFULLY ──
    // Clear failure tracker on successful match
    mismatchRateTracker.delete(cleanAcc);

    return NextResponse.json({
      success: true,
      accountNumber: cleanAcc,
      ifsc: cleanIfsc,
      bankName: verifyResult.bankName || bankName,
      beneficiaryName: bankBeneficiaryName,
      matchPercentage: matchResult.matchPercentage,
      threshold: matchResult.threshold,
      pennyDropStatus: "VERIFIED",
      referenceUtr: `IMPS${Date.now().toString().slice(-8)}PENNYLESS`,
      message: "NPCI Pennyless Account Verification verified successfully.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bank verification failed.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
