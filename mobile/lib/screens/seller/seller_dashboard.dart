import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/invoice_card.dart';
import 'upload_invoice_sheet.dart';

class SellerDashboard extends StatelessWidget {
  const SellerDashboard({super.key});

  String _formatCurrency(double amount) {
    final format = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return format.format(amount);
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context);
    final seller = appState.currentSeller ?? (appState.sellers.isNotEmpty ? appState.sellers.first : null);
    final invoices = appState.invoices;

    final totalDisbursed = appState.totalDisbursed;
    final totalMargin = invoices.where((i) => i.status == 'FUNDED').fold(0.0, (s, i) => s + i.marginHeldAmount);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: appState.loadData,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Phase 4 Alert Banner if any invoice is approved and waiting for e-Sign
            if (invoices.isNotEmpty && invoices.any((i) => i.status == 'LISTED')) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF2E1C0C), Color(0xFF1E293B)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.amber.withValues(alpha: 0.6)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.flash_on, color: Colors.amber, size: 24),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Phase 4: Offer Ready for e-Sign!',
                            style: TextStyle(
                              color: Colors.amber,
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Tata Motors signed NOA. Tap "Review Terms & e-Sign" on the invoice card below to receive 84% instant cash via Aadhaar OTP.',
                            style: TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Phase 1: One-Time Onboarding & Sanctioned Limit Card
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0F2B1D), Color(0xFF0F172A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.primary.withValues(alpha: 0.5)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Expanded(
                        child: Row(
                          children: [
                            Icon(Icons.verified_user, color: AppTheme.primary, size: 18),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'PHASE 1: ONBOARDING & KYC',
                                style: TextStyle(
                                  color: AppTheme.primaryLight,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 11,
                                  letterSpacing: 0.5,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.primary.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Text(
                          'LIMIT SANCTIONED',
                          style: TextStyle(color: AppTheme.primary, fontSize: 9, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Sanctioned Revolving Limit',
                              style: TextStyle(color: AppTheme.textMuted, fontSize: 11),
                              overflow: TextOverflow.ellipsis,
                            ),
                            SizedBox(height: 2),
                            Text(
                              '₹50,00,000',
                              style: TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton.icon(
                        onPressed: () => _showKYCDetailsModal(context, seller),
                        icon: const Icon(Icons.description, size: 13),
                        label: const Text('View KYC & Mandate', style: TextStyle(fontSize: 10)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppTheme.primaryLight,
                          side: BorderSide(color: AppTheme.primary.withValues(alpha: 0.6)),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Divider(color: AppTheme.borderDark, height: 1),
                  const SizedBox(height: 8),
                  const Wrap(
                    spacing: 12,
                    runSpacing: 4,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.check_circle, color: AppTheme.primary, size: 12),
                          SizedBox(width: 4),
                          Text('GST Active', style: TextStyle(color: AppTheme.textSecondary, fontSize: 10)),
                        ],
                      ),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.check_circle, color: AppTheme.primary, size: 12),
                          SizedBox(width: 4),
                          Text('Account Aggregator 785', style: TextStyle(color: AppTheme.textSecondary, fontSize: 10)),
                        ],
                      ),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.check_circle, color: AppTheme.primary, size: 12),
                          SizedBox(width: 4),
                          Text('e-NACH Active', style: TextStyle(color: AppTheme.textSecondary, fontSize: 10)),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // MSME Profile Header Card
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppTheme.borderDark),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Row(
                          children: [
                            CircleAvatar(
                              backgroundColor: AppTheme.primary.withValues(alpha: 0.15),
                              child: const Icon(Icons.factory, color: AppTheme.primary, size: 20),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    seller?.legalName ?? (appState.entityName ?? 'Verified Business Entity'),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                      color: AppTheme.textPrimary,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    'GSTIN: ${seller?.gstin ?? "27AABCU9603R1ZX"}',
                                    style: const TextStyle(
                                      color: AppTheme.textMuted,
                                      fontSize: 11,
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
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.primary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          seller?.kycStatus ?? 'VERIFIED',
                          style: const TextStyle(
                            color: AppTheme.primary,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Divider(color: AppTheme.borderDark, height: 1),
                  const SizedBox(height: 12),

                  // e-NACH Mandate Status Pill
                  Row(
                    children: [
                      const Icon(Icons.check_circle_outline, color: AppTheme.primary, size: 14),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'e-NACH Mandate: ${seller?.enachMandateStatus ?? "ACTIVE"} (${seller?.enachMandateId ?? "MND-NPCI-882910"})',
                          style: const TextStyle(
                            color: AppTheme.textSecondary,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Cash Metrics Row
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceCard,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.borderDark),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'CASH DISBURSED',
                          style: TextStyle(color: AppTheme.textMuted, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            _formatCurrency(totalDisbursed),
                            style: const TextStyle(
                              color: AppTheme.primaryLight,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          '84% Net Upfront',
                          style: TextStyle(color: AppTheme.textMuted, fontSize: 10),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceCard,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.borderDark),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'MARGIN IN ESCROW',
                          style: TextStyle(color: AppTheme.textMuted, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            _formatCurrency(totalMargin),
                            style: const TextStyle(
                              color: Colors.amber,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          '15% on Maturity',
                          style: TextStyle(color: AppTheme.textMuted, fontSize: 10),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),

            // Upload Button Banner
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppTheme.primary.withOpacity(0.2), AppTheme.surfaceCard],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.primary.withOpacity(0.4)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'Need Immediate Liquidity?',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Discount approved invoices against Tata Motors & tier-1 anchors in minutes.',
                          style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton.icon(
                    onPressed: () {
                      showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) => const UploadInvoiceSheet(),
                      );
                    },
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Upload'),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Invoices Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'My Invoices (${invoices.length})',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                TextButton.icon(
                  onPressed: appState.loadData,
                  icon: const Icon(Icons.refresh, size: 14),
                  label: const Text('Refresh', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),

            const SizedBox(height: 8),

            // Invoices List
            if (invoices.isEmpty)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: Text(
                    'No invoices uploaded yet. Tap "Upload" above to get started.',
                    style: TextStyle(color: AppTheme.textMuted),
                    textAlign: TextAlign.center,
                  ),
                ),
              )
            else
              ...invoices.map((inv) => InvoiceCard(invoice: inv)),
          ],
        ),
      ),
    );
  }

  // Phase 1: Onboarding & e-NACH Mandate Details Modal
  void _showKYCDetailsModal(BuildContext context, dynamic seller) {
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
          child: Padding(
            padding: const EdgeInsets.all(20),
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
                      Icon(Icons.shield_outlined, color: AppTheme.primary, size: 24),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Phase 1: One-Time Onboarding & KYC',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textPrimary,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Complete regulatory compliance verified under RBI Digital Lending Guidelines and NPCI e-NACH mandate registry.',
                    style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceCard,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppTheme.borderDark),
                    ),
                    child: Column(
                      children: [
                        _infoRow('Legal Entity', seller?.legalName ?? (appState.entityName ?? 'Verified Entity')),
                        _infoRow('GSTIN (NIC Verified)', seller?.gstin ?? 'Verified on GST Portal'),
                        _infoRow('PAN (NSDL Match)', seller?.pan ?? (seller != null && seller.gstin.length >= 12 ? seller.gstin.substring(2, 12) : 'Verified')),
                        _infoRow('Settlement Bank A/C', seller != null && seller.bankAccountNo.isNotEmpty ? '${seller.bankAccountNo} (${seller.bankIfsc})' : 'Verified Escrow Account'),
                        _infoRow('Account Aggregator Score', 'Audited via RBI AA Framework'),
                        _infoRow('Sanctioned Credit Limit', '₹50,00,000 (Revolving)', isHighlight: true),
                        _infoRow('NPCI e-NACH Mandate', '${seller?.enachMandateId ?? "MND-NPCI-882910"} [ACTIVE]', isHighlight: true),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(ctx),
                      style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary, foregroundColor: AppTheme.surfaceDark),
                      child: const Text('Close'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _infoRow(String label, String value, {bool isHighlight = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Flexible(
            flex: 2,
            child: Text(label, style: const TextStyle(color: AppTheme.textMuted, fontSize: 11)),
          ),
          const SizedBox(width: 8),
          Flexible(
            flex: 3,
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                color: isHighlight ? AppTheme.primaryLight : AppTheme.textPrimary,
                fontWeight: isHighlight ? FontWeight.bold : FontWeight.w500,
                fontSize: 11,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
