import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding UdharCo database with entities and authenticated users...");

  // 1. Seed MSME Seller
  const seller = await prisma.seller.upsert({
    where: { gstin: "27AABCU9603R1ZX" },
    update: {
      creditLimit: 5000000,
      creditLimitStatus: "SANCTIONED",
      kycStatus: "VERIFIED",
    },
    create: {
      legalName: "Raju Steel & Pipes Pvt Ltd",
      gstin: "27AABCU9603R1ZX",
      pan: "AABCU9603R",
      bankAccountNo: "50200012345678",
      bankIfsc: "HDFC0001234",
      kycStatus: "VERIFIED",
      enachMandateId: "MND-NPCI-882910",
      enachMandateStatus: "ACTIVE",
      creditLimit: 5000000,
      creditLimitStatus: "SANCTIONED",
    },
  });
  console.log("✅ Seeded Seller:", seller.legalName);

  // Link Seller User (Mobile OTP based: 9876543210)
  const sellerUser = await prisma.user.upsert({
    where: { mobile: "9876543210" },
    update: { sellerId: seller.id, isActive: true },
    create: {
      mobile: "9876543210",
      role: "SELLER",
      sellerId: seller.id,
      isActive: true,
    },
  });
  console.log("✅ Seeded Seller User (Mobile):", sellerUser.mobile);

  // 2. Seed Corporate Anchor
  const anchor = await prisma.anchor.upsert({
    where: { gstin: "27AAACT2727Q1ZW" },
    update: {},
    create: {
      corporateName: "Tata Motors Ltd",
      gstin: "27AAACT2727Q1ZW",
      creditRating: "AAA",
      maxExposureLimit: 50000000, // ₹5 Cr limit
      currentExposure: 0,
      status: "ACTIVE",
      sourceChannel: "ENTERPRISE_SALES",
    },
  });
  console.log("✅ Seeded Anchor:", anchor.corporateName);

  // Link Anchor User (Email: tata.motors@tatamotors.com / Anchor@123456)
  const anchorPasswordHash = await bcrypt.hash("Anchor@123456", 12);
  const anchorUser = await prisma.user.upsert({
    where: { email: "tata.motors@tatamotors.com" },
    update: { anchorId: anchor.id, passwordHash: anchorPasswordHash, isActive: true },
    create: {
      email: "tata.motors@tatamotors.com",
      passwordHash: anchorPasswordHash,
      role: "ANCHOR",
      anchorId: anchor.id,
      isActive: true,
    },
  });
  console.log("✅ Seeded Anchor User (Email):", anchorUser.email);

  // 3. Seed Institutional Investor
  let investor = await prisma.investor.findFirst({
    where: { entityName: "Bajaj Finance NBFC" },
  });

  if (!investor) {
    investor = await prisma.investor.create({
      data: {
        entityName: "Bajaj Finance NBFC",
        investorType: "NBFC",
        escrowBalance: 25000000, // ₹2.5 Cr virtual escrow
      },
    });
  }
  console.log("✅ Seeded Investor:", investor.entityName);

  // Link Investor User (Email: treasury@bajajfinserv.in / Investor@123456)
  const investorPasswordHash = await bcrypt.hash("Investor@123456", 12);
  const investorUser = await prisma.user.upsert({
    where: { email: "treasury@bajajfinserv.in" },
    update: { investorId: investor.id, passwordHash: investorPasswordHash, isActive: true },
    create: {
      email: "treasury@bajajfinserv.in",
      passwordHash: investorPasswordHash,
      role: "INVESTOR",
      investorId: investor.id,
      isActive: true,
    },
  });
  console.log("✅ Seeded Investor User (Email):", investorUser.email);

  // 4. Seed Platform AdminUser (admin@udharco.com / Admin@123456)
  const adminPasswordHash = await bcrypt.hash("Admin@123456", 12);
  const admin = await prisma.adminUser.upsert({
    where: { email: "admin@udharco.com" },
    update: { passwordHash: adminPasswordHash, isActive: true },
    create: {
      email: "admin@udharco.com",
      passwordHash: adminPasswordHash,
      isActive: true,
      twoFactorEnabled: false, // Default off for seamless dev testing
    },
  });
  console.log("✅ Seeded SuperAdmin User:", admin.email);

  console.log("🎉 All users and entities seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
