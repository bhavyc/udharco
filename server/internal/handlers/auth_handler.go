package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/bhavyc/udharco/server/internal/config"
	"github.com/bhavyc/udharco/server/internal/middleware"
	"github.com/bhavyc/udharco/server/internal/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthHandler struct {
	DB  *gorm.DB
	Cfg *config.Config
}

func NewAuthHandler(db *gorm.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{DB: db, Cfg: cfg}
}

// RequestSellerOTP generates and stores a 6-digit SMS OTP
func (h *AuthHandler) RequestSellerOTP(c *gin.Context) {
	var body struct {
		Mobile string `json:"mobile" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Valid 10-digit mobile number is required."})
		return
	}

	cleanMobile := strings.TrimSpace(body.Mobile)
	if len(cleanMobile) < 10 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Mobile number must be at least 10 digits."})
		return
	}

	// Generate 6-digit numeric OTP
	otpCode := fmt.Sprintf("%06d", rand.Intn(900000)+100000)

	// In development / demo, support known test code 123456
	if cleanMobile == "9876543210" || cleanMobile == "9820011223" {
		otpCode = "123456"
	}

	otp := models.OtpCode{
		Mobile:    cleanMobile,
		Code:      otpCode,
		Purpose:   "LOGIN",
		ExpiresAt: time.Now().Add(10 * time.Minute),
		Used:      false,
	}

	if err := h.DB.Create(&otp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create OTP."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("SMS OTP sent successfully to +91 %s", cleanMobile),
		"mockOtp": otpCode, // For demo/sandbox testing
	})
}

// VerifySellerOTP verifies the SMS code and logs in or signals onboarding
func (h *AuthHandler) VerifySellerOTP(c *gin.Context) {
	var body struct {
		Mobile string `json:"mobile" binding:"required"`
		Code   string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Mobile and OTP code are required."})
		return
	}

	cleanMobile := strings.TrimSpace(body.Mobile)
	cleanCode := strings.TrimSpace(body.Code)

	var otp models.OtpCode
	err := h.DB.Where("mobile = ? AND code = ? AND used = ? AND expires_at > ?",
		cleanMobile, cleanCode, false, time.Now()).Order("created_at desc").First(&otp).Error

	// Also support sandbox test code "123456" in non-production
	if err != nil && (!h.Cfg.IsProduction() && cleanCode == "123456") {
		err = nil
	}

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "INVALID_OTP",
			"message": "Invalid or expired OTP. Please request a new code.",
		})
		return
	}

	// Mark OTP as used
	if otp.ID != "" {
		h.DB.Model(&otp).Update("used", true)
	}

	// Check if Seller user already exists
	var user models.User
	err = h.DB.Preload("Seller").Where("mobile = ?", cleanMobile).First(&user).Error
	if err != nil {
		// New MSME Seller -> Needs 6-step onboarding wizard
		c.JSON(http.StatusOK, gin.H{
			"success":         true,
			"needsOnboarding": true,
			"mobile":          cleanMobile,
			"message":         "Mobile verified. Please complete business KYC.",
		})
		return
	}

	// Existing Seller -> Issue Session Token
	entityID := ""
	if user.SellerID != nil {
		entityID = *user.SellerID
	}

	token, err := middleware.GenerateToken(h.Cfg, middleware.AuthUser{
		UserID:   user.ID,
		Role:     "SELLER",
		EntityID: entityID,
		Mobile:   cleanMobile,
	}, 7*24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Token generation error."})
		return
	}

	// Set HTTP-Only Cookie
	c.SetCookie("udharco_session", token, int(7*24*3600), "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"success":         true,
		"needsOnboarding": false,
		"token":           token,
		"user": gin.H{
			"id":     user.ID,
			"role":   user.Role,
			"mobile": user.Mobile,
			"seller": user.Seller,
		},
	})
}

// CompleteSellerSignup handles Step 6 finalization of MSME onboarding
func (h *AuthHandler) CompleteSellerSignup(c *gin.Context) {
	var body struct {
		Mobile          string  `json:"mobile" binding:"required"`
		LegalName       string  `json:"legalName" binding:"required"`
		GSTIN           string  `json:"gstin" binding:"required"`
		PAN             string  `json:"pan" binding:"required"`
		BankAccountNo   string  `json:"bankAccountNo" binding:"required"`
		BankIFSC        string  `json:"bankIfsc" binding:"required"`
		EnachMandateID  string  `json:"enachMandateId"`
		PrimaryAnchor   string  `json:"primaryAnchor"`
		SanctionedLimit float64 `json:"sanctionedLimit"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Missing required onboarding fields."})
		return
	}

	cleanMobile := strings.TrimSpace(body.Mobile)
	cleanGST := strings.ToUpper(strings.TrimSpace(body.GSTIN))
	cleanPAN := strings.ToUpper(strings.TrimSpace(body.PAN))
	limit := body.SanctionedLimit
	if limit <= 0 {
		limit = 5000000 // Default ₹50L facility
	}

	// Upsert Seller Entity
	var seller models.Seller
	err := h.DB.Where("gstin = ?", cleanGST).First(&seller).Error
	if err != nil {
		mandateID := body.EnachMandateID
		if mandateID == "" {
			mandateID = fmt.Sprintf("MND-NPCI-%d", time.Now().UnixNano()%1000000)
		}
		seller = models.Seller{
			LegalName:          strings.TrimSpace(body.LegalName),
			GSTIN:              cleanGST,
			PAN:                cleanPAN,
			BankAccountNo:      strings.TrimSpace(body.BankAccountNo),
			BankIFSC:           strings.ToUpper(strings.TrimSpace(body.BankIFSC)),
			KYCStatus:          "VERIFIED",
			EnachMandateID:     &mandateID,
			EnachMandateStatus: "ACTIVE",
			CreditLimit:        limit,
			CreditLimitStatus:  "SANCTIONED",
		}
		if err := h.DB.Create(&seller).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create Seller record."})
			return
		}
	} else {
		// Update existing
		h.DB.Model(&seller).Updates(map[string]interface{}{
			"kyc_status":           "VERIFIED",
			"enach_mandate_status": "ACTIVE",
			"credit_limit":         limit,
			"credit_limit_status":  "SANCTIONED",
		})
	}

	// Upsert User
	var user models.User
	err = h.DB.Where("mobile = ?", cleanMobile).First(&user).Error
	if err != nil {
		user = models.User{
			Mobile:   &cleanMobile,
			Role:     "SELLER",
			SellerID: &seller.ID,
			IsActive: true,
		}
		h.DB.Create(&user)
	} else {
		h.DB.Model(&user).Updates(map[string]interface{}{
			"seller_id": seller.ID,
			"is_active": true,
		})
	}

	token, _ := middleware.GenerateToken(h.Cfg, middleware.AuthUser{
		UserID:   user.ID,
		Role:     "SELLER",
		EntityID: seller.ID,
		Mobile:   cleanMobile,
	}, 7*24*time.Hour)

	c.SetCookie("udharco_session", token, int(7*24*3600), "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"token":   token,
		"message": "MSME onboarding completed successfully. Invoice discounting line sanctioned.",
		"seller":  seller,
	})
}

// Login handles Email + Password authentication for Corporate Anchors and Investors
func (h *AuthHandler) Login(c *gin.Context) {
	var body struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Email and password are required."})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(body.Email))

	var user models.User
	err := h.DB.Preload("Anchor").Preload("Investor").Preload("Seller").
		Where("email = ?", cleanEmail).First(&user).Error
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "INVALID_CREDENTIALS",
			"message": "Invalid email or password.",
		})
		return
	}

	// Verify password
	if user.PasswordHash == nil || bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(body.Password)) != nil {
		// In development demo mode, allow "admin123" or standard password
		if h.Cfg.IsProduction() || body.Password != "admin123" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "INVALID_CREDENTIALS",
				"message": "Invalid email or password.",
			})
			return
		}
	}

	entityID := ""
	if user.AnchorID != nil {
		entityID = *user.AnchorID
	} else if user.InvestorID != nil {
		entityID = *user.InvestorID
	} else if user.SellerID != nil {
		entityID = *user.SellerID
	}

	token, _ := middleware.GenerateToken(h.Cfg, middleware.AuthUser{
		UserID:   user.ID,
		Role:     user.Role,
		EntityID: entityID,
		Email:    cleanEmail,
	}, 7*24*time.Hour)

	c.SetCookie("udharco_session", token, int(7*24*3600), "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"token":   token,
		"user": gin.H{
			"id":       user.ID,
			"email":    user.Email,
			"role":     user.Role,
			"anchor":   user.Anchor,
			"investor": user.Investor,
			"seller":   user.Seller,
		},
	})
}

// Logout clears the session cookie
func (h *AuthHandler) Logout(c *gin.Context) {
	c.SetCookie("udharco_session", "", -1, "/", "", false, true)
	c.SetCookie("udharco_admin_session", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Logged out successfully."})
}

// Invite retrieves or accepts corporate / investor invitations
func (h *AuthHandler) Invite(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Token is required."})
		return
	}

	var user models.User
	err := h.DB.Preload("Anchor").Preload("Investor").
		Where("invite_token = ?", token).First(&user).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Invalid or expired invitation token."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"user": gin.H{
			"id":       user.ID,
			"email":    user.Email,
			"role":     user.Role,
			"anchor":   user.Anchor,
			"investor": user.Investor,
		},
	})
}
