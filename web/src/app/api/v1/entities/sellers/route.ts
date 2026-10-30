import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminAuth } from "@/lib/auth";

// GET /api/v1/entities/sellers - List onboarded sellers (Safe Public/Authorized View with PII Masking)
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    // Only return safe non-sensitive business fields (Do NOT expose bank accounts, IFSC, or PAN)
    const sellers = await prisma.seller.findMany({
      select: {
        id: true,
        legalName: true,
        gstin: true,
        kycStatus: true,
        creditLimitStatus: true,
        creditLimit: auth.role === "SELLER" ? true : false,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, count: sellers.length, data: sellers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/v1/entities/sellers - Admin-only manual provisioning of MSME seller
export async function POST(request: Request) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { legalName, gstin, pan, bankAccountNo, bankIfsc, creditLimit = 5000000 } = body;

    // Validation
    if (!legalName || !gstin || !pan || !bankAccountNo || !bankIfsc) {
      return NextResponse.json(
        { success: false, error: "All fields (legalName, gstin, pan, bankAccountNo, bankIfsc) are required." },
        { status: 400 }
      );
    }

    if (gstin.length !== 15) {
      return NextResponse.json(
        { success: false, error: "GSTIN must be exactly 15 characters." },
        { status: 400 }
      );
    }

    // Check duplicate GSTIN
    const existing = await prisma.seller.findUnique({
      where: { gstin: gstin.toUpperCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Seller with GSTIN '${gstin}' is already registered on UdharCo.` },
        { status: 409 }
      );
    }

    const seller = await prisma.seller.create({
      data: {
        legalName: legalName.trim(),
        gstin: gstin.toUpperCase().trim(),
        pan: pan.toUpperCase().trim(),
        bankAccountNo: bankAccountNo.trim(),
        bankIfsc: bankIfsc.toUpperCase().trim(),
        creditLimit: Number(creditLimit) || 5000000,
        kycStatus: "VERIFIED",
      },
    });

    return NextResponse.json(
      { success: true, message: "Seller onboarded successfully by Admin.", data: seller },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
