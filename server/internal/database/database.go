package database

import (
	"log"

	"github.com/bhavyc/udharco/server/internal/config"
	"github.com/bhavyc/udharco/server/internal/models"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB(cfg *config.Config) *gorm.DB {
	logLevel := logger.Warn
	if !cfg.IsProduction() {
		logLevel = logger.Info
	}

	db, err := gorm.Open(sqlite.Open(cfg.DBPath), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		log.Fatalf("FATAL: Failed to connect to SQLite database at '%s': %v", cfg.DBPath, err)
	}

	// AutoMigrate all 12 models to ensure database tables are created & synchronized
	err = db.AutoMigrate(
		&models.User{},
		&models.AdminUser{},
		&models.OtpCode{},
		&models.Seller{},
		&models.Anchor{},
		&models.Investor{},
		&models.Invoice{},
		&models.FundingBid{},
		&models.EscrowTransaction{},
		&models.SettlementRecord{},
		&models.WebhookEvent{},
		&models.AuditLog{},
	)
	if err != nil {
		log.Fatalf("FATAL: Failed to auto-migrate database schema: %v", err)
	}

	DB = db
	log.Printf("✅ SQLite database connected & schema auto-migrated successfully (path: %s)", cfg.DBPath)
	return DB
}
