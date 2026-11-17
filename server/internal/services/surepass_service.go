package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/bhavyc/udharco/server/internal/config"
	"github.com/bhavyc/udharco/server/internal/models"
	"gorm.io/gorm"
)

type GstLookupResult struct {
	Success   bool   `json:"success"`
	GSTIN     string `json:"gstin"`
	LegalName string `json:"legalName"`
	TradeName string `json:"tradeName,omitempty"`
	PAN       string `json:"pan"`
	State     string `json:"state"`
	Status    string `json:"status"` // ACTIVE, CANCELLED, UNKNOWN
	Cached    bool   `json:"cached"`
	Error     string `json:"error,omitempty"`
}

type BankVerifyResult struct {
	Success            bool   `json:"success"`
	AccountNumber      string `json:"accountNumber"`
	IFSC               string `json:"ifsc"`
	BeneficiaryName    string `json:"beneficiaryName"`
	BankName           string `json:"bankName"`
	IsPennyDropSuccess bool   `json:"isPennyDropSuccess"`
	Error              string `json:"error,omitempty"`
}

type SurepassService struct {
	cache   map[string]GstLookupResult
	cacheMu sync.RWMutex
}

var GlobalSurepassService = &SurepassService{
	cache: make(map[string]GstLookupResult),
}

// VerifyGstin checks business validity via Surepass API, local cache, or DB records
func (s *SurepassService) VerifyGstin(db *gorm.DB, cfg *config.Config, gstin string) GstLookupResult {
	cleanGst := strings.ToUpper(strings.TrimSpace(gstin))
	pan := ""
	if len(cleanGst) >= 12 {
		pan = cleanGst[2:12]
	}

	// Safeguard 1: Known Demo / Test GSTINs
	if cleanGst == "27AABCU9603R1ZX" || cleanGst == "27AABCU9603R1ZM" {
		return GstLookupResult{
			Success:   true,
			GSTIN:     cleanGst,
			LegalName: "Raju Steel & Pipes Pvt Ltd",
			TradeName: "Raju Steel",
			PAN:       pan,
			State:     "Maharashtra",
			Status:    "ACTIVE",
			Cached:    true,
		}
	}

	if cleanGst == "27AAACT2727Q1ZW" {
		return GstLookupResult{
			Success:   true,
			GSTIN:     cleanGst,
			LegalName: "Tata Motors Ltd",
			TradeName: "Tata Motors",
			PAN:       pan,
			State:     "Maharashtra",
			Status:    "ACTIVE",
			Cached:    true,
		}
	}

	// Format validation
	gstRegex := regexp.MustCompile(`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`)
	if !gstRegex.MatchString(cleanGst) {
		return GstLookupResult{
			Success: false,
			GSTIN:   cleanGst,
			PAN:     pan,
			State:   cleanGst[:2],
			Status:  "UNKNOWN",
			Error:   "Invalid GSTIN structure. Must follow statutory Indian 15-character format (e.g. 27AAACT2727Q1ZW).",
		}
	}

	// Check In-Memory Cache
	s.cacheMu.RLock()
	if cached, ok := s.cache[cleanGst]; ok {
		s.cacheMu.RUnlock()
		cached.Cached = true
		return cached
	}
	s.cacheMu.RUnlock()

	// Check Database for existing Anchor
	var anchor models.Anchor
	if err := db.Where("gstin = ?", cleanGst).First(&anchor).Error; err == nil {
		res := GstLookupResult{
			Success:   true,
			GSTIN:     cleanGst,
			LegalName: anchor.CorporateName,
			TradeName: anchor.CorporateName,
			PAN:       pan,
			State:     cleanGst[:2],
			Status:    anchor.Status,
			Cached:    true,
		}
		s.cacheMu.Lock()
		s.cache[cleanGst] = res
		s.cacheMu.Unlock()
		return res
	}

	// Check Database for existing Seller
	var seller models.Seller
	if err := db.Where("gstin = ?", cleanGst).First(&seller).Error; err == nil {
		res := GstLookupResult{
			Success:   true,
			GSTIN:     cleanGst,
			LegalName: seller.LegalName,
			TradeName: seller.LegalName,
			PAN:       pan,
			State:     cleanGst[:2],
			Status:    seller.KYCStatus,
			Cached:    true,
		}
		s.cacheMu.Lock()
		s.cache[cleanGst] = res
		s.cacheMu.Unlock()
		return res
	}

	// Call Live Surepass API if token configured
	if cfg.SurepassBearerToken != "" && len(cfg.SurepassBearerToken) > 20 {
		apiURL := fmt.Sprintf("%s/api/v1/corporate/gstin", cfg.SurepassBaseURL)
		reqBody, _ := json.Marshal(map[string]string{"id_number": cleanGst})

		req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(reqBody))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", cfg.SurepassBearerToken))

			client := &http.Client{Timeout: 8 * time.Second}
			resp, err := client.Do(req)
			if err == nil {
				defer resp.Body.Close()
				var apiRes struct {
					Success bool `json:"success"`
					Data    struct {
						LegalName    string `json:"legal_name"`
						BusinessName string `json:"business_name"`
						TradeName    string `json:"trade_name"`
						PanNumber    string `json:"pan_number"`
						GSTINStatus  string `json:"gstin_status"`
					} `json:"data"`
					Message string `json:"message"`
				}
				if json.NewDecoder(resp.Body).Decode(&apiRes) == nil && apiRes.Success {
					name := apiRes.Data.LegalName
					if name == "" {
						name = apiRes.Data.BusinessName
					}
					status := "ACTIVE"
					if strings.EqualFold(apiRes.Data.GSTINStatus, "Cancelled") {
						status = "CANCELLED"
					}
					res := GstLookupResult{
						Success:   true,
						GSTIN:     cleanGst,
						LegalName: name,
						TradeName: apiRes.Data.TradeName,
						PAN:       apiRes.Data.PanNumber,
						State:     cleanGst[:2],
						Status:    status,
					}
					s.cacheMu.Lock()
					s.cache[cleanGst] = res
					s.cacheMu.Unlock()
					return res
				}
			}
		}
	}

	// If in production and API not configured
	if cfg.IsProduction() {
		return GstLookupResult{
			Success: false,
			GSTIN:   cleanGst,
			PAN:     pan,
			State:   cleanGst[:2],
			Status:  "UNKNOWN",
			Error:   "Government GST verification gateway temporarily unavailable in production.",
		}
	}

	// Non-production fallback
	return GstLookupResult{
		Success:   true,
		GSTIN:     cleanGst,
		LegalName: fmt.Sprintf("Enterprise %s Industries Pvt Ltd", cleanGst[:4]),
		TradeName: "Enterprise Commercial",
		PAN:       pan,
		State:     cleanGst[:2],
		Status:    "ACTIVE",
	}
}

// VerifyBankAccount executes Penny Drop reverse-lookup with core banking
func (s *SurepassService) VerifyBankAccount(cfg *config.Config, accountNumber, ifsc, declaredLegalName string) BankVerifyResult {
	cleanAcc := strings.TrimSpace(accountNumber)
	cleanIFSC := strings.ToUpper(strings.TrimSpace(ifsc))

	// Live API call if configured
	if cfg.SurepassBearerToken != "" && len(cfg.SurepassBearerToken) > 20 {
		apiURL := fmt.Sprintf("%s/api/v1/bank-verification/", cfg.SurepassBaseURL)
		reqBody, _ := json.Marshal(map[string]string{
			"id_number": cleanAcc,
			"ifsc":      cleanIFSC,
		})

		req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(reqBody))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", cfg.SurepassBearerToken))

			client := &http.Client{Timeout: 10 * time.Second}
			resp, err := client.Do(req)
			if err == nil {
				defer resp.Body.Close()
				var apiRes struct {
					Success bool `json:"success"`
					Data    struct {
						FullName string `json:"full_name"`
						BankName string `json:"bank_name"`
					} `json:"data"`
					Message string `json:"message"`
				}
				if json.NewDecoder(resp.Body).Decode(&apiRes) == nil && apiRes.Success && apiRes.Data.FullName != "" {
					return BankVerifyResult{
						Success:            true,
						AccountNumber:      cleanAcc,
						IFSC:               cleanIFSC,
						BeneficiaryName:    apiRes.Data.FullName,
						BankName:           apiRes.Data.BankName,
						IsPennyDropSuccess: true,
					}
				} else if cfg.IsProduction() {
					errMsg := apiRes.Message
					if errMsg == "" {
						errMsg = "Core banking IMPS penny-drop verification failed."
					}
					return BankVerifyResult{
						Success: false,
						Error:   errMsg,
					}
				}
			}
		}

		if cfg.IsProduction() {
			return BankVerifyResult{
				Success: false,
				Error:   "Core banking penny-drop service temporarily unreachable. Please retry.",
			}
		}
	} else if cfg.IsProduction() {
		// Security Gate: In production, missing credentials must fail-closed
		return BankVerifyResult{
			Success: false,
			Error:   "Banking penny-drop verification service is not configured in production.",
		}
	}

	// ── DEV / SANDBOX FALLBACK (STRICTLY NON-PRODUCTION) ──
	isSimulatedMismatch := strings.Contains(cleanAcc, "9999") ||
		strings.Contains(cleanAcc, "8888") ||
		strings.Contains(strings.ToUpper(cleanAcc), "MISMATCH") ||
		strings.Contains(strings.ToUpper(cleanAcc), "FRAUD") ||
		strings.Contains(strings.ToUpper(cleanAcc), "PERSONAL")

	if isSimulatedMismatch {
		return BankVerifyResult{
			Success:            true,
			AccountNumber:      cleanAcc,
			IFSC:               cleanIFSC,
			BeneficiaryName:    "Rahul Sharma (Personal Savings Account)",
			BankName:           "HDFC Bank Ltd",
			IsPennyDropSuccess: true,
		}
	}

	name := declaredLegalName
	if name == "" {
		name = "Raju Steel & Pipes Pvt Ltd"
	}

	return BankVerifyResult{
		Success:            true,
		AccountNumber:      cleanAcc,
		IFSC:               cleanIFSC,
		BeneficiaryName:    name,
		BankName:           "HDFC Bank Ltd",
		IsPennyDropSuccess: true,
	}
}
