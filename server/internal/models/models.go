package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User represents a platform user (Seller, Anchor, or Investor)
type User struct {
	ID           string     `gorm:"primaryKey;size:64" json:"id"`
	Mobile       *string    `gorm:"uniqueIndex;size:20" json:"mobile,omitempty"`
	Email        *string    `gorm:"uniqueIndex;size:120" json:"email,omitempty"`
	PasswordHash *string    `gorm:"size:255" json:"-"`
	Role         string     `gorm:"size:20;not null" json:"role"` // SELLER, ANCHOR, INVESTOR
	InviteToken  *string    `gorm:"uniqueIndex;size:128" json:"inviteToken,omitempty"`
	InviteExpiry *time.Time `json:"inviteExpiry,omitempty"`
	IsActive     bool       `gorm:"default:false" json:"isActive"`

	SellerID   *string   `gorm:"uniqueIndex;size:64" json:"sellerId,omitempty"`
	Seller     *Seller   `gorm:"foreignKey:SellerID;constraint:OnDelete:CASCADE" json:"seller,omitempty"`
	AnchorID   *string   `gorm:"uniqueIndex;size:64" json:"anchorId,omitempty"`
	Anchor     *Anchor   `gorm:"foreignKey:AnchorID;constraint:OnDelete:CASCADE" json:"anchor,omitempty"`
	InvestorID *string   `gorm:"uniqueIndex;size:64" json:"investorId,omitempty"`
	Investor   *Investor `gorm:"foreignKey:InvestorID;constraint:OnDelete:CASCADE" json:"investor,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	return nil
}

// AdminUser represents root platform operations administrator
type AdminUser struct {
	ID               string     `gorm:"primaryKey;size:64" json:"id"`
	Email            string     `gorm:"uniqueIndex;size:120;not null" json:"email"`
	PasswordHash     string     `gorm:"size:255;not null" json:"-"`
	TwoFactorSecret  *string    `gorm:"size:128" json:"-"`
	TwoFactorEnabled bool       `gorm:"default:false" json:"twoFactorEnabled"`
	IsActive         bool       `gorm:"default:true" json:"isActive"`
	LastLoginAt      *time.Time `json:"lastLoginAt,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

func (a *AdminUser) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	return nil
}

// OtpCode represents mobile SMS OTP for Seller authentication
type OtpCode struct {
	ID        string    `gorm:"primaryKey;size:64" json:"id"`
	Mobile    string    `gorm:"size:20;not null;index" json:"mobile"`
	Code      string    `gorm:"size:10;not null" json:"code"`
	Purpose   string    `gorm:"size:20;default:'LOGIN'" json:"purpose"` // LOGIN, SIGNUP
	ExpiresAt time.Time `json:"expiresAt"`
	Used      bool      `gorm:"default:false" json:"used"`
	CreatedAt time.Time `json:"createdAt"`
}

func (o *OtpCode) BeforeCreate(tx *gorm.DB) error {
	if o.ID == "" {
		o.ID = uuid.New().String()
	}
	return nil
}

// Seller represents an MSME Vendor seeking factoring advance
type Seller struct {
	ID                 string    `gorm:"primaryKey;size:64" json:"id"`
	LegalName          string    `gorm:"size:255;not null" json:"legalName"`
	GSTIN              string    `gorm:"uniqueIndex;size:20;not null" json:"gstin"`
	PAN                string    `gorm:"size:15;not null" json:"pan"`
	BankAccountNo      string    `gorm:"size:64;not null" json:"bankAccountNo"`
	BankIFSC           string    `gorm:"size:20;not null" json:"bankIfsc"`
	KYCStatus          string    `gorm:"size:20;default:'PENDING'" json:"kycStatus"` // PENDING, VERIFIED, REJECTED
	EnachMandateID     *string   `gorm:"size:128" json:"enachMandateId,omitempty"`
	EnachMandateStatus string    `gorm:"size:20;default:'PENDING'" json:"enachMandateStatus"` // PENDING, ACTIVE, EXPIRED, FAILED
	CreditLimit        float64   `gorm:"default:0" json:"creditLimit"`
	CreditLimitStatus  string    `gorm:"size:20;default:'PENDING'" json:"creditLimitStatus"` // PENDING, SANCTIONED, REJECTED
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`

	Invoices []Invoice `gorm:"foreignKey:SellerID" json:"invoices,omitempty"`
}

func (s *Seller) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	return nil
}

// Anchor represents a Corporate Debtor / Buyer Entity
type Anchor struct {
	ID                   string    `gorm:"primaryKey;size:64" json:"id"`
	CorporateName        string    `gorm:"size:255;not null" json:"corporateName"`
	GSTIN                string    `gorm:"uniqueIndex;size:20;not null" json:"gstin"`
	CreditRating         string    `gorm:"size:20;default:'UNRATED'" json:"creditRating"` // UNRATED, AAA, AA+, AA, A, BBB
	MaxExposureLimit     float64   `gorm:"default:0" json:"maxExposureLimit"`
	CurrentExposure      float64   `gorm:"default:0" json:"currentExposure"`
	Status               string    `gorm:"size:20;default:'PENDING'" json:"status"` // PENDING, ACTIVE, REJECTED, SUSPENDED
	SourceChannel        string    `gorm:"size:30;default:'VENDOR_PUSH'" json:"sourceChannel"` // VENDOR_PUSH, ENTERPRISE_SALES
	ContactPerson        *string   `gorm:"size:120" json:"contactPerson,omitempty"`
	ContactEmail         *string   `gorm:"size:120" json:"contactEmail,omitempty"`
	ContactPhone         *string   `gorm:"size:20" json:"contactPhone,omitempty"`
	AnnualProcurement    *float64  `json:"annualProcurement,omitempty"`
	StandardPaymentTerms *int      `gorm:"default:30" json:"standardPaymentTerms,omitempty"`
	CreatedAt            time.Time `json:"createdAt"`
	UpdatedAt            time.Time `json:"updatedAt"`

	Invoices []Invoice `gorm:"foreignKey:AnchorID" json:"invoices,omitempty"`
}

func (a *Anchor) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	return nil
}

// Investor represents an Institutional Funder (Bank, NBFC, HNI)
type Investor struct {
	ID            string    `gorm:"primaryKey;size:64" json:"id"`
	EntityName    string    `gorm:"size:255;not null" json:"entityName"`
	InvestorType  string    `gorm:"size:20;default:'NBFC'" json:"investorType"` // BANK, NBFC, HNI
	EscrowBalance float64   `gorm:"default:0" json:"escrowBalance"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`

	Bids []FundingBid `gorm:"foreignKey:InvestorID" json:"bids,omitempty"`
}

func (i *Investor) BeforeCreate(tx *gorm.DB) error {
	if i.ID == "" {
		i.ID = uuid.New().String()
	}
	return nil
}

// Invoice represents a verified factoring receivable
type Invoice struct {
	ID                     string    `gorm:"primaryKey;size:64" json:"id"`
	InvoiceNumber          string    `gorm:"size:100;not null" json:"invoiceNumber"`
	FinancialYear          string    `gorm:"size:20;not null" json:"financialYear"`
	InvoiceDate            time.Time `json:"invoiceDate"`
	DueDate                time.Time `json:"dueDate"`
	TenureDays             int       `gorm:"default:90" json:"tenureDays"`
	PricingModel           string    `gorm:"size:30;default:'NET_DISBURSED'" json:"pricingModel"`
	TotalAmount            float64   `gorm:"not null" json:"totalAmount"`
	MarginHoldPct          float64   `gorm:"default:15.0" json:"marginHoldPct"`
	MarginHeldAmount       float64   `gorm:"default:0" json:"marginHeldAmount"`
	UpfrontDisbursedAmount float64   `gorm:"default:0" json:"upfrontDisbursedAmount"`
	DiscountRatePa         float64   `gorm:"default:11.0" json:"discountRatePa"` // Locked 11.0% p.a. Benchmark
	PlatformFeePct         float64   `gorm:"default:1.0" json:"platformFeePct"`
	RecourseType           string    `gorm:"size:20;default:'RECOURSE'" json:"recourseType"`
	Status                 string    `gorm:"size:30;default:'UPLOADED'" json:"status"` // UPLOADED, VERIFIED, ANCHOR_CONFIRMED, LISTED, FUNDED, SETTLED, DEFAULTED, DISPUTED, REJECTED
	DisputeReason          *string   `gorm:"size:255" json:"disputeReason,omitempty"`
	EwayBillNo             *string   `gorm:"size:64" json:"ewayBillNo,omitempty"`
	PONumber               *string   `gorm:"size:100" json:"poNumber,omitempty"`
	InvoiceDocumentURL     *string   `gorm:"type:text" json:"invoiceDocumentUrl,omitempty"`
	InvoiceDocumentName    *string   `gorm:"size:255" json:"invoiceDocumentName,omitempty"`
	IRN                    *string   `gorm:"size:128" json:"irn,omitempty"`
	IRNVerified            bool      `gorm:"default:false" json:"irnVerified"`
	CersaiSecurityID       *string   `gorm:"size:128" json:"cersaiSecurityId,omitempty"`
	CersaiStatus           string    `gorm:"size:20;default:'PENDING'" json:"cersaiStatus"` // PENDING, REGISTERED
	NoaSentAt              *time.Time `json:"noaSentAt,omitempty"`
	AnchorReminderCount    int       `gorm:"default:0" json:"anchorReminderCount"`
	LastReminderSentAt     *time.Time `json:"lastReminderSentAt,omitempty"`
	InvoiceHash            string    `gorm:"uniqueIndex;size:128;not null" json:"invoiceHash"`
	VirtualAccountNumber   *string   `gorm:"size:64" json:"virtualAccountNumber,omitempty"`

	SellerID string  `gorm:"size:64;not null;index" json:"sellerId"`
	Seller   Seller  `gorm:"foreignKey:SellerID;constraint:OnDelete:CASCADE" json:"seller"`
	AnchorID string  `gorm:"size:64;not null;index" json:"anchorId"`
	Anchor   Anchor  `gorm:"foreignKey:AnchorID;constraint:OnDelete:CASCADE" json:"anchor"`

	AnchorConfirmedAt *time.Time `json:"anchorConfirmedAt,omitempty"`
	FundedAt          *time.Time `json:"fundedAt,omitempty"`
	SettledAt         *time.Time `json:"settledAt,omitempty"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`

	FundingBids        []FundingBid        `gorm:"foreignKey:InvoiceID" json:"fundingBids,omitempty"`
	EscrowTransactions []EscrowTransaction `gorm:"foreignKey:InvoiceID" json:"escrowTransactions,omitempty"`
	SettlementRecord   *SettlementRecord   `gorm:"foreignKey:InvoiceID" json:"settlementRecord,omitempty"`
}

func (inv *Invoice) BeforeCreate(tx *gorm.DB) error {
	if inv.ID == "" {
		inv.ID = uuid.New().String()
	}
	return nil
}

// FundingBid represents an institutional investor's bid on a listed invoice
type FundingBid struct {
	ID             string    `gorm:"primaryKey;size:64" json:"id"`
	FundedAmount   float64   `gorm:"not null" json:"fundedAmount"`
	ExpectedReturn float64   `gorm:"not null" json:"expectedReturn"`
	Status         string    `gorm:"size:20;default:'CONFIRMED'" json:"status"`
	InvoiceID      string    `gorm:"size:64;not null;index" json:"invoiceId"`
	InvestorID     string    `gorm:"size:64;not null;index" json:"investorId"`
	Investor       Investor  `gorm:"foreignKey:InvestorID;constraint:OnDelete:CASCADE" json:"investor"`
	CreatedAt      time.Time `json:"createdAt"`
}

func (fb *FundingBid) BeforeCreate(tx *gorm.DB) error {
	if fb.ID == "" {
		fb.ID = uuid.New().String()
	}
	return nil
}

// EscrowTransaction represents an auditable money movement in the Escrow account
type EscrowTransaction struct {
	ID              string    `gorm:"primaryKey;size:64" json:"id"`
	TransactionType string    `gorm:"size:40;not null" json:"transactionType"` // BUYER_REPAYMENT, INVESTOR_PAYOUT, PLATFORM_FEE, SELLER_MARGIN_RELEASE, RECOURSE_RECOVERY
	Amount          float64   `gorm:"not null" json:"amount"`
	Notes           *string   `gorm:"size:255" json:"notes,omitempty"`
	InvoiceID       string    `gorm:"size:64;not null;index" json:"invoiceId"`
	CreatedAt       time.Time `json:"createdAt"`
}

func (et *EscrowTransaction) BeforeCreate(tx *gorm.DB) error {
	if et.ID == "" {
		et.ID = uuid.New().String()
	}
	return nil
}

// SettlementRecord stores final accounting closure of an invoice
type SettlementRecord struct {
	ID                    string    `gorm:"primaryKey;size:64" json:"id"`
	TotalReceived         float64   `gorm:"not null" json:"totalReceived"`
	InvestorPrincipalPaid float64   `gorm:"not null" json:"investorPrincipalPaid"`
	InvestorInterestPaid  float64   `gorm:"not null" json:"investorInterestPaid"`
	PlatformFeeDeducted   float64   `gorm:"not null" json:"platformFeeDeducted"`
	SellerMarginReturned  float64   `gorm:"not null" json:"sellerMarginReturned"`
	ShortfallAmount       float64   `gorm:"default:0" json:"shortfallAmount"`
	RecourseTriggered     bool      `gorm:"default:false" json:"recourseTriggered"`
	InvoiceID             string    `gorm:"uniqueIndex;size:64;not null" json:"invoiceId"`
	SettledAt             time.Time `json:"settledAt"`
}

func (sr *SettlementRecord) BeforeCreate(tx *gorm.DB) error {
	if sr.ID == "" {
		sr.ID = uuid.New().String()
	}
	return nil
}

// WebhookEvent represents an idempotent bank credit webhook
type WebhookEvent struct {
	ID             string    `gorm:"primaryKey;size:64" json:"id"`
	IdempotencyKey string    `gorm:"uniqueIndex;size:128;not null" json:"idempotencyKey"`
	Provider       string    `gorm:"size:40;default:'ICICI_ESCROW'" json:"provider"`
	EventType      string    `gorm:"size:50;not null" json:"eventType"`
	Payload        string    `gorm:"type:text;not null" json:"payload"`
	Status         string    `gorm:"size:30;default:'PROCESSED'" json:"status"`
	ProcessedAt    time.Time `json:"processedAt"`
}

func (we *WebhookEvent) BeforeCreate(tx *gorm.DB) error {
	if we.ID == "" {
		we.ID = uuid.New().String()
	}
	return nil
}

// AuditLog is an immutable append-only compliance ledger
type AuditLog struct {
	ID            string    `gorm:"primaryKey;size:64" json:"id"`
	EntityType    string    `gorm:"size:40;not null;index:idx_audit_entity" json:"entityType"`
	EntityID      string    `gorm:"size:64;not null;index:idx_audit_entity" json:"entityId"`
	Action        string    `gorm:"size:60;not null" json:"action"`
	ActorRole     string    `gorm:"size:30;not null" json:"actorRole"`
	ActorID       *string   `gorm:"size:64" json:"actorId,omitempty"`
	PreviousState *string   `gorm:"size:60" json:"previousState,omitempty"`
	NewState      *string   `gorm:"size:60" json:"newState,omitempty"`
	Metadata      *string   `gorm:"type:text" json:"metadata,omitempty"`
	Timestamp     time.Time `json:"timestamp"`
}

func (al *AuditLog) BeforeCreate(tx *gorm.DB) error {
	if al.ID == "" {
		al.ID = uuid.New().String()
	}
	if al.Timestamp.IsZero() {
		al.Timestamp = time.Now()
	}
	return nil
}
