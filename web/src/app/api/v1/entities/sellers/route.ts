import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminAuth } from "@/lib/auth";

// GET /api/v1/entities/sellers - List onboarded sellers (Role-scoped Multi-Tenant Safe View)
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    let whereClause = {};

    if (auth.role === "SELLER") {
      // MSME Seller can ONLY see their own profile
      whereClause = { id: auth.entityId };
    } else if (auth.role === "ANCHOR") {
      // Anchors only see suppliers who have submitted invoices to them
      const anchorInvoices = await prisma.invoice.findMany({
        where: { anchorId: auth.entityId },
        select: { sellerId: true },
      });
      const sellerIds = Array.from(new Set(anchorInvoices.map((inv) => inv.sellerId)));
      whereClause = { id: { in: sellerIds } };
    } else {
      // INVESTOR: Can see sellers of invoices eligible for funding
      whereClause = {};
    }

    const sellers = await prisma.seller.findMany({
      where: whereClause,
      select: {
        id: true,
        legalName: true,
        gstin: true,
        kycStatus: true,
        creditLimitStatus: true,
        creditLimit: auth.role === "SELLER",
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
