import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/v1/entities/sellers - List all onboarded sellers
export async function GET() {
  try {
    const sellers = await prisma.seller.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, count: sellers.length, data: sellers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/v1/entities/sellers - Onboard a new MSME seller with duplicate GSTIN check
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { legalName, gstin, pan, bankAccountNo, bankIfsc } = body;

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
        kycStatus: "VERIFIED",
      },
    });

    return NextResponse.json(
      { success: true, message: "Seller onboarded successfully.", data: seller },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
