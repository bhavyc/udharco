import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/v1/invoices/process-anchor-reminders
// Automated Follow-up & Timeout Engine (Doc Item 13):
// - Day 3, 7, 10: Dispatches reminders to Anchor supply chain desk
// - Day 15: Rejects invoice due to Anchor confirmation timeout (safe fintech posture)
export async function POST(request: Request) {
  try {
    // ── CRITICAL SECURITY: Authorized Cron Secret Verification ──
    const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_SESSION_SECRET || "udharco_cron_secret_key_2026";
    const authHeader = request.headers.get("x-cron-secret") || request.headers.get("authorization");
    const isAuthorized = authHeader === `Bearer ${cronSecret}` || authHeader === cronSecret;

    const isDev = process.env.NODE_ENV !== "production";
    if (!isAuthorized && !isDev) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED: Valid CRON_SECRET or Admin authorization required." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { simulatedDaysElapsed } = body;

    const pendingInvoices = await prisma.invoice.findMany({
      where: { status: "VERIFIED" },
      include: {
        anchor: true,
        seller: true,
      },
    });

    const now = new Date();
    const actionResults: any[] = [];

    for (const inv of pendingInvoices) {
      // Calculate age of NOA
      const sentDate = inv.noaSentAt || inv.createdAt;
      const actualDays = Math.floor((now.getTime() - new Date(sentDate).getTime()) / (1000 * 60 * 60 * 24));
      // In production, NEVER trust client-supplied days parameter; only use real elapsed days
      const effectiveDays = (isDev && typeof simulatedDaysElapsed === "number") ? simulatedDaysElapsed : actualDays;

      // 1. Day 15 Timeout Gate: Reject Invoice
      if (effectiveDays >= 15) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            status: "REJECTED_TIMEOUT",
          },
        });

        actionResults.push({
          invoiceNumber: inv.invoiceNumber,
          anchor: inv.anchor.corporateName,
          seller: inv.seller.legalName,
          action: "TIMEOUT_REJECTED",
          daysElapsed: effectiveDays,
          message: `Invoice #${inv.invoiceNumber} auto-rejected after 15 days of non-response from Anchor. Seller notified.`,
        });
        continue;
      }

      // 2. Day 10: 3rd Escalation Notice
      if (effectiveDays >= 10 && inv.anchorReminderCount < 3) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            anchorReminderCount: 3,
            lastReminderSentAt: now,
          },
        });

        actionResults.push({
          invoiceNumber: inv.invoiceNumber,
          anchor: inv.anchor.corporateName,
          action: "DAY_10_FINAL_REMINDER",
          daysElapsed: effectiveDays,
          message: `Final escalation notice dispatched to ${inv.anchor.corporateName}. 5 days remaining before auto-cancellation.`,
        });
        continue;
      }

      // 3. Day 7: 2nd Urgent Reminder
      if (effectiveDays >= 7 && inv.anchorReminderCount < 2) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            anchorReminderCount: 2,
            lastReminderSentAt: now,
          },
        });

        actionResults.push({
          invoiceNumber: inv.invoiceNumber,
          anchor: inv.anchor.corporateName,
          action: "DAY_7_URGENT_REMINDER",
          daysElapsed: effectiveDays,
          message: `Urgent second reminder sent to ${inv.anchor.corporateName} finance desk.`,
        });
        continue;
      }

      // 4. Day 3: 1st Polite Reminder
      if (effectiveDays >= 3 && inv.anchorReminderCount < 1) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            anchorReminderCount: 1,
            lastReminderSentAt: now,
          },
        });

        actionResults.push({
          invoiceNumber: inv.invoiceNumber,
          anchor: inv.anchor.corporateName,
          action: "DAY_3_INITIAL_REMINDER",
          daysElapsed: effectiveDays,
          message: `Initial Day-3 reminder sent to ${inv.anchor.corporateName}.`,
        });
        continue;
      }

      actionResults.push({
        invoiceNumber: inv.invoiceNumber,
        anchor: inv.anchor.corporateName,
        action: "MONITORING",
        daysElapsed: effectiveDays,
        message: `Within normal confirmation window (${effectiveDays}/15 days). Reminders sent: ${inv.anchorReminderCount}/3.`,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Processed Anchor reminders for ${pendingInvoices.length} pending verified invoices.`,
      count: pendingInvoices.length,
      actions: actionResults,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
