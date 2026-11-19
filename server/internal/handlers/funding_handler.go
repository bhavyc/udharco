package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/bhavyc/udharco/server/internal/config"
	"github.com/bhavyc/udharco/server/internal/middleware"
	"github.com/bhavyc/udharco/server/internal/models"
	"github.com/bhavyc/udharco/server/internal/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type FundingHandler struct {
	DB  *gorm.DB
	Cfg *config.Config
}

func NewFundingHandler(db *gorm.DB, cfg *config.Config) *FundingHandler {
	return &FundingHandler{DB: db, Cfg: cfg}
}

// FundInvoice disburses 84% cash advance to seller, registers CERSAI charge, and marks FUNDED
func (h *FundingHandler) FundInvoice(c *gin.Context) {
	invoiceID := c.Param("id")
	authUser := middleware.GetAuthUser(c)

	var body struct {
		InvestorID   string  `json:"investorId"`
		FundedAmount float64 `json:"fundedAmount"`
	}
	_ = c.ShouldBindJSON(&body)

	investorID := body.InvestorID
	if authUser != nil && authUser.Role == "INVESTOR" {
		investorID = authUser.EntityID
	}

	// Transactional Database Lock with Row-Level Lock
	tx := h.DB.Begin()

	var invoice models.Invoice
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("Anchor").Preload("Seller").Where("id = ?", invoiceID).First(&invoice).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Invoice not found."})
		return
	}

	// Must be ready for funding (Checked under write-lock to eliminate race conditions)
	if invoice.Status != "LISTED" && invoice.Status != "ANCHOR_CONFIRMED" {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "INVOICE_NOT_FUNDABLE",
			"message": fmt.Sprintf("Invoice '%s' has status '%s'. Must be LISTED or ANCHOR_CONFIRMED to fund.", invoice.InvoiceNumber, invoice.Status),
		})
		return
	}

	// Fetch Investor
	var investor models.Investor
	if investorID != "" {
		tx.Where("id = ?", investorID).First(&investor)
	}
	if investor.ID == "" {
		// Default to first active institutional funder
		tx.Order("escrow_balance desc").First(&investor)
	}

	if investor.ID == "" {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "No institutional investor found to clear funding."})
		return
	}

	fundAmount := invoice.UpfrontDisbursedAmount
	if fundAmount <= 0 {
		fundAmount = math.Round(invoice.TotalAmount * 0.84)
	}

	// 1. Deduct from Investor Escrow Balance
	if investor.EscrowBalance >= fundAmount {
		tx.Model(&investor).Update("escrow_balance", investor.EscrowBalance-fundAmount)
	}

	// 2. Increase Corporate Anchor Current Exposure
	tx.Model(&invoice.Anchor).Update("current_exposure", invoice.Anchor.CurrentExposure+invoice.TotalAmount)

	// 3. Create Funding Bid Record
	tenureYears := float64(invoice.TenureDays) / 365.0
	expectedReturn := fundAmount * (1.0 + (invoice.DiscountRatePa/100.0)*tenureYears)

	bid := models.FundingBid{
		FundedAmount:   fundAmount,
		ExpectedReturn: expectedReturn,
		Status:         "CONFIRMED",
		InvoiceID:      invoice.ID,
		InvestorID:     investor.ID,
	}
	tx.Create(&bid)

	// 4. Record Escrow Payout Transaction
	escrowTx := models.EscrowTransaction{
		TransactionType: "INVESTOR_PAYOUT",
		Amount:          fundAmount,
		Notes:           &[]string{fmt.Sprintf("84%% Upfront cash advance disbursed to %s bank account", invoice.Seller.LegalName)}[0],
		InvoiceID:       invoice.ID,
	}
	tx.Create(&escrowTx)

	// 5. 🔒 CRITICAL CERSAI REGISTRATION (STRICTLY AT FUNDED STAGE!)
	now := time.Now()
	cersaiID := fmt.Sprintf("CERSAI-SEC-%d", now.Unix()%100000000)

	tx.Model(&invoice).Updates(map[string]interface{}{
		"status":                   "FUNDED",
		"funded_at":                now,
		"upfront_disbursed_amount": fundAmount,
		"cersai_security_id":       cersaiID,
		"cersai_status":            "REGISTERED", // Registered upon actual funding!
	})

	// 6. Audit Log
	meta, _ := json.Marshal(map[string]interface{}{
		"invoiceNumber":          invoice.InvoiceNumber,
		"investor":               investor.EntityName,
		"upfront84Disbursed":     fundAmount,
		"escrow15MarginHeld":     invoice.MarginHeldAmount,
		"cersaiSecurityId":       cersaiID,
		"cersaiStatus":           "REGISTERED",
		"benchmarkDiscountRate":  invoice.DiscountRatePa,
	})
	metaStr := string(meta)
	tx.Create(&models.AuditLog{
		EntityType: "INVOICE",
		EntityID:   invoice.ID,
		Action:     "INVOICE_FUNDED_AND_CERSAI_CHARGE_REGISTERED",
		ActorRole:  "INVESTOR",
		ActorID:    &investor.ID,
		Metadata:   &metaStr,
	})

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Invoice funded successfully! ₹%.2f (84%% advance) disbursed to MSME. CERSAI charge registered (%s).", fundAmount, cersaiID),
		"data": gin.H{
			"invoiceId":              invoice.ID,
			"invoiceNumber":          invoice.InvoiceNumber,
			"status":                 "FUNDED",
			"upfrontDisbursedAmount": fundAmount,
			"cersaiSecurityId":       cersaiID,
			"cersaiStatus":           "REGISTERED",
		},
	})
}

// SettleInvoice executes 3-way financial waterfall upon corporate payment into VAN
func (h *FundingHandler) SettleInvoice(c *gin.Context) {
	invoiceID := c.Param("id")
	authUser := middleware.GetAuthUser(c)

	var body struct {
		RepaymentAmount *float64 `json:"repaymentAmount"`
		IsDefault       bool     `json:"isDefault"`
	}
	_ = c.ShouldBindJSON(&body)

	var invoice models.Invoice
	if err := h.DB.Preload("Anchor").Preload("Seller").Preload("FundingBids.Investor").
		Where("id = ?", invoiceID).First(&invoice).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Invoice not found."})
		return
	}

	// Access Control: Only Platform Admin or the Designated Corporate Buyer can execute settlement
	isAuthorized := authUser != nil && (authUser.Role == "ADMIN" || (authUser.Role == "ANCHOR" && authUser.EntityID == invoice.AnchorID))
	if !isAuthorized {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "FORBIDDEN: Only Admin or the Corporate Buyer may execute settlement."})
		return
	}

	if invoice.Status != "FUNDED" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "INVOICE_NOT_SETTLEABLE",
			"message": fmt.Sprintf("Invoice '%s' has status '%s'. Only FUNDED invoices can be settled.", invoice.InvoiceNumber, invoice.Status),
		})
		return
	}

	repaymentAmount := invoice.TotalAmount
	if body.IsDefault {
		repaymentAmount = 0
	} else if body.RepaymentAmount != nil {
		repaymentAmount = *body.RepaymentAmount
	}

	principal := invoice.UpfrontDisbursedAmount
	tenureYears := float64(invoice.TenureDays) / 365.0
	expectedYield := principal * (invoice.DiscountRatePa / 100.0) * tenureYears
	flatPlatformFee := math.Round((invoice.TotalAmount * invoice.PlatformFeePct / 100.0) * 100) / 100
	platformSpread := math.Round(((principal * (1.0 / 100.0) * float64(invoice.TenureDays)) / 365.0) * 100) / 100
	platformFee := flatPlatformFee + platformSpread

	settlementEngine := services.NewSettlementService()
	wf := settlementEngine.CalculateWaterfall(services.WaterfallInput{
		TotalInvoiceAmount:    invoice.TotalAmount,
		RepaymentAmount:       repaymentAmount,
		FundedPrincipal:       principal,
		ExpectedInvestorYield: expectedYield,
		PlatformFeeAmount:     platformFee,
		RecourseType:          invoice.RecourseType,
	})

	tx := h.DB.Begin()

	now := time.Now()

	// 1. Settlement Record
	settlement := models.SettlementRecord{
		TotalReceived:         wf.TotalReceived,
		InvestorPrincipalPaid: wf.InvestorPrincipalPaid,
		InvestorInterestPaid:  wf.InvestorInterestPaid,
		PlatformFeeDeducted:   wf.PlatformFeeDeducted,
		SellerMarginReturned:  wf.SellerMarginReturned,
		ShortfallAmount:       wf.ShortfallAmount,
		RecourseTriggered:     wf.RecourseTriggered,
		InvoiceID:             invoice.ID,
		SettledAt:             now,
	}
	tx.Create(&settlement)

	// 2. Return Escrow Reserve to MSME Seller if any
	if wf.SellerMarginReturned > 0 {
		tx.Create(&models.EscrowTransaction{
			TransactionType: "SELLER_MARGIN_RELEASE",
			Amount:          wf.SellerMarginReturned,
			Notes:           &[]string{fmt.Sprintf("15%% Escrow reserve returned to %s upon settlement", invoice.Seller.LegalName)}[0],
			InvoiceID:       invoice.ID,
		})
	}

	// 3. Return Principal + Yield to Investor
	if len(invoice.FundingBids) > 0 {
		inv := invoice.FundingBids[0].Investor
		tx.Model(&inv).Update("escrow_balance", inv.EscrowBalance+wf.InvestorTotalPayout)
	}

	// 4. Reduce Corporate Anchor Exposure
	newExposure := math.Max(0, invoice.Anchor.CurrentExposure-wf.TotalReceived)
	tx.Model(&invoice.Anchor).Update("current_exposure", newExposure)

	// 5. Update Invoice status (SETTLED or DEFAULTED)
	finalStatus := "SETTLED"
	if wf.Outcome == "DEFAULT" {
		finalStatus = "DEFAULTED"
	}
	tx.Model(&invoice).Updates(map[string]interface{}{
		"status":     finalStatus,
		"settled_at": now,
	})

	// 6. Audit Log
	meta, _ := json.Marshal(map[string]interface{}{
		"invoiceNumber":        invoice.InvoiceNumber,
		"totalReceived":        wf.TotalReceived,
		"investorYieldPaid":    wf.InvestorInterestPaid,
		"platformFeeDeducted":  wf.PlatformFeeDeducted,
		"sellerMarginReturned": wf.SellerMarginReturned,
		"shortfall":            wf.ShortfallAmount,
		"recourseTriggered":    wf.RecourseTriggered,
		"status":               finalStatus,
		"notes":                wf.Notes,
	})
	metaStr := string(meta)
	tx.Create(&models.AuditLog{
		EntityType: "INVOICE",
		EntityID:   invoice.ID,
		Action:     "INVOICE_SETTLEMENT_WATERFALL_EXECUTED",
		ActorRole:  "SYSTEM",
		Metadata:   &metaStr,
	})

	tx.Commit()

	msg := fmt.Sprintf("Invoice %s fully settled! 15%% escrow margin (₹%.2f) returned to MSME Seller.", invoice.InvoiceNumber, wf.SellerMarginReturned)
	if wf.Outcome != "FULL_PAYMENT" {
		msg = wf.Notes
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": msg,
		"data":    settlement,
	})
}

// EscrowWebhook processes incoming bank credits into Virtual Escrow Accounts
func (h *FundingHandler) EscrowWebhook(c *gin.Context) {
	var raw struct {
		Event          string  `json:"event"`
		EventID        string  `json:"eventId"`
		Provider       string  `json:"provider"`
		IdempotencyKey string  `json:"idempotencyKey"`
		VAN            string  `json:"virtualAccountNumber"`
		Amount         float64 `json:"amount"`
		UTR            string  `json:"utr"`
		Data           struct {
			VirtualAccountNumber string  `json:"virtualAccountNumber"`
			InvoiceID            string  `json:"invoiceId"`
			InvoiceNumber        string  `json:"invoiceNumber"`
			Amount               float64 `json:"amount"`
			BankReferenceNumber  string  `json:"bankReferenceNumber"`
			RemitterName         string  `json:"remitterName"`
			PaymentMode          string  `json:"paymentMode"`
		} `json:"data"`
	}

	if err := c.ShouldBindJSON(&raw); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid webhook payload."})
		return
	}

	// Resolve VAN and Amount whether flat or nested in data
	van := raw.VAN
	if van == "" {
		van = raw.Data.VirtualAccountNumber
	}
	amount := raw.Amount
	if amount <= 0 {
		amount = raw.Data.Amount
	}
	idempotencyKey := raw.IdempotencyKey
	if idempotencyKey == "" {
		idempotencyKey = raw.EventID
	}
	if idempotencyKey == "" {
		idempotencyKey = raw.Data.BankReferenceNumber
	}
	if idempotencyKey == "" {
		idempotencyKey = fmt.Sprintf("UTR-%d", time.Now().UnixNano())
	}

	// Idempotency check
	var existingEvent models.WebhookEvent
	if err := h.DB.Where("idempotency_key = ?", idempotencyKey).First(&existingEvent).Error; err == nil {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": fmt.Sprintf("Idempotent replay: Webhook event '%s' was already processed. Duplicate payout blocked.", idempotencyKey),
			"status":  "DUPLICATE_SKIPPED",
		})
		return
	}

	// Record Webhook Event
	payload, _ := json.Marshal(raw)
	provider := raw.Provider
	if provider == "" {
		provider = "ICICI_ESCROW"
	}
	event := models.WebhookEvent{
		IdempotencyKey: idempotencyKey,
		Provider:       provider,
		EventType:      "REPAYMENT_RECEIVED",
		Payload:        string(payload),
		Status:         "PROCESSED",
		ProcessedAt:    time.Now(),
	}
	h.DB.Create(&event)

	// Match VAN to Invoice
	var invoice models.Invoice
	if err := h.DB.Where("virtual_account_number = ?", van).First(&invoice).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Webhook logged. No invoice matching this VAN."})
		return
	}

	// Auto-trigger settlement if funded
	if invoice.Status == "FUNDED" {
		c.Params = append(c.Params, gin.Param{Key: "id", Value: invoice.ID})
		h.SettleInvoice(c)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Bank repayment logged successfully."})
}

// TriggerRecourse triggers e-NACH auto-debit recovery if debtor defaults
func (h *FundingHandler) TriggerRecourse(c *gin.Context) {
	invoiceID := c.Param("id")

	var invoice models.Invoice
	if err := h.DB.Preload("Seller").Where("id = ?", invoiceID).First(&invoice).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Invoice not found."})
		return
	}

	amount := invoice.UpfrontDisbursedAmount

	h.DB.Model(&invoice).Update("status", "DEFAULTED")

	h.DB.Create(&models.EscrowTransaction{
		TransactionType: "RECOURSE_RECOVERY",
		Amount:          amount,
		Notes:           &[]string{fmt.Sprintf("e-NACH recourse auto-debit executed against %s mandate %s", invoice.Seller.LegalName, *invoice.Seller.EnachMandateID)}[0],
		InvoiceID:       invoice.ID,
	})

	meta, _ := json.Marshal(map[string]interface{}{
		"invoiceNumber": invoice.InvoiceNumber,
		"mandateId":     invoice.Seller.EnachMandateID,
		"recoveredAmount": amount,
		"recourseLaw":   "Factoring Regulation Act, 2011 Section 10",
	})
	metaStr := string(meta)
	h.DB.Create(&models.AuditLog{
		EntityType: "INVOICE",
		EntityID:   invoice.ID,
		Action:     "RECOURSE_RECOVERY_EXECUTED",
		ActorRole:  "ADMIN",
		Metadata:   &metaStr,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("e-NACH recourse recovery initiated for ₹%.2f per RBI Factoring Act.", amount),
	})
}
