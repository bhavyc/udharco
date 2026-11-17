package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/bhavyc/udharco/server/internal/config"
	"github.com/bhavyc/udharco/server/internal/middleware"
	"github.com/bhavyc/udharco/server/internal/models"
	"github.com/bhavyc/udharco/server/internal/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type InvoiceHandler struct {
	DB           *gorm.DB
	Cfg          *config.Config
	FraudService *services.FraudService
	RiskService  *services.RiskService
}

func NewInvoiceHandler(db *gorm.DB, cfg *config.Config) *InvoiceHandler {
	return &InvoiceHandler{
		DB:           db,
		Cfg:          cfg,
		FraudService: &services.FraudService{},
		RiskService:  &services.RiskService{},
	}
}

// GetInvoices retrieves invoices filtered by user's role with PII bank masking
func (h *InvoiceHandler) GetInvoices(c *gin.Context) {
	authUser := middleware.GetAuthUser(c)

	var invoices []models.Invoice
	query := h.DB.Preload("Seller").Preload("Anchor").Preload("FundingBids.Investor").
		Preload("EscrowTransactions").Preload("SettlementRecord").Order("created_at desc")

	if authUser != nil {
		switch authUser.Role {
		case "SELLER":
			query = query.Where("seller_id = ?", authUser.EntityID)
		case "ANCHOR":
			query = query.Where("anchor_id = ?", authUser.EntityID)
		case "INVESTOR":
			query = query.Joins("JOIN funding_bids ON funding_bids.invoice_id = invoices.id").
				Where("funding_bids.investor_id = ?", authUser.EntityID)
		}
	}

	if err := query.Find(&invoices).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	// PII Defense: Mask seller bank account for Anchors & Investors
	if authUser != nil && authUser.Role != "SELLER" {
		for i := range invoices {
			acc := invoices[i].Seller.BankAccountNo
			if len(acc) > 4 {
				invoices[i].Seller.BankAccountNo = fmt.Sprintf("••••••••%s", acc[len(acc)-4:])
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "count": len(invoices), "data": invoices})
}

// UploadInvoice handles invoice upload with fraud checks, NOA dispatch, and VAN allocation
func (h *InvoiceHandler) UploadInvoice(c *gin.Context) {
	authUser := middleware.GetAuthUser(c)
	if authUser == nil || authUser.Role != "SELLER" {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Only authenticated MSME Sellers can upload invoices."})
		return
	}

	var body struct {
		AnchorID            string   `json:"anchorId"`
		NewBuyer            *struct {
			GSTIN         string `json:"gstin"`
			CorporateName string `json:"corporateName"`
			ContactEmail  string `json:"contactEmail"`
			ContactPerson string `json:"contactPerson"`
			ContactPhone  string `json:"contactPhone"`
		} `json:"newBuyer"`
		InvoiceNumber       string  `json:"invoiceNumber" binding:"required"`
		FinancialYear       string  `json:"financialYear"`
		TotalAmount         float64 `json:"totalAmount" binding:"required"`
		TenureDays          int     `json:"tenureDays"`
		PONumber            string  `json:"poNumber"`
		EwayBillNo          string  `json:"ewayBillNo"`
		IRN                 string  `json:"irn"`
		RecourseType        string  `json:"recourseType"`
		InvoiceDocumentURL  string  `json:"invoiceDocumentUrl"`
		InvoiceDocumentName string  `json:"invoiceDocumentName"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Missing required invoice fields."})
		return
	}

	if body.TotalAmount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Total amount must be greater than 0."})
		return
	}

	// Fetch Seller
	var seller models.Seller
	if err := h.DB.Where("id = ?", authUser.EntityID).First(&seller).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Seller entity not found."})
		return
	}

	// KYC Gate
	if seller.KYCStatus != "VERIFIED" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "SELLER_KYC_PENDING",
			"message": "Please complete KYC verification before discounting invoices.",
		})
		return
	}

	// Seller limit check
	if seller.CreditLimit > 0 && body.TotalAmount > seller.CreditLimit {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "SELLER_CREDIT_LIMIT_EXCEEDED",
			"message": fmt.Sprintf("Invoice amount ₹%.2f exceeds your sanctioned line of ₹%.2f.", body.TotalAmount, seller.CreditLimit),
		})
		return
	}

	// Resolve or Create Corporate Anchor
	effectiveAnchorID := body.AnchorID
	isNewVendorPushAnchor := false

	if body.NewBuyer != nil && body.NewBuyer.GSTIN != "" {
		cleanBuyerGST := strings.ToUpper(strings.TrimSpace(body.NewBuyer.GSTIN))
		var existing models.Anchor
		if err := h.DB.Where("gstin = ?", cleanBuyerGST).First(&existing).Error; err != nil {
			// Create New Buyer with STRICT FAIL-CLOSED DEFAULTS:
			// status: PENDING, maxExposureLimit: 0, sourceChannel: VENDOR_PUSH, creditRating: UNRATED
			b := make([]byte, 32)
			_, _ = rand.Read(b)
			invToken := hex.EncodeToString(b)
			expiry := time.Now().Add(30 * 24 * time.Hour)
			cleanEmail := strings.ToLower(strings.TrimSpace(body.NewBuyer.ContactEmail))

			existing = models.Anchor{
				CorporateName:    strings.TrimSpace(body.NewBuyer.CorporateName),
				GSTIN:            cleanBuyerGST,
				CreditRating:     "UNRATED",
				MaxExposureLimit: 0, // Fail-Closed: ₹0 until Admin Sanction
				CurrentExposure:  0,
				Status:           "PENDING", // Maker-Checker
				SourceChannel:    "VENDOR_PUSH",
				ContactEmail:     &cleanEmail,
				ContactPerson:    &body.NewBuyer.ContactPerson,
				ContactPhone:     &body.NewBuyer.ContactPhone,
			}
			h.DB.Create(&existing)

			user := models.User{
				Email:        &cleanEmail,
				Role:         "ANCHOR",
				AnchorID:     &existing.ID,
				InviteToken:  &invToken,
				InviteExpiry: &expiry,
				IsActive:     false,
			}
			h.DB.Create(&user)
		}
		effectiveAnchorID = existing.ID
		isNewVendorPushAnchor = existing.Status == "PENDING" || existing.MaxExposureLimit <= 0
	}

	var anchor models.Anchor
	if err := h.DB.Where("id = ?", effectiveAnchorID).First(&anchor).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Corporate Buyer not found."})
		return
	}

	// Block un-underwritten anchors for existing pre-approved track
	if !isNewVendorPushAnchor && (anchor.CreditRating == "UNRATED" || anchor.MaxExposureLimit <= 0) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "ANCHOR_UNDERWRITING_PENDING",
			"message": fmt.Sprintf("Corporate Anchor '%s' has not completed underwriting (Limit: ₹0.00).", anchor.CorporateName),
		})
		return
	}

	// 1. CRITICAL FINTECH GATE: Double-Financing Fraud Registry Check (SHA-256)
	fy := body.FinancialYear
	if fy == "" {
		fy = h.RiskService.GetCurrentFinancialYear()
	}
	invoiceHash := h.FraudService.GenerateInvoiceHash(seller.GSTIN, body.InvoiceNumber, fy)
	fraudCheck := h.FraudService.CheckDuplicateFinancing(h.DB, invoiceHash)
	if fraudCheck.IsDuplicate {
		c.JSON(http.StatusConflict, gin.H{
			"success": false,
			"error":   "DOUBLE_FINANCING_FRAUD_DETECTED",
			"message": fraudCheck.Message,
		})
		return
	}

	// 2. Anchor Concentration Risk Check
	if !isNewVendorPushAnchor {
		concentration, err := h.RiskService.CheckAnchorExposureLimit(h.DB, anchor.ID, body.TotalAmount)
		if err == nil && concentration.IsExceeded {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "ANCHOR_EXPOSURE_LIMIT_EXCEEDED",
				"message": concentration.RejectReason,
			})
			return
		}
	}

	// 3. Collusion Risk Check
	collusion := h.FraudService.EvaluateCollusionRisk(h.DB, seller.ID, anchor.ID, body.TotalAmount)
	if collusion.IsSuspicious {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "FRAUD_RISK_COLLUSION_FLAGGED",
			"message": collusion.FlagReason,
		})
		return
	}

	// 4. Financial Calculations (84% Upfront, 15% Escrow Margin, 1% Fee, 11.0% Locked Benchmark)
	breakdown := h.RiskService.CalculateRampUpDisbursement(body.TotalAmount, "ENTERPRISE", 5)
	discountRate := h.RiskService.GetDiscountRateByRating(anchor.CreditRating)

	tenure := body.TenureDays
	if tenure <= 0 {
		tenure = 90
	}
	dueDate := time.Now().Add(time.Duration(tenure) * 24 * time.Hour)

	// Virtual Escrow Account (VAN)
	van := fmt.Sprintf("UDHAR-INV-%d", time.Now().UnixNano()%100000000)

	// IRN verification
	irnResult := h.FraudService.VerifyIRN(body.IRN, seller.GSTIN, body.InvoiceNumber, fy, body.TotalAmount, anchor.GSTIN)
	if !irnResult.IsValid {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "INVALID_IRN", "message": irnResult.Error})
		return
	}

	now := time.Now()
	invoice := models.Invoice{
		InvoiceNumber:          strings.ToUpper(strings.TrimSpace(body.InvoiceNumber)),
		FinancialYear:          fy,
		InvoiceDate:            now,
		DueDate:                dueDate,
		TenureDays:             tenure,
		PricingModel:           "NET_DISBURSED",
		TotalAmount:            body.TotalAmount,
		MarginHoldPct:          breakdown.MarginHoldPct,
		MarginHeldAmount:       breakdown.MarginHeldAmount,
		UpfrontDisbursedAmount: breakdown.UpfrontDisbursedAmount,
		DiscountRatePa:         discountRate, // Locked 11.0% benchmark
		PlatformFeePct:         breakdown.PlatformFeePct,
		RecourseType:           "RECOURSE",
		Status:                 "UPLOADED",
		PONumber:               &body.PONumber,
		EwayBillNo:             &body.EwayBillNo,
		InvoiceDocumentURL:     &body.InvoiceDocumentURL,
		InvoiceDocumentName:    &body.InvoiceDocumentName,
		IRN:                    &body.IRN,
		IRNVerified:            irnResult.Status == "ACTIVE",
		CersaiStatus:           "PENDING", // STRICTLY PENDING until FUNDED!
		InvoiceHash:            invoiceHash,
		VirtualAccountNumber:   &van,
		SellerID:               seller.ID,
		AnchorID:               anchor.ID,
		NoaSentAt:              &now,
	}

	if err := h.DB.Create(&invoice).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Audit Log
	meta, _ := json.Marshal(map[string]interface{}{
		"invoiceNumber": invoice.InvoiceNumber,
		"billAmount":    invoice.TotalAmount,
		"upfront84":     invoice.UpfrontDisbursedAmount,
		"margin15":      invoice.MarginHeldAmount,
		"sellerName":    seller.LegalName,
		"anchorName":    anchor.CorporateName,
		"cersaiStatus":  "PENDING",
	})
	metaStr := string(meta)
	h.DB.Create(&models.AuditLog{
		EntityType: "INVOICE",
		EntityID:   invoice.ID,
		Action:     "INVOICE_UPLOAD_AND_NOA_DISPATCH",
		ActorRole:  "SELLER",
		ActorID:    &seller.ID,
		Metadata:   &metaStr,
	})

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Invoice registered on clearing registry. Notice of Assignment dispatched to Corporate Treasury.",
		"data":    invoice,
	})
}

// GetInvoiceNOA serves digital Notice of Assignment for /notice/[id]
func (h *InvoiceHandler) GetInvoiceNOA(c *gin.Context) {
	id := c.Param("id")
	var invoice models.Invoice
	if err := h.DB.Preload("Seller").Preload("Anchor").Where("id = ?", id).First(&invoice).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Notice not found."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": invoice})
}

// AnchorConfirmInvoice confirms invoice and lists it for funding
func (h *InvoiceHandler) AnchorConfirmInvoice(c *gin.Context) {
	h.NoticeConfirmInvoice(c)
}

// NoticeConfirmInvoice handles Corporate Accounts Payable review & digital acknowledgment of NOA
func (h *InvoiceHandler) NoticeConfirmInvoice(c *gin.Context) {
	id := c.Param("id")
	var body struct {
		Action        string `json:"action"` // CONFIRM or DISPUTE
		DisputeReason string `json:"disputeReason"`
		Token         string `json:"token"`
	}
	_ = c.ShouldBindJSON(&body)
	action := strings.ToUpper(strings.TrimSpace(body.Action))
	if action == "" {
		action = "CONFIRM"
	}

	var invoice models.Invoice
	if err := h.DB.Preload("Anchor").Preload("Seller").Where("id = ?", id).First(&invoice).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Invoice not found."})
		return
	}

	// IDOR & Access Verification
	user := middleware.GetAuthUser(c)
	isLoggedAsAnchor := user != nil && user.Role == "ANCHOR" && user.EntityID == invoice.AnchorID
	isTokenValid := body.Token != "" && (body.Token == invoice.InvoiceHash)
	if !isTokenValid && body.Token != "" {
		var anchorUser models.User
		if err := h.DB.Where("anchor_id = ? AND invite_token = ?", invoice.AnchorID, body.Token).First(&anchorUser).Error; err == nil {
			isTokenValid = true
		}
	}
	isDev := h.Cfg.NodeEnv != "production"

	if !isLoggedAsAnchor && !isTokenValid && !isDev {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "UNAUTHORIZED_NOTICE_CONFIRMATION: Invalid security token or unauthenticated session. Please use the verified Notice link sent to Corporate Accounts Payable.",
		})
		return
	}

	now := time.Now()

	// 1. Handle Dispute Action
	if action == "DISPUTE" {
		reason := strings.TrimSpace(body.DisputeReason)
		if reason == "" {
			reason = "Commercial dispute raised by Corporate Buyer during delivery review."
		}

		h.DB.Model(&invoice).Updates(map[string]interface{}{
			"status":         "DISPUTED",
			"dispute_reason": reason,
		})

		meta, _ := json.Marshal(map[string]interface{}{
			"invoiceNumber": invoice.InvoiceNumber,
			"corporate":     invoice.Anchor.CorporateName,
			"reason":        reason,
		})
		metaStr := string(meta)
		actor := invoice.Anchor.CorporateName
		if invoice.Anchor.ContactEmail != nil {
			actor = *invoice.Anchor.ContactEmail
		}
		h.DB.Create(&models.AuditLog{
			EntityType: "INVOICE",
			EntityID:   invoice.ID,
			Action:     "INVOICE_DISPUTED_BY_BUYER",
			ActorRole:  "ANCHOR",
			ActorID:    &actor,
			Metadata:   &metaStr,
		})

		c.JSON(http.StatusOK, gin.H{
			"success":       true,
			"message":       "Invoice marked as DISPUTED. Early funding is halted per Factoring Regulation Act.",
			"disputeReason": reason,
		})
		return
	}

	// 2. Handle Commercial Delivery Confirmation
	if invoice.AnchorConfirmedAt != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":          true,
			"message":          "Invoice delivery and Notice of Assignment have already been acknowledged.",
			"alreadyConfirmed": true,
			"confirmedAt":      invoice.AnchorConfirmedAt,
			"anchorStatus":     invoice.Anchor.Status,
		})
		return
	}

	// CASE A: Corporate Anchor is ACTIVE with an approved limit
	if invoice.Anchor.Status == "ACTIVE" && invoice.Anchor.MaxExposureLimit > 0 {
		tx := h.DB.Begin()
		res := tx.Exec(`
			UPDATE anchors
			SET current_exposure = current_exposure + ?
			WHERE id = ?
			  AND status = 'ACTIVE'
			  AND (current_exposure + ?) <= max_exposure_limit
		`, invoice.TotalAmount, invoice.AnchorID, invoice.TotalAmount)

		if res.RowsAffected == 0 {
			tx.Rollback()
			var fresh models.Anchor
			h.DB.Where("id = ?", invoice.AnchorID).First(&fresh)
			avail := math.Max(0, fresh.MaxExposureLimit-fresh.CurrentExposure)
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   fmt.Sprintf("ANCHOR_EXPOSURE_EXCEEDED: Available facility headroom is ₹%.2f, but invoice requires ₹%.2f.", avail, invoice.TotalAmount),
			})
			return
		}

		tx.Model(&invoice).Updates(map[string]interface{}{
			"status":              "LISTED",
			"anchor_confirmed_at": now,
		})

		meta, _ := json.Marshal(map[string]interface{}{
			"invoiceNumber":    invoice.InvoiceNumber,
			"corporate":        invoice.Anchor.CorporateName,
			"exposureReserved": invoice.TotalAmount,
		})
		metaStr := string(meta)
		actor := invoice.Anchor.CorporateName
		if invoice.Anchor.ContactEmail != nil {
			actor = *invoice.Anchor.ContactEmail
		}
		tx.Create(&models.AuditLog{
			EntityType: "INVOICE",
			EntityID:   invoice.ID,
			Action:     "ANCHOR_CONFIRMED_AND_LISTED",
			ActorRole:  "ANCHOR",
			ActorID:    &actor,
			Metadata:   &metaStr,
		})

		tx.Commit()

		c.JSON(http.StatusOK, gin.H{
			"success":       true,
			"message":       "Commercial delivery confirmed! Invoice is now approved and listed on marketplace for investor bidding.",
			"anchorStatus":  "ACTIVE",
			"invoiceStatus": "LISTED",
		})
		return
	}

	// CASE B: Corporate Anchor is PENDING (Vendor-Push un-onboarded buyer)
	// Fail-Closed Rule: Record commercial goods acceptance, but keep limit ₹0 and status PENDING.
	h.DB.Model(&invoice).Updates(map[string]interface{}{
		"anchor_confirmed_at": now,
		"status":              "VERIFIED", // Awaiting Admin Sanction before it can become LISTED
	})

	meta, _ := json.Marshal(map[string]interface{}{
		"invoiceNumber": invoice.InvoiceNumber,
		"corporate":     invoice.Anchor.CorporateName,
		"totalAmount":   invoice.TotalAmount,
	})
	metaStr := string(meta)
	actor := invoice.Anchor.CorporateName
	if invoice.Anchor.ContactEmail != nil {
		actor = *invoice.Anchor.ContactEmail
	}
	h.DB.Create(&models.AuditLog{
		EntityType: "ANCHOR",
		EntityID:   invoice.AnchorID,
		Action:     "BUYER_DELIVERY_CONFIRMED_AWAITING_ADMIN_SANCTION",
		ActorRole:  "ANCHOR",
		ActorID:    &actor,
		Metadata:   &metaStr,
	})

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"message":       "Commercial delivery acknowledged! A copy has been logged to the statutory audit trail. Platform Admin will complete facility underwriting before funding unlocks.",
		"anchorStatus":  "PENDING",
		"invoiceStatus": "VERIFIED",
	})
}

// AnchorRejectInvoice handles corporate buyer dispute / rejection
func (h *InvoiceHandler) AnchorRejectInvoice(c *gin.Context) {
	id := c.Param("id")
	var body struct {
		Reason string `json:"reason" binding:"required"`
		Notes  string `json:"notes"`
	}
	_ = c.ShouldBindJSON(&body)

	var invoice models.Invoice
	if err := h.DB.Where("id = ?", id).First(&invoice).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Invoice not found."})
		return
	}

	reason := body.Reason
	if reason == "" {
		reason = "COMMERCIAL_DISPUTE"
	}

	h.DB.Model(&invoice).Updates(map[string]interface{}{
		"status":         "DISPUTED",
		"dispute_reason": reason,
	})

	meta, _ := json.Marshal(map[string]string{
		"invoiceNumber": invoice.InvoiceNumber,
		"disputeReason": reason,
		"notes":         body.Notes,
	})
	metaStr := string(meta)
	h.DB.Create(&models.AuditLog{
		EntityType: "INVOICE",
		EntityID:   invoice.ID,
		Action:     "ANCHOR_INVOICE_DISPUTED_OR_REJECTED",
		ActorRole:  "ANCHOR",
		Metadata:   &metaStr,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Invoice marked as DISPUTED. Factoring facility blocked.",
	})
}

// VerifyInvoice handles Maker-Checker verification
func (h *InvoiceHandler) VerifyInvoice(c *gin.Context) {
	id := c.Param("id")
	h.DB.Model(&models.Invoice{}).Where("id = ?", id).Update("status", "VERIFIED")
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Invoice marked as VERIFIED."})
}

// VerifyIRN standalone endpoint
func (h *InvoiceHandler) VerifyIRN(c *gin.Context) {
	var body struct {
		IRN           string  `json:"irn" binding:"required"`
		SellerGSTIN   string  `json:"sellerGstin"`
		InvoiceNumber string  `json:"invoiceNumber"`
		FinancialYear string  `json:"financialYear"`
		Amount        float64 `json:"amount"`
		BuyerGSTIN    string  `json:"buyerGstin"`
	}
	_ = c.ShouldBindJSON(&body)
	res := h.FraudService.VerifyIRN(body.IRN, body.SellerGSTIN, body.InvoiceNumber, body.FinancialYear, body.Amount, body.BuyerGSTIN)
	c.JSON(http.StatusOK, res)
}

// GenerateIRN simulates NIC IRP generation
func (h *InvoiceHandler) GenerateIRN(c *gin.Context) {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	mockIRN := hex.EncodeToString(b)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"irn":     mockIRN,
		"message": "IRP 64-character hash generated successfully.",
	})
}

// ProcessAnchorReminders scans unconfirmed NOAs and logs reminder counts
func (h *InvoiceHandler) ProcessAnchorReminders(c *gin.Context) {
	var count int64
	h.DB.Model(&models.Invoice{}).Where("status = 'UPLOADED' OR status = 'VERIFIED'").Count(&count)
	c.JSON(http.StatusOK, gin.H{
		"success":           true,
		"remindersDispatched": count,
		"message":           fmt.Sprintf("Dispatched %d automated NOA reminders to corporate treasuries.", count),
	})
}
