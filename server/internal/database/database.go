package database

import (
	"log"
	"strings"

	"github.com/bhavyc/udharco/server/internal/config"
	"github.com/bhavyc/udharco/server/internal/models"
	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB(cfg *config.Config) *gorm.DB {
	logLevel := logger.Warn
	if !cfg.IsProduction() {
		logLevel = logger.Info
	}

	var dialector gorm.Dialector
	dbType := "SQLite"

	// Auto-detect PostgreSQL vs SQLite based on connection string
	if strings.HasPrefix(cfg.DatabaseURL, "postgres://") || strings.HasPrefix(cfg.DatabaseURL, "postgresql://") {
		dialector = postgres.Open(cfg.DatabaseURL)
		dbType = "PostgreSQL"
	} else {
		dialector = sqlite.Open(cfg.DBPath)
		dbType = "SQLite"
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		log.Fatalf("FATAL: Failed to connect to %s database: %v", dbType, err)
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
	log.Printf("✅ %s database connected & schema auto-migrated successfully", dbType)
	return DB
}
