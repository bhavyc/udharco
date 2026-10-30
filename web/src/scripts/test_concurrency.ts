import { prisma } from "../lib/prisma";

async function main() {
  console.log("==================================================");
  console.log("   FINTECH CONCURRENCY & RACE-CONDITION TEST      ");
  console.log("==================================================");

  // 1. Setup a test anchor with ₹50 Lakh limit
  const testAnchor = await prisma.anchor.create({
    data: {
      corporateName: "TEST CONCURRENCY CORP " + Date.now(),
      gstin: "27AAACT" + Math.floor(1000 + Math.random() * 9000) + "A1Z" + Math.floor(Math.random() * 9),
      creditRating: "AAA",
      maxExposureLimit: 5000000, // ₹50 Lakhs limit
      currentExposure: 0,        // ₹0 used initially
      status: "ACTIVE",
    },
  });

  console.log(`[SETUP] Created test Anchor: ${testAnchor.corporateName}`);
  console.log(`[SETUP] Max Limit: ₹${testAnchor.maxExposureLimit.toLocaleString()}, Initial Exposure: ₹${testAnchor.currentExposure.toLocaleString()}`);

  // Simulation parameters:
  // 3 simultaneous requests firing at the exact same millisecond:
  // - Request A: ₹30,00,000
  // - Request B: ₹25,00,000
  // - Request C: ₹10,00,000
  // Total attempted = ₹65,00,000 (exceeds ₹50L by ₹15L)
  const requests = [
    { name: "Request 1 (₹15L)", amount: 1500000 },
    { name: "Request 2 (₹15L)", amount: 1500000 },
    { name: "Request 3 (₹15L)", amount: 1500000 },
    { name: "Request 4 (₹15L)", amount: 1500000 },
    { name: "Request 5 (₹15L)", amount: 1500000 },
  ];

  console.log("\n[TEST] Firing 5 simultaneous requests of ₹15L each (Total ₹75L against ₹50L limit)...");

  async function simulateAnchorConfirm(reqName: string, amount: number) {
    try {
      return await prisma.$transaction(async (tx) => {
        // EXACT ATOMIC CONDITIONAL SQL UPDATE AS IN anchor-confirm/route.ts
        const affectedRows = await tx.$executeRaw`
          UPDATE "anchors"
          SET "currentExposure" = "currentExposure" + ${amount}
          WHERE "id" = ${testAnchor.id}
            AND "status" = 'ACTIVE'
            AND ("currentExposure" + ${amount}) <= "maxExposureLimit"
        `;

        if (affectedRows === 0) {
          const fresh = await tx.anchor.findUnique({ where: { id: testAnchor.id } });
          const avail = fresh ? fresh.maxExposureLimit - fresh.currentExposure : 0;
          throw new Error(`ANCHOR_EXPOSURE_EXCEEDED: Headroom is ₹${avail.toLocaleString()}, requested ₹${amount.toLocaleString()}`);
        }

        return { success: true as const, reqName, amount };
      });
    } catch (err: any) {
      return { success: false as const, reqName, amount, error: err.message };
    }
  }

  const results = await Promise.all(
    requests.map((r) => simulateAnchorConfirm(r.name, r.amount))
  );

  console.log("\n[RESULTS] Execution summary:");
  for (const res of results) {
    if (res.success) {
      console.log(`  ✅ ${res.reqName} (₹${res.amount.toLocaleString()}): SUCCESS (Allocated)`);
    } else {
      console.log(`  ❌ ${res.reqName} (₹${res.amount.toLocaleString()}): REJECTED (${res.error})`);
    }
  }

  // Verify final database state
  const finalAnchor = await prisma.anchor.findUnique({ where: { id: testAnchor.id } });
  console.log("\n[VERIFICATION] Final Database State:");
  console.log(`  Approved Limit   : ₹${finalAnchor?.maxExposureLimit.toLocaleString()}`);
  console.log(`  Final Exposure   : ₹${finalAnchor?.currentExposure.toLocaleString()}`);
  console.log(`  Remaining Headroom: ₹${((finalAnchor?.maxExposureLimit || 0) - (finalAnchor?.currentExposure || 0)).toLocaleString()}`);

  const isSafe = (finalAnchor?.currentExposure || 0) <= (finalAnchor?.maxExposureLimit || 0);
  if (isSafe) {
    console.log(`\n🏆 CONCLUSION: ZERO RACE CONDITION! Final exposure (₹${finalAnchor?.currentExposure.toLocaleString()}) strictly <= max limit (₹${finalAnchor?.maxExposureLimit.toLocaleString()}). Overflow requests were safely rejected by atomic conditional lock.`);
  } else {
    console.error(`\n🚨 CRITICAL FAILURE: Race condition occurred! Over-allocated to ₹${finalAnchor?.currentExposure.toLocaleString()}`);
  }

  // Cleanup test anchor
  await prisma.anchor.delete({ where: { id: testAnchor.id } });
  console.log("\n[CLEANUP] Deleted test anchor.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
