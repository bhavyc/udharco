package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/bhavyc/udharco/server/internal/config"
	"github.com/bhavyc/udharco/server/internal/middleware"
	"github.com/bhavyc/udharco/server/internal/models"
	"github.com/bhavyc/udharco/server/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type EntityHandler struct {
	DB  *gorm.DB
	Cfg *config.Config
}

func NewEntityHandler(db *gorm.DB, cfg *config.Config) *EntityHandler {
	return &EntityHandler{DB: db, Cfg: cfg}
}

// GetSellers returns list of MSME sellers (Tenant-isolated by role)
func (h *EntityHandler) GetSellers(c *gin.Context) {
	authUser := middleware.GetAuthUser(c)
	var sellers []models.Seller

	query := h.DB.Order("created_at desc")
	if authUser != nil {
		switch authUser.Role {
		case "SELLER":
			// MSME Seller can ONLY view their own profile
			query = query.Where("id = ?", authUser.EntityID)
		case "ANCHOR":
			// Corporate Anchor can only view sellers who have submitted invoices to them
			query = query.Joins("JOIN invoices ON invoices.seller_id = sellers.id").
				Where("invoices.anchor_id = ?", authUser.EntityID).
				Distinct()
		case "ADMIN", "INVESTOR":
			// Admin and institutional funders can inspect eligible MSME sellers
		default:
			c.JSON(http.StatusOK, gin.H{"success": true, "count": 0, "data": []models.Seller{}})
			return
		}
	}

	if err := query.Find(&sellers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	// PII Defense: Mask seller bank accounts & PAN if not the seller themselves or Admin
	if authUser != nil && authUser.Role != "ADMIN" {
		for i := range sellers {
			if authUser.Role != "SELLER" || sellers[i].ID != authUser.EntityID {
				acc := sellers[i].BankAccountNo
				if len(acc) > 4 {
					sellers[i].BankAccountNo = fmt.Sprintf("••••••••%s", acc[len(acc)-4:])
				}
				sellers[i].PAN = "••••••••••"
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "count": len(sellers), "data": sellers})
}

// GetSellerByID returns a single seller by ID (Protected by tenant boundary)
func (h *EntityHandler) GetSellerByID(c *gin.Context) {
	authUser := middleware.GetAuthUser(c)
	id := c.Param("id")

	if authUser != nil && authUser.Role == "SELLER" && authUser.EntityID != id {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Access denied: MSME Sellers cannot view other seller profiles."})
		return
	}

	var seller models.Seller
	if err := h.DB.Preload("Invoices").Where("id = ?", id).First(&seller).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Seller MSME not found."})
		return
	}

	if authUser != nil && authUser.Role != "ADMIN" && (authUser.Role != "SELLER" || authUser.EntityID != seller.ID) {
		acc := seller.BankAccountNo
		if len(acc) > 4 {
			seller.BankAccountNo = fmt.Sprintf("••••••••%s", acc[len(acc)-4:])
		}
		seller.PAN = "••••••••••"
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": seller})
}

// GetAnchors returns all active/pre-approved Corporate Anchors
func (h *EntityHandler) GetAnchors(c *gin.Context) {
	var anchors []models.Anchor
	if err := h.DB.Order("corporate_name asc").Find(&anchors).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "count": len(anchors), "data": anchors})
}

// GetPendingAnchors returns un-underwritten anchors for Admin maker-checker queue
func (h *EntityHandler) GetPendingAnchors(c *gin.Context) {
	var anchors []models.Anchor
	if err := h.DB.Where("status = 'PENDING' OR max_exposure_limit <= 0").
		Order("created_at desc").Find(&anchors).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "count": len(anchors), "data": anchors})
}

// GetInvestors returns institutional funders (Banks/NBFCs) - Protected from non-investors
func (h *EntityHandler) GetInvestors(c *gin.Context) {
	authUser := middleware.GetAuthUser(c)
	if authUser != nil && authUser.Role != "ADMIN" && authUser.Role != "INVESTOR" {
		c.JSON(http.StatusOK, gin.H{"success": true, "count": 0, "data": []models.Investor{}})
		return
	}

	var investors []models.Investor
	query := h.DB.Order("entity_name asc")
	if authUser != nil && authUser.Role == "INVESTOR" {
		query = query.Where("id = ?", authUser.EntityID)
	}

	if err := query.Find(&investors).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "count": len(investors), "data": investors})
}

// GetInvestorByID returns an institutional investor by ID
func (h *EntityHandler) GetInvestorByID(c *gin.Context) {
	authUser := middleware.GetAuthUser(c)
	id := c.Param("id")

	if authUser != nil && authUser.Role != "ADMIN" {
		if authUser.Role != "INVESTOR" || authUser.EntityID != id {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Access denied to institutional liquidity account."})
			return
		}
	}

	var investor models.Investor
	if err := h.DB.Preload("Bids").Where("id = ?", id).First(&investor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Institutional investor not found."})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": investor})
}

// CorporateApply handles self-serve onboarding from /corporate/apply
func (h *EntityHandler) CorporateApply(c *gin.Context) {
	var body struct {
		GSTIN                string   `json:"gstin" binding:"required"`
		CorporateName        string   `json:"corporateName" binding:"required"`
		ContactEmail         string   `json:"contactEmail" binding:"required"`
		ContactPerson        string   `json:"contactPerson"`
		ContactPhone         string   `json:"contactPhone"`
		AnnualProcurement    *float64 `json:"annualProcurement"`
		StandardPaymentTerms *int     `json:"standardPaymentTerms"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "GSTIN, Corporate Name, and Treasury Email are required."})
		return
	}

	cleanGST := strings.ToUpper(strings.TrimSpace(body.GSTIN))
	cleanEmail := strings.ToLower(strings.TrimSpace(body.ContactEmail))

	// Strict Anti-Fraud Gate: Block public free email providers (Gmail, Yahoo, etc.)
	if valid, _, err := utils.ValidateCorporateEmail(cleanEmail); !valid {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Check if already exists
	var existing models.Anchor
	if err := h.DB.Where("gstin = ?", cleanGST).First(&existing).Error; err == nil {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    existing,
			"message": "Corporate entity is already registered. Status: " + existing.Status,
		})
		return
	}

	// Generate invite token
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	inviteToken := hex.EncodeToString(b)
	expiry := time.Now().Add(30 * 24 * time.Hour)

	// STRICT FAIL-CLOSED DEFAULTS:
	// status: PENDING, maxExposureLimit: 0, creditRating: UNRATED
	anchor := models.Anchor{
		CorporateName:        strings.TrimSpace(body.CorporateName),
		GSTIN:                cleanGST,
		CreditRating:         "UNRATED",
		MaxExposureLimit:     0, // Fail-Closed
		CurrentExposure:      0,
		Status:               "PENDING", // Maker-Checker
		SourceChannel:        "VENDOR_PUSH",
		ContactEmail:         &cleanEmail,
		ContactPerson:        &body.ContactPerson,
		ContactPhone:         &body.ContactPhone,
		AnnualProcurement:    body.AnnualProcurement,
		StandardPaymentTerms: body.StandardPaymentTerms,
	}

	if err := h.DB.Create(&anchor).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create Corporate record."})
		return
	}

	// Create user with invite token
	user := models.User{
		Email:        &cleanEmail,
		Role:         "ANCHOR",
		AnchorID:     &anchor.ID,
		InviteToken:  &inviteToken,
		InviteExpiry: &expiry,
		IsActive:     false,
	}
	h.DB.Create(&user)

	// Audit Log
	meta, _ := json.Marshal(map[string]interface{}{
		"corporateName": anchor.CorporateName,
		"gstin":         anchor.GSTIN,
		"contactEmail":  cleanEmail,
		"status":        "PENDING_MAKER_CHECKER_APPROVAL",
	})
	metaStr := string(meta)
	h.DB.Create(&models.AuditLog{
		EntityType: "ANCHOR",
		EntityID:   anchor.ID,
		Action:     "CORPORATE_SELF_SERVE_APPLICATION_SUBMITTED",
		ActorRole:  "ANCHOR",
		Metadata:   &metaStr,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    anchor,
		"message": "Corporate facility application submitted. Status is PENDING maker-checker underwriting.",
	})
}

// AdminProvisionEntity creates an Anchor or Investor with direct admin provisioning
func (h *EntityHandler) AdminProvisionEntity(c *gin.Context) {
	authUser := middleware.GetAuthUser(c)

	var body struct {
		Role             string   `json:"role" binding:"required"` // ANCHOR or INVESTOR
		EntityName       string   `json:"entityName" binding:"required"`
		GSTIN            string   `json:"gstin"`
		Email            string   `json:"email" binding:"required"`
		MaxExposureLimit *float64 `json:"maxExposureLimit"`
		CreditRating     string   `json:"creditRating"`
		InvestorType     string   `json:"investorType"`
		EscrowBalance    *float64 `json:"escrowBalance"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Missing required provisioning parameters."})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(body.Email))
	role := strings.ToUpper(strings.TrimSpace(body.Role))

	b := make([]byte, 32)
	_, _ = rand.Read(b)
	inviteToken := hex.EncodeToString(b)
	expiry := time.Now().Add(30 * 24 * time.Hour)

	if role == "ANCHOR" {
		limit := 0.0
		if body.MaxExposureLimit != nil {
			limit = *body.MaxExposureLimit
		}
		rating := "UNRATED"
		if body.CreditRating != "" {
			rating = strings.ToUpper(strings.TrimSpace(body.CreditRating))
		}
		status := "PENDING"
		if limit > 0 {
			status = "ACTIVE"
		}

		anchor := models.Anchor{
			CorporateName:    strings.TrimSpace(body.EntityName),
			GSTIN:            strings.ToUpper(strings.TrimSpace(body.GSTIN)),
			CreditRating:     rating,
			MaxExposureLimit: limit,
			CurrentExposure:  0,
			Status:           status,
			SourceChannel:    "ENTERPRISE_SALES",
			ContactEmail:     &cleanEmail,
		}
		if err := h.DB.Create(&anchor).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}

		user := models.User{
			Email:        &cleanEmail,
			Role:         "ANCHOR",
			AnchorID:     &anchor.ID,
			InviteToken:  &inviteToken,
			InviteExpiry: &expiry,
			IsActive:     false,
		}
		h.DB.Create(&user)

		// Audit Log
		meta, _ := json.Marshal(map[string]interface{}{
			"action":       "ADMIN_PROVISION_ANCHOR",
			"provisionedBy": authUser.Email,
			"anchorName":   anchor.CorporateName,
			"limit":        anchor.MaxExposureLimit,
			"rating":       anchor.CreditRating,
		})
		metaStr := string(meta)
		h.DB.Create(&models.AuditLog{
			EntityType: "ANCHOR",
			EntityID:   anchor.ID,
			Action:     "PROVISION_ANCHOR_SUCCESS",
			ActorRole:  "ADMIN",
			ActorID:    &authUser.UserID,
			Metadata:   &metaStr,
		})

		c.JSON(http.StatusOK, gin.H{
			"success":     true,
			"message":     "Corporate Anchor provisioned successfully.",
			"data":        anchor,
			"inviteToken": inviteToken,
			"inviteUrl":   fmt.Sprintf("/login?invite=%s", inviteToken),
		})
		return
	} else if role == "INVESTOR" {
		invType := "NBFC"
		if body.InvestorType != "" {
			invType = strings.ToUpper(strings.TrimSpace(body.InvestorType))
		}
		bal := 25000000.0 // Default ₹2.5 Cr test balance
		if body.EscrowBalance != nil {
			bal = *body.EscrowBalance
		}

		investor := models.Investor{
			EntityName:    strings.TrimSpace(body.EntityName),
			InvestorType:  invType,
			EscrowBalance: bal,
		}
		if err := h.DB.Create(&investor).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}

		user := models.User{
			Email:        &cleanEmail,
			Role:         "INVESTOR",
			InvestorID:   &investor.ID,
			InviteToken:  &inviteToken,
			InviteExpiry: &expiry,
			IsActive:     false,
		}
		h.DB.Create(&user)

		c.JSON(http.StatusOK, gin.H{
			"success":     true,
			"message":     "Institutional Investor provisioned successfully.",
			"data":        investor,
			"inviteToken": inviteToken,
			"inviteUrl":   fmt.Sprintf("/login?invite=%s", inviteToken),
		})
		return
	}

	c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid role: must be ANCHOR or INVESTOR."})
}

// AdminSanctionAnchor allocates credit rating and exposure limit to an Anchor
func (h *EntityHandler) AdminSanctionAnchor(c *gin.Context) {
	authUser := middleware.GetAuthUser(c)
	anchorID := c.Param("id")

	var body struct {
		CreditRating     string  `json:"creditRating" binding:"required"`
		MaxExposureLimit float64 `json:"maxExposureLimit" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Credit rating and exposure limit are required."})
		return
	}

	var anchor models.Anchor
	if err := h.DB.Where("id = ?", anchorID).First(&anchor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Corporate Anchor not found."})
		return
	}

	oldRating := anchor.CreditRating
	oldLimit := anchor.MaxExposureLimit

	newRating := strings.ToUpper(strings.TrimSpace(body.CreditRating))
	newLimit := body.MaxExposureLimit

	h.DB.Model(&anchor).Updates(map[string]interface{}{
		"credit_rating":      newRating,
		"max_exposure_limit": newLimit,
		"status":             "ACTIVE",
	})

	// Audit Log
	meta, _ := json.Marshal(map[string]interface{}{
		"sanctionedBy": authUser.Email,
		"oldRating":    oldRating,
		"newRating":    newRating,
		"oldLimit":     oldLimit,
		"newLimit":     newLimit,
		"status":       "ACTIVE",
	})
	metaStr := string(meta)
	h.DB.Create(&models.AuditLog{
		EntityType: "ANCHOR",
		EntityID:   anchor.ID,
		Action:     "ANCHOR_CREDIT_SANCTIONED_AND_ACTIVATED",
		ActorRole:  "ADMIN",
		ActorID:    &authUser.UserID,
		Metadata:   &metaStr,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Corporate facility sanctioned: Rating %s, Limit ₹%.2f. Status is now ACTIVE.", newRating, newLimit),
		"data":    anchor,
	})
}
