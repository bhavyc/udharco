package services

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/bhavyc/udharco/server/internal/models"
	"gorm.io/gorm"
)

type ConcentrationRiskResult struct {
	IsExceeded         bool    `json:"isExceeded"`
	CurrentExposure    float64 `json:"currentExposure"`
	MaxExposureLimit   float64 `json:"maxExposureLimit"`
	ProjectedExposure  float64 `json:"projectedExposure"`
	UtilizationPct     float64 `json:"utilizationPct"`
	AvailableLimit     float64 `json:"availableLimit"`
	RejectReason       string  `json:"rejectReason,omitempty"`
}

type RampUpBreakdown struct {
	UpfrontDisbursedAmount float64 `json:"upfrontDisbursedAmount"`
	MarginHeldAmount       float64 `json:"marginHeldAmount"`
	PlatformFeeAmount      float64 `json:"platformFeeAmount"`
	AdvancePct             float64 `json:"advancePct"`
	MarginHoldPct          float64 `json:"marginHoldPct"`
	PlatformFeePct         float64 `json:"platformFeePct"`
}

type BuyerClassification struct {
	Track               string `json:"track"` // ENTERPRISE or SME_COMMERCIAL
	StandardPaymentDays int    `json:"standardPaymentDays"`
	MaxProbationCap     float64 `json:"maxProbationCap"`
}

type RecourseEvaluation struct {
	MandatoryRecourse bool   `json:"mandatoryRecourse"`
	Reason            string `json:"reason"`
}

type RiskService struct{}

// GetDiscountRateByRating returns the exact dynamic discount rate p.a. based on Corporate Credit Rating
// AAA benchmark is strictly locked at 11.0% p.a. (Tata Motors, Reliance)
func (s *RiskService) GetDiscountRateByRating(rating string) float64 {
	switch strings.ToUpper(strings.TrimSpace(rating)) {
	case "AAA":
		return 11.0 // Strictly locked 11.0% p.a. benchmark
	case "AA+":
		return 12.0
	case "AA":
		return 12.5
	case "A":
		return 14.0
	case "BBB":
		return 16.0
	default:
		return 15.0
	}
}

// CheckAnchorExposureLimit enforces concentration risk ceiling
func (s *RiskService) CheckAnchorExposureLimit(db *gorm.DB, anchorID string, newInvoiceAmount float64) (*ConcentrationRiskResult, error) {
	var anchor models.Anchor
	if err := db.Where("id = ?", anchorID).First(&anchor).Error; err != nil {
		return nil, fmt.Errorf("corporate anchor with ID '%s' not found: %w", anchorID, err)
	}

	projected := anchor.CurrentExposure + newInvoiceAmount
	isExceeded := false
	utilization := 0.0

	if anchor.MaxExposureLimit > 0 {
		utilization = math.Round((projected/anchor.MaxExposureLimit)*10000) / 100
		isExceeded = projected > anchor.MaxExposureLimit
	} else {
		// Limit is ₹0 (Unsanctioned / Underwriting pending)
		isExceeded = true
		utilization = 100.0
	}

	available := math.Max(0, anchor.MaxExposureLimit-anchor.CurrentExposure)

	var rejectReason string
	if isExceeded {
		if anchor.MaxExposureLimit <= 0 {
			rejectReason = fmt.Sprintf("Corporate Anchor '%s' has not been sanctioned an exposure limit (Limit: ₹0.00). Underwriting review required.", anchor.CorporateName)
		} else {
			rejectReason = fmt.Sprintf("Invoice amount ₹%.2f exceeds Corporate Anchor's approved exposure limit of ₹%.2f. Utilization would reach %.2f%%.", newInvoiceAmount, anchor.MaxExposureLimit, utilization)
		}
	}

	return &ConcentrationRiskResult{
		IsExceeded:        isExceeded,
		CurrentExposure:   anchor.CurrentExposure,
		MaxExposureLimit:  anchor.MaxExposureLimit,
		ProjectedExposure: projected,
		UtilizationPct:    utilization,
		AvailableLimit:    available,
		RejectReason:      rejectReason,
	}, nil
}

// CalculateRampUpDisbursement calculates standard 84% upfront, 15% escrow reserve, 1% fee
func (s *RiskService) CalculateRampUpDisbursement(amount float64, buyerTrack string, buyerSettledCount int64) RampUpBreakdown {
	advancePct := 84.0
	marginPct := 15.0
	platformFeePct := 1.0

	upfront := math.Round(amount * (advancePct / 100.0))
	margin := math.Round(amount * (marginPct / 100.0))
	fee := math.Round(amount * (platformFeePct / 100.0))

	return RampUpBreakdown{
		UpfrontDisbursedAmount: upfront,
		MarginHeldAmount:       margin,
		PlatformFeeAmount:      fee,
		AdvancePct:             advancePct,
		MarginHoldPct:          marginPct,
		PlatformFeePct:         platformFeePct,
	}
}

// ClassifyBuyerTrack categorizes buyer into ENTERPRISE vs SME_COMMERCIAL
func (s *RiskService) ClassifyBuyerTrack(anchor *models.Anchor) BuyerClassification {
	rating := strings.ToUpper(strings.TrimSpace(anchor.CreditRating))
	isTier1 := rating == "AAA" || rating == "AA+" || rating == "AA"

	if isTier1 && anchor.MaxExposureLimit >= 50000000 {
		return BuyerClassification{
			Track:               "ENTERPRISE",
			StandardPaymentDays: 60,
			MaxProbationCap:     anchor.MaxExposureLimit,
		}
	}

	return BuyerClassification{
		Track:               "SME_COMMERCIAL",
		StandardPaymentDays: 45,
		MaxProbationCap:     5000000, // ₹50 Lakh probation ceiling
	}
}

// DetermineMandatoryRecourse checks if transaction must have mandatory e-NACH recourse
func (s *RiskService) DetermineMandatoryRecourse(rating string, utilizationPct float64) RecourseEvaluation {
	r := strings.ToUpper(strings.TrimSpace(rating))
	if r == "UNRATED" || r == "BBB" || r == "A" || utilizationPct > 80.0 {
		return RecourseEvaluation{
			MandatoryRecourse: true,
			Reason:            fmt.Sprintf("Mandatory recourse active: Debtor rating '%s' or utilization %.1f%% requires e-NACH protection.", r, utilizationPct),
		}
	}

	return RecourseEvaluation{
		MandatoryRecourse: false,
		Reason:            "Standard bilateral factoring terms apply.",
	}
}

// GetCurrentFinancialYear computes Indian FY string (April - March), e.g. "2026-27"
func (s *RiskService) GetCurrentFinancialYear() string {
	now := time.Now()
	year := now.Year()
	month := now.Month()

	if month < time.April {
		// January - March: Still belongs to previous calendar year's FY
		prev := (year - 1) % 100
		curr := year % 100
		return fmt.Sprintf("20%02d-%02d", prev, curr)
	}

	curr := year % 100
	next := (year + 1) % 100
	return fmt.Sprintf("20%02d-%02d", curr, next)
}
