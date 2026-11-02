import { NextResponse } from "next/server";
import { SurepassService } from "@/lib/services/surepassService";

// In-memory rate limiting to prevent automated scraping of GST database
const gstRateTracker = new Map<string, { count: number; firstTime: number }>();

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

    const cleanGst = gstin.trim().toUpperCase();
    const now = Date.now();
    const record = gstRateTracker.get(cleanGst);
    if (record) {
      if (now - record.firstTime < 10 * 60 * 1000) {
        if (record.count >= 10) {
          return NextResponse.json(
            { success: false, error: "RATE_LIMIT_EXCEEDED: Too many GST queries for this GSTIN. Please wait 10 minutes." },
            { status: 429 }
          );
        }
        record.count += 1;
      } else {
        gstRateTracker.set(cleanGst, { count: 1, firstTime: now });
      }
    } else {
      gstRateTracker.set(cleanGst, { count: 1, firstTime: now });
    }

    const result = await SurepassService.verifyGstin(cleanGst);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error during GSTIN lookup.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
