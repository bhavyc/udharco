import { NextResponse } from "next/server";
import { SurepassService } from "@/lib/services/surepassService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { gstin } = body;

    if (!gstin || typeof gstin !== "string" || gstin.trim().length !== 15) {
      return NextResponse.json(
        { success: false, error: "A valid 15-character GSTIN is required." },
        { status: 400 }
      );
    }

    const result = await SurepassService.verifyGstin(gstin.trim());
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error during GSTIN lookup.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
