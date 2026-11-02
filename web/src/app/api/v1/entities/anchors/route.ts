import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth";

// GET /api/v1/entities/anchors - List all corporate buyers (Safe Public/Entity Dropdown View)
export async function GET() {
  try {
    const anchors = await prisma.anchor.findMany({
      select: {
        id: true,
        corporateName: true,
        gstin: true,
        creditRating: true,
        status: true,
        standardPaymentTerms: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, count: anchors.length, data: anchors });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/v1/entities/anchors - Admin-only manual provisioning of Corporate Buyer
export async function POST(request: Request) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { corporateName, gstin, creditRating = "AAA", maxExposureLimit = 50000000 } = body;

    if (!corporateName || !gstin) {
      return NextResponse.json(
        { success: false, error: "corporateName and gstin are required." },
        { status: 400 }
      );
    }

    const existing = await prisma.anchor.findUnique({
      where: { gstin: gstin.toUpperCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Anchor with GSTIN '${gstin}' is already registered.` },
        { status: 409 }
      );
    }

    const anchor = await prisma.anchor.create({
      data: {
        corporateName: corporateName.trim(),
        gstin: gstin.toUpperCase().trim(),
        creditRating: creditRating.toUpperCase(),
        maxExposureLimit: Number(maxExposureLimit),
        currentExposure: 0,
        status: "ACTIVE",
      },
    });

    return NextResponse.json(
      { success: true, message: "Corporate Anchor registered successfully by Admin.", data: anchor },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
