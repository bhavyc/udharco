import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminAuth } from "@/lib/auth";

// GET /api/v1/entities/investors - List funders/investors (Strict Multi-Tenant Role Isolation)
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Sellers and Corporate Anchors have no operational need or permission to view institutional escrow liquidity pools
  if (auth.role !== "INVESTOR") {
    return NextResponse.json({ success: true, count: 0, data: [] });
  }

  try {
    const investors = await prisma.investor.findMany({
      where: { id: auth.entityId },
      select: {
        id: true,
        entityName: true,
        investorType: true,
        escrowBalance: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, count: investors.length, data: investors });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/v1/entities/investors - Admin-only provisioning of Funder / NBFC
export async function POST(request: Request) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { entityName, investorType = "NBFC", initialEscrowDeposit = 0 } = body;

    if (!entityName) {
      return NextResponse.json(
        { success: false, error: "entityName is required." },
        { status: 400 }
      );
    }

    const investor = await prisma.investor.create({
      data: {
        entityName: entityName.trim(),
        investorType: investorType.toUpperCase(),
        escrowBalance: Math.max(0, Number(initialEscrowDeposit) || 0),
      },
    });

    return NextResponse.json(
      { success: true, message: "Investor/NBFC registered with escrow wallet by Admin.", data: investor },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
