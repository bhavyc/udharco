import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/v1/entities/anchors - List all corporate buyers
export async function GET() {
  try {
    const anchors = await prisma.anchor.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, count: anchors.length, data: anchors });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/v1/entities/anchors - Register Corporate Buyer (e.g. Tata Motors)
export async function POST(request: Request) {
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
      },
    });

    return NextResponse.json(
      { success: true, message: "Corporate Anchor registered successfully.", data: anchor },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
