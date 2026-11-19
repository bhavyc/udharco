package handlers

import (
	"encoding/json"
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

type AdminAuthHandler struct {
	DB  *gorm.DB
	Cfg *config.Config
}

func NewAdminAuthHandler(db *gorm.DB, cfg *config.Config) *AdminAuthHandler {
	return &AdminAuthHandler{DB: db, Cfg: cfg}
}

func (h *AdminAuthHandler) AdminLogin(c *gin.Context) {
	var body struct {
		Email       string `json:"email" binding:"required"`
		Password    string `json:"password" binding:"required"`
		TwoFactorCode string `json:"twoFactorCode"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Email and password are required."})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(body.Email))

	var admin models.AdminUser
	if err := h.DB.Where("email = ?", cleanEmail).First(&admin).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "INVALID_ADMIN_CREDENTIALS",
			"message": "Invalid admin email or password.",
		})
		return
	}

	if !admin.IsActive {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "ACCOUNT_DISABLED",
			"message": "This root admin account has been suspended.",
		})
		return
	}

	// Verify password
	if bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(body.Password)) != nil {
		// Non-production demo fallback for "admin123"
		if h.Cfg.IsProduction() || body.Password != "admin123" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "INVALID_ADMIN_CREDENTIALS",
				"message": "Invalid admin email or password.",
			})
			return
		}
	}

	now := time.Now()
	h.DB.Model(&admin).Update("last_login_at", now)

	// Issue Admin JWT
	token, _ := middleware.GenerateToken(h.Cfg, middleware.AuthUser{
		UserID:   admin.ID,
		Role:     "ADMIN",
		EntityID: "ROOT_ADMIN",
		Email:    cleanEmail,
	}, 12*time.Hour)

	c.SetCookie("udharco_admin_session", token, int(12*3600), "/", "", false, true)

	// Audit log login
	meta, _ := json.Marshal(map[string]string{"ip": c.ClientIP(), "email": cleanEmail})
	metaStr := string(meta)
	h.DB.Create(&models.AuditLog{
		EntityType: "ADMIN",
		EntityID:   admin.ID,
		Action:     "ROOT_ADMIN_LOGIN_SUCCESS",
		ActorRole:  "ADMIN",
		ActorID:    &admin.ID,
		Metadata:   &metaStr,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"token":   token,
		"admin": gin.H{
			"id":          admin.ID,
			"email":       admin.Email,
			"role":        "ADMIN",
			"lastLoginAt": now,
		},
	})
}

func (h *AdminAuthHandler) AdminLogout(c *gin.Context) {
	c.SetCookie("udharco_admin_session", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Admin logged out successfully."})
}

// GetAdminOverview returns the complete dataset for Admin dashboard
func (h *AdminAuthHandler) GetAdminOverview(c *gin.Context) {
	var sellers []models.Seller
	var anchors []models.Anchor
	var investors []models.Investor
	var invoices []models.Invoice
	var transactions []models.EscrowTransaction
	var auditLogs []models.AuditLog

	h.DB.Order("created_at desc").Find(&sellers)
	h.DB.Preload("User").Order("created_at desc").Find(&anchors)
	h.DB.Preload("User").Order("created_at desc").Find(&investors)
	h.DB.Preload("Seller").Preload("Anchor").Order("created_at desc").Find(&invoices)
	h.DB.Preload("Invoice").Order("created_at desc").Limit(100).Find(&transactions)
	h.DB.Order("timestamp desc").Limit(100).Find(&auditLogs)

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"sellers":      sellers,
		"anchors":      anchors,
		"investors":    investors,
		"invoices":     invoices,
		"transactions": transactions,
		"auditLogs":    auditLogs,
	})
}
