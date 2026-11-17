package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                   string
	DBPath                 string
	DatabaseURL            string
	SessionSecret          string
	AdminSessionSecret     string
	SurepassBaseURL        string
	SurepassBearerToken    string
	BankNameMatchThreshold int
	NodeEnv                string
}

func LoadConfig() *Config {
	// Load .env if present (try parent and current dir)
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../web/.env")

	port := getEnv("PORT", "8080")
	dbPath := getEnv("DB_PATH", "./dev.db")
	databaseURL := getEnv("DATABASE_URL", "")
	if databaseURL == "" {
		databaseURL = getEnv("POSTGRES_URL", "")
	}
	sessionSecret := getEnv("SESSION_SECRET", "super-secret-udharco-session-key-32chars!!")
	adminSessionSecret := getEnv("ADMIN_SESSION_SECRET", "super-secret-udharco-admin-key-32chars!!")
	surepassBaseURL := getEnv("SUREPASS_BASE_URL", "https://sandbox.surepass.app")
	surepassBearerToken := getEnv("SUREPASS_BEARER_TOKEN", "")
	nodeEnv := getEnv("NODE_ENV", "development")

	threshold := 70
	if val := os.Getenv("BANK_NAME_MATCH_THRESHOLD"); val != "" {
		if parsed, err := strconv.Atoi(val); err == nil && parsed > 0 && parsed <= 100 {
			threshold = parsed
		}
	}

	return &Config{
		Port:                   port,
		DBPath:                 dbPath,
		DatabaseURL:            databaseURL,
		SessionSecret:          sessionSecret,
		AdminSessionSecret:     adminSessionSecret,
		SurepassBaseURL:        surepassBaseURL,
		SurepassBearerToken:    surepassBearerToken,
		BankNameMatchThreshold: threshold,
		NodeEnv:                nodeEnv,
	}
}

func (c *Config) IsProduction() bool {
	return c.NodeEnv == "production"
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
