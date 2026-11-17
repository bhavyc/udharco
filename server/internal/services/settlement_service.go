package services

import (
	"fmt"
	"math"
)

type WaterfallInput struct {
	TotalInvoiceAmount    float64
	RepaymentAmount       float64
	FundedPrincipal       float64
	ExpectedInvestorYield float64
	PlatformFeeAmount     float64
	RecourseType          string // RECOURSE vs NON_RECOURSE
}

type WaterfallOutput struct {
	Outcome                string  `json:"outcome"` // FULL_PAYMENT, PARTIAL_PAYMENT, DEFAULT
	TotalReceived          float64 `json:"totalReceived"`
	InvestorPrincipalPaid  float64 `json:"investorPrincipalPaid"`
	InvestorInterestPaid   float64 `json:"investorInterestPaid"`
	InvestorTotalPayout    float64 `json:"investorTotalPayout"`
	PlatformFeeDeducted    float64 `json:"platformFeeDeducted"`
	SellerMarginReturned   float64 `json:"sellerMarginReturned"`
	ShortfallAmount        float64 `json:"shortfallAmount"`
	RecourseTriggered      bool    `json:"recourseTriggered"`
	RecourseRecoveryDemand float64 `json:"recourseRecoveryDemand"`
	Notes                  string  `json:"notes"`
}

type SettlementService struct{}

func NewSettlementService() *SettlementService {
	return &SettlementService{}
}

// CalculateWaterfall executes the exact Waterfall Payout logic:
// 1. Investor Principal & Interest (Priority 1)
// 2. Platform Commission (Priority 2)
// 3. Seller Margin Release (Residual)
func (s *SettlementService) CalculateWaterfall(input WaterfallInput) WaterfallOutput {
	investorDue := input.FundedPrincipal + input.ExpectedInvestorYield
	shortfall := math.Max(0, input.TotalInvoiceAmount-input.RepaymentAmount)

	// CASE 1: Full Payment on Time (Happy Path)
	if input.RepaymentAmount >= input.TotalInvoiceAmount {
		investorTotalPayout := math.Round(investorDue*100) / 100
		platformFee := math.Round(input.PlatformFeeAmount*100) / 100
		sellerMarginReturned := math.Round((input.RepaymentAmount-investorTotalPayout-platformFee)*100) / 100

		return WaterfallOutput{
			Outcome:                "FULL_PAYMENT",
			TotalReceived:          input.RepaymentAmount,
			InvestorPrincipalPaid:  input.FundedPrincipal,
			InvestorInterestPaid:   input.ExpectedInvestorYield,
			InvestorTotalPayout:    investorTotalPayout,
			PlatformFeeDeducted:    platformFee,
			SellerMarginReturned:   math.Max(0, sellerMarginReturned),
			ShortfallAmount:        0,
			RecourseTriggered:      false,
			RecourseRecoveryDemand: 0,
			Notes:                  "Full payment received on due date. Investor, Platform, and Seller margin settled sequentially via Escrow waterfall.",
		}
	}

	// CASE 2: Full Default (Zero Payment)
	if input.RepaymentAmount <= 0 {
		isRecourse := input.RecourseType == "RECOURSE"
		demand := 0.0
		if isRecourse {
			demand = investorDue
		}
		notes := "Buyer defaulted. NON-RECOURSE model: Investor absorbs credit write-off loss."
		if isRecourse {
			notes = fmt.Sprintf("Buyer defaulted. RECOURSE triggered: Demand notice of ₹%.2f issued to MSME Seller.", investorDue)
		}

		return WaterfallOutput{
			Outcome:                "DEFAULT",
			TotalReceived:          0,
			InvestorPrincipalPaid:  0,
			InvestorInterestPaid:   0,
			InvestorTotalPayout:    0,
			PlatformFeeDeducted:    0,
			SellerMarginReturned:   0,
			ShortfallAmount:        input.TotalInvoiceAmount,
			RecourseTriggered:      isRecourse,
			RecourseRecoveryDemand: demand,
			Notes:                  notes,
		}
	}

	// CASE 3: Partial Payment (Shortfall / Dispute)
	availableForInvestor := math.Min(input.RepaymentAmount, investorDue)
	investorPrincipalPaid := math.Min(availableForInvestor, input.FundedPrincipal)
	investorInterestPaid := math.Max(0, availableForInvestor-investorPrincipalPaid)
	remainingAfterInvestor := math.Max(0, input.RepaymentAmount-availableForInvestor)
	platformFeeDeducted := math.Min(remainingAfterInvestor, input.PlatformFeeAmount)
	sellerMarginReturned := math.Max(0, remainingAfterInvestor-platformFeeDeducted)

	investorShortfall := math.Max(0, investorDue-availableForInvestor)
	isRecourse := input.RecourseType == "RECOURSE"
	recourseDemand := 0.0
	if isRecourse {
		recourseDemand = investorShortfall
	}

	return WaterfallOutput{
		Outcome:                "PARTIAL_PAYMENT",
		TotalReceived:          input.RepaymentAmount,
		InvestorPrincipalPaid:  math.Round(investorPrincipalPaid*100) / 100,
		InvestorInterestPaid:   math.Round(investorInterestPaid*100) / 100,
		InvestorTotalPayout:    math.Round(availableForInvestor*100) / 100,
		PlatformFeeDeducted:    math.Round(platformFeeDeducted*100) / 100,
		SellerMarginReturned:   math.Round(sellerMarginReturned*100) / 100,
		ShortfallAmount:        math.Round(shortfall*100) / 100,
		RecourseTriggered:      isRecourse && investorShortfall > 0,
		RecourseRecoveryDemand: math.Round(recourseDemand*100) / 100,
		Notes:                  fmt.Sprintf("Partial payment of ₹%.2f processed. Investor shortfall: ₹%.2f.", input.RepaymentAmount, investorShortfall),
	}
}
