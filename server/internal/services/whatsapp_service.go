package services

import (
	"fmt"
	"log"
	"math/rand"
	"regexp"
	"time"
)

type WhatsAppTemplatePayload struct {
	ToMobile        string
	RecipientName   string
	SellerName      string
	InvoiceNumber   string
	InvoiceAmount   float64
	VerificationURL string
}

type WhatsAppService struct{}

func NewWhatsAppService() *WhatsAppService {
	return &WhatsAppService{}
}

// SendInvoiceNOATemplate logs and dispatches HSM template for Notice of Assignment
func (w *WhatsAppService) SendInvoiceNOATemplate(payload WhatsAppTemplatePayload) (bool, string) {
	re := regexp.MustCompile(`\D`)
	cleanMobile := re.ReplaceAllString(payload.ToMobile, "")

	msgID := fmt.Sprintf("wamid_simulated_%d_%d", time.Now().UnixMilli(), rand.Intn(1000))
	log.Printf("[WhatsAppService] Dispatched HSM NOA to +91%s for Invoice #%s (₹%.2f) -> URL: %s",
		cleanMobile, payload.InvoiceNumber, payload.InvoiceAmount, payload.VerificationURL)

	return true, msgID
}

// SendBuyerConfirmationOTP dispatches a 6-digit WhatsApp OTP for quick SME buyer approval
func (w *WhatsAppService) SendBuyerConfirmationOTP(mobile, otp, invoiceNumber string) bool {
	re := regexp.MustCompile(`\D`)
	cleanMobile := re.ReplaceAllString(mobile, "")
	log.Printf("[WhatsAppService] Sent WhatsApp OTP [%s] to +91%s for Invoice #%s", otp, cleanMobile, invoiceNumber)
	return true
}
