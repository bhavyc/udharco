class Seller {
  final String id;
  final String legalName;
  final String gstin;
  final String pan;
  final String bankAccountNo;
  final String bankIfsc;
  final String kycStatus;
  final String enachMandateStatus;
  final String? enachMandateId;

  Seller({
    required this.id,
    required this.legalName,
    required this.gstin,
    required this.pan,
    required this.bankAccountNo,
    required this.bankIfsc,
    this.kycStatus = 'PENDING',
    this.enachMandateStatus = 'PENDING',
    this.enachMandateId,
  });

  factory Seller.fromJson(Map<String, dynamic> json) {
    return Seller(
      id: json['id'] ?? '',
      legalName: json['legalName'] ?? '',
      gstin: json['gstin'] ?? '',
      pan: json['pan'] ?? '',
      bankAccountNo: json['bankAccountNo'] ?? '',
      bankIfsc: json['bankIfsc'] ?? '',
      kycStatus: json['kycStatus'] ?? 'PENDING',
      enachMandateStatus: json['enachMandateStatus'] ?? 'PENDING',
      enachMandateId: json['enachMandateId'],
    );
  }
}

class Anchor {
  final String id;
  final String corporateName;
  final String gstin;
  final String creditRating;
  final double maxExposureLimit;
  final double currentExposure;

  Anchor({
    required this.id,
    required this.corporateName,
    required this.gstin,
    this.creditRating = 'UNRATED',
    this.maxExposureLimit = 0.0,
    this.currentExposure = 0.0,
  });

  factory Anchor.fromJson(Map<String, dynamic> json) {
    return Anchor(
      id: json['id'] ?? '',
      corporateName: json['corporateName'] ?? '',
      gstin: json['gstin'] ?? '',
      creditRating: json['creditRating'] ?? 'UNRATED',
      maxExposureLimit: (json['maxExposureLimit'] as num?)?.toDouble() ?? 0.0,
      currentExposure: (json['currentExposure'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class Investor {
  final String id;
  final String institutionName;
  final String entityType;
  final double escrowBalance;
  final double deployedCapital;

  Investor({
    required this.id,
    required this.institutionName,
    this.entityType = 'NBFC_INSTITUTIONAL',
    this.escrowBalance = 0.0,
    this.deployedCapital = 0.0,
  });

  factory Investor.fromJson(Map<String, dynamic> json) {
    return Investor(
      id: json['id'] ?? '',
      institutionName: json['institutionName'] ?? '',
      entityType: json['entityType'] ?? 'NBFC_INSTITUTIONAL',
      escrowBalance: (json['escrowBalance'] as num?)?.toDouble() ?? 0.0,
      deployedCapital: (json['deployedCapital'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class Invoice {
  final String id;
  final String invoiceNumber;
  final String financialYear;
  final DateTime dueDate;
  final int tenureDays;
  final double totalAmount;
  final double marginHoldPct;
  final double marginHeldAmount;
  final double upfrontDisbursedAmount;
  final double discountRatePa;
  final double platformFeePct;
  final String pricingModel; // NET_DISBURSED vs GROSS_ADVANCE
  final String recourseType; // RECOURSE vs NON_RECOURSE
  final String status;
  final String? irn;
  final bool irnVerified;
  final String? cersaiSecurityId;
  final String cersaiStatus;
  final String? virtualAccountNumber;
  final int anchorReminderCount;
  final DateTime? lastReminderSentAt;
  final Seller? seller;
  final Anchor? anchor;

  Invoice({
    required this.id,
    required this.invoiceNumber,
    required this.financialYear,
    required this.dueDate,
    this.tenureDays = 90,
    required this.totalAmount,
    this.marginHoldPct = 15.0,
    required this.marginHeldAmount,
    required this.upfrontDisbursedAmount,
    this.discountRatePa = 12.0,
    this.platformFeePct = 1.0,
    this.pricingModel = 'NET_DISBURSED',
    this.recourseType = 'RECOURSE',
    required this.status,
    this.irn,
    this.irnVerified = false,
    this.cersaiSecurityId,
    this.cersaiStatus = 'PENDING',
    this.virtualAccountNumber,
    this.anchorReminderCount = 0,
    this.lastReminderSentAt,
    this.seller,
    this.anchor,
  });

  factory Invoice.fromJson(Map<String, dynamic> json) {
    return Invoice(
      id: json['id'] ?? '',
      invoiceNumber: json['invoiceNumber'] ?? '',
      financialYear: json['financialYear'] ?? '2026-27',
      dueDate: json['dueDate'] != null ? DateTime.parse(json['dueDate']) : DateTime.now().add(const Duration(days: 90)),
      tenureDays: json['tenureDays'] ?? 90,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0.0,
      marginHoldPct: (json['marginHoldPct'] as num?)?.toDouble() ?? 15.0,
      marginHeldAmount: (json['marginHeldAmount'] as num?)?.toDouble() ?? 0.0,
      upfrontDisbursedAmount: (json['upfrontDisbursedAmount'] as num?)?.toDouble() ?? 0.0,
      discountRatePa: (json['discountRatePa'] as num?)?.toDouble() ?? 12.0,
      platformFeePct: (json['platformFeePct'] as num?)?.toDouble() ?? 1.0,
      pricingModel: json['pricingModel'] ?? 'NET_DISBURSED',
      recourseType: json['recourseType'] ?? 'RECOURSE',
      status: json['status'] ?? 'UPLOADED',
      irn: json['irn'],
      irnVerified: json['irnVerified'] ?? false,
      cersaiSecurityId: json['cersaiSecurityId'],
      cersaiStatus: json['cersaiStatus'] ?? 'PENDING',
      virtualAccountNumber: json['virtualAccountNumber'],
      anchorReminderCount: json['anchorReminderCount'] ?? 0,
      lastReminderSentAt: json['lastReminderSentAt'] != null ? DateTime.parse(json['lastReminderSentAt']) : null,
      seller: json['seller'] != null ? Seller.fromJson(json['seller']) : null,
      anchor: json['anchor'] != null ? Anchor.fromJson(json['anchor']) : null,
    );
  }
}

class EscrowTransaction {
  final String id;
  final double amount;
  final String txnType; // CREDIT vs DEBIT
  final String purpose;
  final String utrReference;
  final String fromAccount;
  final String toAccount;
  final DateTime createdAt;

  EscrowTransaction({
    required this.id,
    required this.amount,
    required this.txnType,
    required this.purpose,
    required this.utrReference,
    required this.fromAccount,
    required this.toAccount,
    required this.createdAt,
  });

  factory EscrowTransaction.fromJson(Map<String, dynamic> json) {
    return EscrowTransaction(
      id: json['id'] ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      txnType: json['txnType'] ?? 'CREDIT',
      purpose: json['purpose'] ?? '',
      utrReference: json['utrReference'] ?? '',
      fromAccount: json['fromAccount'] ?? '',
      toAccount: json['toAccount'] ?? '',
      createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : DateTime.now(),
    );
  }
}
