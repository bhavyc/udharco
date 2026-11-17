package main

import (
	"fmt"
	"log"
	"time"

	"github.com/bhavyc/udharco/server/internal/config"
	"github.com/bhavyc/udharco/server/internal/database"
	"github.com/bhavyc/udharco/server/internal/handlers"
	"github.com/bhavyc/udharco/server/internal/middleware"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.LoadConfig()
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	db := database.InitDB(cfg)

	r := gin.Default()

	// Global Middleware
	r.Use(middleware.SetupCORS())
	rateLimiter := middleware.NewMemoryRateLimiter(60, 1*time.Minute)
	r.Use(rateLimiter.Middleware())

	// Initialize Handlers
	authH := handlers.NewAuthHandler(db, cfg)
	adminAuthH := handlers.NewAdminAuthHandler(db, cfg)
	kycH := handlers.NewKycHandler(db, cfg)
	entityH := handlers.NewEntityHandler(db, cfg)
	invoiceH := handlers.NewInvoiceHandler(db, cfg)
	fundingH := handlers.NewFundingHandler(db, cfg)

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":      "HEALTHY",
			"engine":      "UdharCo Clearing House (Golang 1.23+)",
			"environment": cfg.NodeEnv,
			"timestamp":   time.Now(),
		})
	})

	// ─────────────────────────────────────────────────────────────────────────────
	// PUBLIC / CLIENT API ROUTES (/api/v1/...)
	// ─────────────────────────────────────────────────────────────────────────────
	api := r.Group("/api/v1")
	{
		// Auth
		authGroup := api.Group("/auth")
		{
			authGroup.POST("/seller/request-otp", authH.RequestSellerOTP)
			authGroup.POST("/seller/verify-otp", authH.VerifySellerOTP)
			authGroup.POST("/seller/complete-signup", authH.CompleteSellerSignup)
			authGroup.POST("/login", authH.Login)
			authGroup.POST("/logout", authH.Logout)
			authGroup.GET("/invite", authH.Invite)
		}

		// KYC Verification
		kycGroup := api.Group("/kyc")
		{
			kycGroup.POST("/gst-lookup", kycH.GstLookup)
			kycGroup.POST("/bank-lookup", kycH.BankLookup)
			kycGroup.POST("/enach-mandate", kycH.EnachMandate)
			kycGroup.POST("/credit-score", kycH.CreditScore)
		}

		// Corporate Self-Serve Application
		api.POST("/corporate/apply", entityH.CorporateApply)

		// Entities Lookup
		entitiesGroup := api.Group("/entities")
		{
			entitiesGroup.GET("/sellers", entityH.GetSellers)
			entitiesGroup.GET("/anchors", entityH.GetAnchors)
			entitiesGroup.GET("/anchors/:id/pending", entityH.GetPendingAnchors)
			entitiesGroup.GET("/investors", entityH.GetInvestors)
		}

		// Invoices & Factoring Lifecycle
		invoicesGroup := api.Group("/invoices")
		{
			invoicesGroup.GET("", invoiceH.GetInvoices)
			invoicesGroup.POST("", middleware.RequireAuth(cfg, "SELLER"), invoiceH.UploadInvoice)
			invoicesGroup.GET("/:id/noa", invoiceH.GetInvoiceNOA)
			invoicesGroup.POST("/:id/anchor-confirm", invoiceH.AnchorConfirmInvoice)
			invoicesGroup.POST("/:id/notice-confirm", invoiceH.NoticeConfirmInvoice)
			invoicesGroup.POST("/:id/anchor-reject", invoiceH.AnchorRejectInvoice)
			invoicesGroup.POST("/:id/verify", invoiceH.VerifyInvoice)
			invoicesGroup.POST("/:id/fund", middleware.RequireAuth(cfg, "INVESTOR", "ADMIN"), fundingH.FundInvoice)
			invoicesGroup.POST("/:id/settle", fundingH.SettleInvoice)

			invoicesGroup.POST("/process-anchor-reminders", invoiceH.ProcessAnchorReminders)
			invoicesGroup.POST("/verify-irn", invoiceH.VerifyIRN)
			invoicesGroup.POST("/generate-irn", invoiceH.GenerateIRN)
		}

		// Webhooks (Escrow Bank Ingestion)
		api.POST("/webhooks/escrow", fundingH.EscrowWebhook)
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// ROOT PLATFORM OPERATIONS (/admin/api/...)
	// ─────────────────────────────────────────────────────────────────────────────
	adminApi := r.Group("/admin/api")
	{
		// Admin Auth
		adminApi.POST("/auth/login", adminAuthH.AdminLogin)
		adminApi.POST("/auth/logout", adminAuthH.AdminLogout)

		// Protected Admin Routes
		protectedAdmin := adminApi.Group("", middleware.RequireAuth(cfg, "ADMIN"))
		{
			protectedAdmin.GET("/sellers/:id", entityH.GetSellerByID)
			protectedAdmin.GET("/investors/:id", entityH.GetInvestorByID)
			protectedAdmin.POST("/entities/provision", entityH.AdminProvisionEntity)
			protectedAdmin.PATCH("/anchors/:id", entityH.AdminSanctionAnchor)
			protectedAdmin.POST("/invoices/:id/recourse", fundingH.TriggerRecourse)
		}
	}

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("🚀 UdharCo High-Performance Factoring Engine starting on http://localhost%s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
