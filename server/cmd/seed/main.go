package main

import (
	"log"

	"github.com/bhavyc/udharco/server/internal/config"
	"github.com/bhavyc/udharco/server/internal/database"
	"github.com/bhavyc/udharco/server/internal/models"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	cfg := config.LoadConfig()
	db := database.InitDB(cfg)

	log.Println("🌱 Seeding UdharCo Golang Database with standard entities and users...")

	// 1. Seed MSME Seller: Raju Steel & Pipes Pvt Ltd
	mandateID := "MND-NPCI-882910"
	seller := models.Seller{
		LegalName:          "Raju Steel & Pipes Pvt Ltd",
		GSTIN:              "27AABCU9603R1ZX",
		PAN:                "AABCU9603R",
		BankAccountNo:      "50200012345678",
		BankIFSC:           "HDFC0001234",
		KYCStatus:          "VERIFIED",
		EnachMandateID:     &mandateID,
		EnachMandateStatus: "ACTIVE",
		CreditLimit:        5000000, // ₹50 Lakh
		CreditLimitStatus:  "SANCTIONED",
	}

	var existingSeller models.Seller
	if err := db.Where("gstin = ?", seller.GSTIN).First(&existingSeller).Error; err != nil {
		db.Create(&seller)
		log.Println("✅ Seeded Seller:", seller.LegalName)
	} else {
		seller = existingSeller
	}

	// Seller User
	sellerMobile := "9876543210"
	var sellerUser models.User
	if err := db.Where("mobile = ?", sellerMobile).First(&sellerUser).Error; err != nil {
		sellerUser = models.User{
			Mobile:   &sellerMobile,
			Role:     "SELLER",
			SellerID: &seller.ID,
			IsActive: true,
		}
		db.Create(&sellerUser)
		log.Println("✅ Seeded Seller User (Mobile):", sellerMobile)
	}

	// 2. Seed Corporate Anchor 1 (Active AAA): Tata Motors Ltd
	procurement := 250000000.0 // ₹25 Cr
	paymentTerms := 60
	emailTata := "treasury@tatamotors.com"
	tataAnchor := models.Anchor{
		CorporateName:        "Tata Motors Ltd",
		GSTIN:                "27AAACT2727Q1ZW",
		CreditRating:         "AAA",
		MaxExposureLimit:     50000000, // ₹5.0 Cr Limit
		CurrentExposure:      0,
		Status:               "ACTIVE",
		SourceChannel:        "ENTERPRISE_SALES",
		ContactEmail:         &emailTata,
		AnnualProcurement:    &procurement,
		StandardPaymentTerms: &paymentTerms,
	}

	var existingTata models.Anchor
	if err := db.Where("gstin = ?", tataAnchor.GSTIN).First(&existingTata).Error; err != nil {
		db.Create(&tataAnchor)
		log.Println("✅ Seeded Active Anchor:", tataAnchor.CorporateName)
	} else {
		tataAnchor = existingTata
	}

	// 2b. Seed Corporate Anchor 2 (Pending Underwriting): Mahindra Auto Ancillaries
	emailMahindra := "treasury@mahindra-ancillaries.com"
	phoneMahindra := "+91 98200 11223"
	contactPersonMahindra := "Rajesh Sharma"
	pendingAnchor := models.Anchor{
		CorporateName: "Mahindra Auto Ancillaries Ltd",
		GSTIN:         "27AABCM6789P1Z3",
		CreditRating:  "UNRATED",
		MaxExposureLimit: 0, // Unsanctioned ₹0.00
		CurrentExposure: 0,
		Status:        "PENDING",
		SourceChannel: "VENDOR_PUSH",
		ContactEmail:  &emailMahindra,
		ContactPhone:  &phoneMahindra,
		ContactPerson: &contactPersonMahindra,
	}
	var existingMahindra models.Anchor
	if err := db.Where("gstin = ?", pendingAnchor.GSTIN).First(&existingMahindra).Error; err != nil {
		db.Create(&pendingAnchor)
		log.Println("✅ Seeded Pending Anchor:", pendingAnchor.CorporateName)
	}

	// 3. Seed Institutional Investor: Institutional Capital NBFC
	investor := models.Investor{
		EntityName:    "Institutional Capital NBFC",
		InvestorType:  "NBFC",
		EscrowBalance: 25000000, // ₹2.5 Cr Escrow balance
	}
	var existingInvestor models.Investor
	if err := db.Where("entity_name = ?", investor.EntityName).First(&existingInvestor).Error; err != nil {
		db.Create(&investor)
		log.Println("✅ Seeded Investor:", investor.EntityName)
	} else {
		investor = existingInvestor
	}

	// Investor User
	investorEmail := "treasury@capitalpartner.in"
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	hashStr := string(hashedPassword)
	var investorUser models.User
	if err := db.Where("email = ?", investorEmail).First(&investorUser).Error; err != nil {
		investorUser = models.User{
			Email:        &investorEmail,
			PasswordHash: &hashStr,
			Role:         "INVESTOR",
			InvestorID:   &investor.ID,
			IsActive:     true,
		}
		db.Create(&investorUser)
		log.Println("✅ Seeded Investor User:", investorEmail)
	}

	// 4. Seed Root Admin User: admin@udharco.com
	adminEmail := "admin@udharco.com"
	var admin models.AdminUser
	if err := db.Where("email = ?", adminEmail).First(&admin).Error; err != nil {
		admin = models.AdminUser{
			Email:        adminEmail,
			PasswordHash: hashStr,
			IsActive:     true,
		}
		db.Create(&admin)
		log.Println("✅ Seeded Root Admin:", adminEmail, "(Password: admin123)")
	}

	log.Println("🎉 Database seeding complete!")
}
