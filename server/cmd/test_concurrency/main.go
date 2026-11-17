package main

import (
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/bhavyc/udharco/server/internal/config"
	"github.com/bhavyc/udharco/server/internal/database"
	"github.com/bhavyc/udharco/server/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func main() {
	cfg := config.LoadConfig()
	db := database.InitDB(cfg)

	log.Println("🧪 Starting Go Concurrency & Race-Condition Stress Test (50 Parallel Goroutines)...")

	// 1. Fetch or create a test LISTED invoice
	var seller models.Seller
	db.First(&seller)

	var anchor models.Anchor
	db.Where("status = 'ACTIVE'").First(&anchor)

	invNumber := fmt.Sprintf("INV-CONC-%d", time.Now().Unix()%10000)
	hash := fmt.Sprintf("hash-conc-%d", time.Now().UnixNano())

	invoice := models.Invoice{
		InvoiceNumber:          invNumber,
		FinancialYear:          "2026-27",
		InvoiceDate:            time.Now(),
		DueDate:                time.Now().Add(90 * 24 * time.Hour),
		TenureDays:             90,
		TotalAmount:            1000000, // ₹10 Lakh
		UpfrontDisbursedAmount: 840000,  // ₹8.4 Lakh
		MarginHeldAmount:       150000,
		Status:                 "LISTED", // Ready for funding
		InvoiceHash:            hash,
		SellerID:               seller.ID,
		AnchorID:               anchor.ID,
		CersaiStatus:           "PENDING",
	}
	db.Create(&invoice)
	log.Printf("📄 Created test invoice '%s' (Status: LISTED, Amount: ₹10.00 L)", invoice.InvoiceNumber)

	var investor models.Investor
	db.First(&investor)

	// Concurrency Simulation: 50 parallel Goroutines firing simultaneously
	concurrencyCount := 50
	var wg sync.WaitGroup
	var successCount int64
	var rejectedCount int64

	startBarrier := make(chan struct{})

	for i := 0; i < concurrencyCount; i++ {
		wg.Add(1)
		go func(routineID int) {
			defer wg.Done()

			// Wait for barrier to trigger simultaneously
			<-startBarrier

			// Transaction with Row-Level Lock
			err := db.Transaction(func(tx *gorm.DB) error {
				var target models.Invoice
				// Use Clauses(clause.Locking{Strength: "UPDATE"}) for row-level lock
				if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", invoice.ID).First(&target).Error; err != nil {
					return err
				}

				if target.Status != "LISTED" {
					return fmt.Errorf("INVOICE_ALREADY_FUNDED: status is %s", target.Status)
				}

				// Mark funded
				now := time.Now()
				cersaiID := fmt.Sprintf("CERSAI-CONC-%d", now.UnixNano()%100000)
				tx.Model(&target).Updates(map[string]interface{}{
					"status":             "FUNDED",
					"funded_at":          now,
					"cersai_security_id": cersaiID,
					"cersai_status":      "REGISTERED",
				})

				bid := models.FundingBid{
					FundedAmount:   target.UpfrontDisbursedAmount,
					ExpectedReturn: target.UpfrontDisbursedAmount * 1.11,
					Status:         "CONFIRMED",
					InvoiceID:      target.ID,
					InvestorID:     investor.ID,
				}
				return tx.Create(&bid).Error
			})

			if err == nil {
				atomic.AddInt64(&successCount, 1)
			} else {
				atomic.AddInt64(&rejectedCount, 1)
			}
		}(i)
	}

	// Unleash all 50 Goroutines simultaneously
	close(startBarrier)
	wg.Wait()

	log.Println("─────────────────────────────────────────────────────────────────")
	log.Printf("📊 Stress Test Results across %d Concurrent Workers:", concurrencyCount)
	log.Printf("   ✅ Successfully Funded: %d (Expected: Exactly 1)", successCount)
	log.Printf("   🛡️ Rejected Race Conditions: %d (Expected: Exactly %d)", rejectedCount, concurrencyCount-1)

	// Verify in DB that only 1 bid exists
	var bidCount int64
	db.Model(&models.FundingBid{}).Where("invoice_id = ?", invoice.ID).Count(&bidCount)
	log.Printf("   🔒 Verified Bids in DB: %d", bidCount)

	if successCount == 1 && rejectedCount == int64(concurrencyCount-1) && bidCount == 1 {
		log.Println("🏆 TEST PASSED: Zero double-financing, zero race conditions! Goroutine safety confirmed.")
	} else {
		log.Fatalf("❌ TEST FAILED: Over-allocation occurred! (success: %d, bids: %d)", successCount, bidCount)
	}
}
