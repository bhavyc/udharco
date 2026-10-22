import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/v1/entities/investors - List all funders/investors
export async function GET() {
  try {
    const investors = await prisma.investor.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, count: investors.length, data: investors });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/v1/entities/investors - Register Funder / NBFC with initial virtual escrow deposit
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { entityName, investorType = "NBFC", initialEscrowDeposit = 10000000 } = body;

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
        escrowBalance: Number(initialEscrowDeposit),
      },
    });

    return NextResponse.json(
      { success: true, message: "Investor/NBFC registered with escrow wallet.", data: investor },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
