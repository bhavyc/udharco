import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../providers/app_state.dart';
import '../theme/app_theme.dart';
import 'fintech_badges.dart';

class InvoiceCard extends StatelessWidget {
  final Invoice invoice;
  final VoidCallback? onTap;

  const InvoiceCard({super.key, required this.invoice, this.onTap});

  String _formatCurrency(double amount) {
    final format = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return format.format(amount);
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context);
    final role = appState.currentRole;

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      child: InkWell(
        onTap: onTap ?? () => _showInvoiceDetails(context, invoice),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row: Invoice No & Status
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppTheme.primary.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.receipt_long, color: AppTheme.primary, size: 20),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                invoice.invoiceNumber,
                                style: const TextStyle(
                                  color: AppTheme.textPrimary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                'FY ${invoice.financialYear} • ${invoice.tenureDays}d',
                                style: const TextStyle(
                                  color: AppTheme.textMuted,
                                  fontSize: 12,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  StatusPill(status: invoice.status),
                ],
              ),

              const SizedBox(height: 14),
              const Divider(color: AppTheme.borderDark, height: 1),
              const SizedBox(height: 14),

              // Anchor & Amount Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'CORPORATE BUYER (ANCHOR)',
                          style: TextStyle(
                            color: AppTheme.textMuted,
                            fontSize: 10,
                            letterSpacing: 0.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          invoice.anchor?.corporateName ?? 'Corporate Buyer',
                          style: const TextStyle(
                            color: AppTheme.textPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.blue.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                invoice.anchor?.creditRating ?? 'UNRATED',
                                style: const TextStyle(
                                  color: Colors.blueAccent,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '${invoice.discountRatePa}% p.a.',
                              style: const TextStyle(
                                color: AppTheme.textSecondary,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text(
                        'FACE VALUE',
                        style: TextStyle(
                          color: AppTheme.textMuted,
                          fontSize: 10,
                          letterSpacing: 0.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _formatCurrency(invoice.totalAmount),
                        style: const TextStyle(
                          color: AppTheme.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Upfront: ${_formatCurrency(invoice.upfrontDisbursedAmount)}',
                        style: const TextStyle(
                          color: AppTheme.primaryLight,
                          fontWeight: FontWeight.w600,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 12),

              // Badges Row
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  if (invoice.irnVerified)
                    const FintechChip(
                      label: 'IRN Shield Active',
                      icon: Icons.shield,
                      color: AppTheme.primary,
                    ),
                  if (invoice.cersaiStatus == 'REGISTERED')
                    const FintechChip(
                      label: 'CERSAI Filed',
                      icon: Icons.account_balance,
                      color: AppTheme.accentGold,
                    ),
                  FintechChip(
                    label: invoice.pricingModel == 'NET_DISBURSED' ? 'Net Disbursed' : 'Gross Advance',
                    icon: Icons.tune,
                    color: Colors.cyanAccent,
                  ),
                ],
              ),

              // Contextual Action Buttons
              if (role == UserRole.anchor && invoice.status == 'VERIFIED') ...[
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => _showAnchorSignModal(context, invoice),
                    icon: const Icon(Icons.assignment_turned_in, size: 16),
                    label: const Text('Review & Sign Tripartite NOA'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.indigoAccent,
                    ),
                  ),
                ),
              ] else if (role == UserRole.investor && invoice.status == 'LISTED') ...[
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => _showInvestorFundModal(context, invoice),
                    icon: const Icon(Icons.bolt, size: 16),
                    label: Text('Fund via Escrow (${_formatCurrency(invoice.pricingModel == "NET_DISBURSED" ? invoice.upfrontDisbursedAmount : (invoice.totalAmount * 0.85))})'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                    ),
                  ),
                ),
              ] else if (role == UserRole.seller && invoice.status == 'LISTED') ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.primary.withValues(alpha: 0.4)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.verified, color: AppTheme.primary, size: 16),
                          SizedBox(width: 6),
                          Text(
                            'Phase 4: Anchor Approved! Offer Ready',
                            style: TextStyle(
                              color: AppTheme.primaryLight,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Tata Motors approved NOA. Review your 84% advance cash offer (${_formatCurrency(invoice.upfrontDisbursedAmount)}) and e-sign via Aadhaar OTP.',
                        style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: () => _showSellerESignOfferModal(context, invoice),
                          icon: const Icon(Icons.fingerprint, size: 16),
                          label: const Text('Review Terms & e-Sign (Aadhaar OTP)'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primary,
                            foregroundColor: AppTheme.surfaceDark,
                            elevation: 4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ] else if (role == UserRole.admin && invoice.status == 'FUNDED') ...[
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => _showSettleWaterfallModal(context, invoice),
                    icon: const Icon(Icons.waterfall_chart, size: 16),
                    label: const Text('Execute Escrow Waterfall Settlement'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.accentGold,
                      foregroundColor: Colors.black,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  // Invoice Details Modal
  void _showInvoiceDetails(BuildContext context, Invoice inv) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.75,
          maxChildSize: 0.95,
          minChildSize: 0.5,
          expand: false,
          builder: (_, controller) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: ListView(
                controller: controller,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppTheme.borderDark,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          inv.invoiceNumber,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textPrimary,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      StatusPill(status: inv.status),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Virtual Escrow: ${inv.virtualAccountNumber ?? "Assigned upon funding"}',
                    style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
                  ),
                  const SizedBox(height: 20),

                  // 85/15 Waterfall breakdown card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceCard,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppTheme.borderDark),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '85 / 15 DISBURSEMENT BREAKDOWN',
                          style: TextStyle(
                            color: AppTheme.primary,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 12),
                        _row('Invoice Face Value', _formatCurrency(inv.totalAmount), isBold: true),
                        _row('Escrow Margin Hold (15%)', _formatCurrency(inv.marginHeldAmount), color: Colors.amber),
                        _row('Platform Fee (1%)', _formatCurrency(inv.totalAmount * (inv.platformFeePct / 100)), color: Colors.blueAccent),
                        const Divider(color: AppTheme.borderDark, height: 16),
                        _row('Upfront Cash Disbursed (84%)', _formatCurrency(inv.upfrontDisbursedAmount), color: AppTheme.primaryLight, isBold: true),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Statutory & Compliance Information
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceCard,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppTheme.borderDark),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'FINTECH & REGULATORY DETAILS',
                          style: TextStyle(
                            color: AppTheme.accentGold,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 10),
                        _row('Pricing Model', inv.pricingModel),
                        _row('Recourse Type', inv.recourseType),
                        _row('Anchor Credit Rating', inv.anchor?.creditRating ?? 'UNRATED'),
                        _row('Discount Rate', '${inv.discountRatePa}% p.a.'),
                        _row('IRN Status', inv.irnVerified ? 'Verified & Locked' : 'Pending'),
                        _row('CERSAI Charge', inv.cersaiStatus),
                        if (inv.cersaiSecurityId != null)
                          _row('CERSAI Security ID', inv.cersaiSecurityId!, isSmall: true),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),
                  OutlinedButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Close'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  static Widget _row(String label, String value, {bool isBold = false, Color? color, bool isSmall = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Flexible(
            flex: 2,
            child: Text(
              label,
              style: TextStyle(
                color: AppTheme.textSecondary,
                fontSize: isSmall ? 11 : 13,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Flexible(
            flex: 3,
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                color: color ?? AppTheme.textPrimary,
                fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
                fontSize: isSmall ? 11 : 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Anchor Review Modal
  void _showAnchorSignModal(BuildContext context, Invoice inv) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: AppTheme.surfaceDark,
          title: const Text('Tripartite Notice of Assignment (NOA)'),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Pursuant to Section 8 of the Factoring Regulation Act 2011, this Notice assigns all rights and receivables of invoice #${inv.invoiceNumber} to the designated Virtual Escrow Account.',
                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceCard,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    children: [
                      _row('Invoice Value', '₹${inv.totalAmount.toStringAsFixed(0)}'),
                      _row('Anchor Commitment', 'Pay to Escrow on Maturity'),
                      _row('Due Date', DateFormat('dd MMM yyyy').format(inv.dueDate)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () async {
                Navigator.pop(ctx);
                final appState = Provider.of<AppState>(context, listen: false);
                await appState.rejectAnchorNOA(inv.id, reason: 'Goods inspection discrepancy');
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Invoice disputed and rejected.')),
                  );
                }
              },
              child: const Text('Dispute / Reject', style: TextStyle(color: Colors.redAccent)),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                final appState = Provider.of<AppState>(context, listen: false);
                await appState.confirmAnchorNOA(inv.id);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('NOA Digitally Signed! Invoice moved to LISTED.')),
                  );
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.indigoAccent),
              child: const Text('Sign & Approve NOA'),
            ),
          ],
        );
      },
    );
  }

  // Investor Fund Modal
  void _showInvestorFundModal(BuildContext context, Invoice inv) {
    showDialog(
      context: context,
      builder: (ctx) {
        final isNetDisbursed = inv.pricingModel != 'GROSS_ADVANCE';
        final deployAmount = isNetDisbursed ? inv.upfrontDisbursedAmount : (inv.totalAmount * 0.85);

        return AlertDialog(
          backgroundColor: AppTheme.surfaceDark,
          title: const Text('Fund Invoice via Escrow'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Deploy capital directly from your Virtual Escrow account to the MSME Seller bank account. A CERSAI charge will be officially registered upon disbursement.',
                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceCard,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  children: [
                    _row('Invoice', inv.invoiceNumber),
                    _row('Anchor Rating', inv.anchor?.creditRating ?? 'AAA'),
                    _row('Investor Net Deploy', '₹${deployAmount.toStringAsFixed(0)}', isBold: true, color: AppTheme.primaryLight),
                    _row('Pricing Model', inv.pricingModel),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                final appState = Provider.of<AppState>(context, listen: false);
                final invId = appState.investors.isNotEmpty ? appState.investors.first.id : 'investor-1';
                await appState.fundInvoice(inv.id, investorId: invId);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Disbursed ₹8,40,000 to MSME Seller! CERSAI Charge Registered.')),
                  );
                }
              },
              child: const Text('Confirm Disbursement'),
            ),
          ],
        );
      },
    );
  }

  // Settle Waterfall Modal
  void _showSettleWaterfallModal(BuildContext context, Invoice inv) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: AppTheme.surfaceDark,
          title: const Text('Execute Escrow Waterfall Settlement'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Incoming ₹10,00,000 full maturity payment from Corporate Anchor will be split strictly according to the statutory waterfall priority:',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceCard,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  children: [
                    _row('Priority #1 (Investor)', 'Principal + Yield (~₹8.60L - ₹8.73L)', color: Colors.blueAccent),
                    _row('Priority #2 (Platform)', 'Upfront Fee + Spread (~₹10k - ₹12k)', color: AppTheme.accentGold),
                    _row('Priority #3 (MSME)', 'Margin Release (~₹1.16L - ₹1.27L)', color: AppTheme.primaryLight, isBold: true),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                final appState = Provider.of<AppState>(context, listen: false);
                await appState.settleInvoice(inv.id);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Settlement Complete! Waterfall distributed down to the paisa.')),
                  );
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accentGold, foregroundColor: Colors.black),
              child: const Text('Execute Waterfall'),
            ),
          ],
        );
      },
    );
  }

  // Phase 4: Seller Offer Review & Aadhaar e-Sign Modal
  void _showSellerESignOfferModal(BuildContext context, Invoice inv) {
    final otpController = TextEditingController(text: '682910');
    bool isAgreed = true;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.88,
          ),
          child: StatefulBuilder(
            builder: (context, setModalState) {
              final advanceAmount = inv.pricingModel == 'NET_DISBURSED'
                  ? inv.upfrontDisbursedAmount
                  : (inv.totalAmount * 0.85);

              return Padding(
                padding: EdgeInsets.only(
                  left: 20,
                  right: 20,
                  top: 20,
                  bottom: MediaQuery.of(context).viewInsets.bottom + 20,
                ),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: AppTheme.borderDark,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Row(
                        children: [
                          Icon(Icons.verified, color: AppTheme.primary, size: 22),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Phase 4: Factoring Offer & Aadhaar e-Sign',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Tata Motors Ltd has confirmed NOA. Review final financing terms and e-sign via Aadhaar OTP to disburse advance cash.',
                        style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                      ),
                      const SizedBox(height: 16),

                      // Offer Breakdown Card
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppTheme.surfaceCard,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppTheme.borderDark),
                        ),
                        child: Column(
                          children: [
                            _row('Invoice Value', _formatCurrency(inv.totalAmount)),
                            _row('Corporate Anchor', inv.anchor?.corporateName ?? 'Tata Motors Ltd'),
                            _row('Anchor Rating', inv.anchor?.creditRating ?? 'AAA (Crisil)'),
                            _row('Tenure', '${inv.tenureDays} Days (Maturity Repayment)'),
                            _row('Discounting Rate', '${inv.discountRatePa}% p.a.'),
                            const Divider(color: AppTheme.borderDark, height: 16),
                            _row('Escrow Margin Retained (15%)', _formatCurrency(inv.marginHeldAmount), color: Colors.amber),
                            _row('Platform Listing Fee (1%)', _formatCurrency(inv.totalAmount * 0.01), color: Colors.blueAccent),
                            _row('NET CASH ADVANCE (84%)', _formatCurrency(advanceAmount), isBold: true, color: AppTheme.primaryLight),
                          ],
                        ),
                      ),

                      const SizedBox(height: 16),

                      // Aadhaar e-Sign Box
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0B192C),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.blue.withValues(alpha: 0.4)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    'Aadhaar e-Sign (Digio / NSDL)',
                                    style: TextStyle(
                                      color: Colors.blueAccent,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                SizedBox(width: 8),
                                Icon(Icons.fingerprint, color: Colors.blueAccent, size: 20),
                              ],
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'UIDAI Aadhaar e-Sign (Authorized Signatory Authentication)',
                              style: TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(
                                  child: TextFormField(
                                    controller: otpController,
                                    keyboardType: TextInputType.number,
                                    decoration: InputDecoration(
                                      labelText: 'Enter 6-Digit Aadhaar OTP',
                                      labelStyle: const TextStyle(fontSize: 11),
                                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                ElevatedButton(
                                  onPressed: () {
                                    setModalState(() {
                                      otpController.text = '682910';
                                    });
                                  },
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.blueGrey,
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                                  ),
                                  child: const Text('Autofill', style: TextStyle(fontSize: 11)),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 12),

                      // Legal agreement checkbox
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Checkbox(
                            value: isAgreed,
                            activeColor: AppTheme.primary,
                            onChanged: (v) => setModalState(() => isAgreed = v ?? true),
                          ),
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                'I hereby irrevocably assign receivables under Invoice #${inv.invoiceNumber} to Escrow Trustee pursuant to Sec 8 Factoring Regulation Act 2011.',
                                style: const TextStyle(color: AppTheme.textMuted, fontSize: 10),
                              ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 14),

                      // Submit Action
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: isAgreed
                              ? () async {
                                  Navigator.pop(ctx);
                                  final appState = Provider.of<AppState>(context, listen: false);
                                  final investorId = appState.investors.isNotEmpty
                                      ? appState.investors.first.id
                                      : 'investor-1';

                                  final success = await appState.fundInvoice(inv.id, investorId: investorId);

                                  if (context.mounted) {
                                    if (success) {
                                      showDialog(
                                        context: context,
                                        builder: (alertCtx) => AlertDialog(
                                          backgroundColor: AppTheme.surfaceDark,
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                          title: const Row(
                                            children: [
                                              Icon(Icons.check_circle, color: AppTheme.primary, size: 24),
                                              SizedBox(width: 8),
                                              Expanded(
                                                child: Text(
                                                  'Cash Disbursed!',
                                                  style: TextStyle(color: Colors.white, fontSize: 16),
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ),
                                            ],
                                          ),
                                          content: SingleChildScrollView(
                                            child: Column(
                                              mainAxisSize: MainAxisSize.min,
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  '₹${advanceAmount.toStringAsFixed(0)} successfully wired to your HDFC Bank account (••••5678) directly from Virtual Escrow.',
                                                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                                                ),
                                                const SizedBox(height: 12),
                                                Container(
                                                  padding: const EdgeInsets.all(10),
                                                  decoration: BoxDecoration(
                                                    color: AppTheme.surfaceCard,
                                                    borderRadius: BorderRadius.circular(8),
                                                  ),
                                                  child: Column(
                                                    children: [
                                                      _row('CERSAI Filing', 'REGISTERED (National Charge Active)'),
                                                      _row('Time Elapsed', 'Instant (Under 2 minutes)'),
                                                      _row('Status', 'FUNDED', color: AppTheme.primaryLight, isBold: true),
                                                    ],
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          actions: [
                                            ElevatedButton(
                                              onPressed: () => Navigator.pop(alertCtx),
                                              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
                                              child: const Text('Done'),
                                            ),
                                          ],
                                        ),
                                      );
                                    } else {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text(appState.errorMessage ?? 'Disbursement failed.')),
                                      );
                                    }
                                  }
                                }
                              : null,
                          icon: const Icon(Icons.bolt, size: 18),
                          label: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text('e-Sign & Receive ${_formatCurrency(advanceAmount)} Cash'),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primary,
                            foregroundColor: AppTheme.surfaceDark,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            elevation: 4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}
