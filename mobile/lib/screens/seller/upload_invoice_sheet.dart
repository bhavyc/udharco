import 'dart:math';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';

class UploadInvoiceSheet extends StatefulWidget {
  const UploadInvoiceSheet({super.key});

  @override
  State<UploadInvoiceSheet> createState() => _UploadInvoiceSheetState();
}

class _UploadInvoiceSheetState extends State<UploadInvoiceSheet> {
  final _formKey = GlobalKey<FormState>();
  String? _selectedAnchorId;
  final _invoiceNumCtrl = TextEditingController(text: 'INV/2026/1088');
  final _amountCtrl = TextEditingController(text: '1000000');
  final _irnCtrl = TextEditingController(
    text: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
  );
  final _ewayCtrl = TextEditingController(text: '281098442109');
  final _poCtrl = TextEditingController(text: 'PO-TM-2026-8812');

  DateTime _dueDate = DateTime.now().add(const Duration(days: 90));
  String _pricingModel = 'NET_DISBURSED';
  String _recourseType = 'RECOURSE';

  double get _amount => double.tryParse(_amountCtrl.text.replaceAll(',', '')) ?? 0.0;
  double get _marginHold => _amount * 0.15;
  double get _platformFee => _amount * 0.01;
  double get _netDisbursed => _amount * 0.84;

  void _generateRandomIRN() {
    const chars = '0123456789abcdef';
    final random = Random();
    final irn = List.generate(64, (_) => chars[random.nextInt(chars.length)]).join();
    setState(() {
      _irnCtrl.text = irn;
    });
  }

  String _formatCurrency(double amount) {
    final format = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return format.format(amount);
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context);
    final sellers = appState.sellers;
    final anchors = appState.anchors;

    if (_selectedAnchorId == null && anchors.isNotEmpty) {
      _selectedAnchorId = anchors.first.id;
    }

    return ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.88,
      ),
      child: Container(
        decoration: const BoxDecoration(
          color: AppTheme.surfaceDark,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
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
                  Icon(Icons.cloud_upload_outlined, color: AppTheme.primary, size: 24),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Upload & Discount B2B Invoice',
                      style: TextStyle(
                        fontSize: 18,
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
                'Upload verified GST e-invoice to unlock up to 84% advance capital upon corporate buyer confirmation.',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 20),

              // Anchor Dropdown
              const Text('SELECT CORPORATE BUYER (ANCHOR)', style: _labelStyle),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                value: _selectedAnchorId,
                isExpanded: true,
                dropdownColor: AppTheme.surfaceCard,
                decoration: const InputDecoration(prefixIcon: Icon(Icons.business)),
                items: anchors.map((a) {
                  return DropdownMenuItem(
                    value: a.id,
                    child: Text(
                      '${a.corporateName} (${a.creditRating})',
                      overflow: TextOverflow.ellipsis,
                    ),
                  );
                }).toList(),
                onChanged: (val) => setState(() => _selectedAnchorId = val),
              ),
              const SizedBox(height: 14),

              // Invoice Number & Amount
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('INVOICE NUMBER', style: _labelStyle),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _invoiceNumCtrl,
                          decoration: const InputDecoration(hintText: 'INV/2026/001'),
                          validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('INVOICE AMOUNT (₹)', style: _labelStyle),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _amountCtrl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(prefixText: '₹ '),
                          onChanged: (_) => setState(() {}),
                          validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Due Date & Tenure
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('MATURITY DUE DATE', style: _labelStyle),
                        const SizedBox(height: 6),
                        OutlinedButton.icon(
                          onPressed: () async {
                            final picked = await showDatePicker(
                              context: context,
                              initialDate: _dueDate,
                              firstDate: DateTime.now().add(const Duration(days: 15)),
                              lastDate: DateTime.now().add(const Duration(days: 180)),
                            );
                            if (picked != null) {
                              setState(() => _dueDate = picked);
                            }
                          },
                          icon: const Icon(Icons.calendar_today, size: 16),
                          label: Text(DateFormat('dd MMM yyyy').format(_dueDate)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('PRICING MODEL', style: _labelStyle),
                        const SizedBox(height: 6),
                        DropdownButtonFormField<String>(
                          value: _pricingModel,
                          isExpanded: true,
                          dropdownColor: AppTheme.surfaceCard,
                          items: const [
                            DropdownMenuItem(value: 'NET_DISBURSED', child: Text('Net Disbursed (A)', overflow: TextOverflow.ellipsis)),
                            DropdownMenuItem(value: 'GROSS_ADVANCE', child: Text('Gross Advance (B)', overflow: TextOverflow.ellipsis)),
                          ],
                          onChanged: (val) => setState(() => _pricingModel = val ?? 'NET_DISBURSED'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // 64-char IRN
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Flexible(
                    child: Text('GSTN 64-CHAR IRN HASH', style: _labelStyle, overflow: TextOverflow.ellipsis),
                  ),
                  TextButton.icon(
                    onPressed: _generateRandomIRN,
                    icon: const Icon(Icons.refresh, size: 14),
                    label: const Text('Auto-Generate', style: TextStyle(fontSize: 11)),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              TextFormField(
                controller: _irnCtrl,
                style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.fingerprint),
                  hintText: '64-character hexadecimal IRN hash',
                ),
                validator: (v) {
                  if (v == null || v.length != 64) {
                    return 'IRN must be exactly 64 hexadecimal characters';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // 85/15 Instant Real-time Calculation Box
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceCard,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.primary.withOpacity(0.3)),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Flexible(
                          child: Text(
                            'INSTANT CASH DISBURSED (84%)',
                            style: TextStyle(
                              color: AppTheme.primaryLight,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            _formatCurrency(_netDisbursed),
                            style: const TextStyle(
                              color: AppTheme.primaryLight,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Flexible(
                          child: Text('Margin Hold Retained (15%):', style: TextStyle(color: AppTheme.textMuted, fontSize: 12), overflow: TextOverflow.ellipsis),
                        ),
                        const SizedBox(width: 8),
                        Text(_formatCurrency(_marginHold), style: const TextStyle(color: Colors.amber, fontSize: 12)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Flexible(
                          child: Text('Platform Listing Fee (1%):', style: TextStyle(color: AppTheme.textMuted, fontSize: 12), overflow: TextOverflow.ellipsis),
                        ),
                        const SizedBox(width: 8),
                        Text(_formatCurrency(_platformFee), style: const TextStyle(color: Colors.blueAccent, fontSize: 12)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Submit Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    if (_formKey.currentState?.validate() ?? false) {
                      final sellerId = sellers.isNotEmpty ? sellers.first.id : 'seller-1';
                      final anchorId = _selectedAnchorId ?? 'anchor-1';

                      final success = await appState.createInvoice(
                        sellerId: sellerId,
                        anchorId: anchorId,
                        invoiceNumber: _invoiceNumCtrl.text,
                        totalAmount: _amount,
                        dueDate: _dueDate.toIso8601String(),
                        irn: _irnCtrl.text,
                        pricingModel: _pricingModel,
                        recourseType: _recourseType,
                        ewayBillNo: _ewayCtrl.text,
                        poNumber: _poCtrl.text,
                      );

                      if (context.mounted) {
                        Navigator.pop(context);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            backgroundColor: success ? AppTheme.primaryDark : Colors.red,
                            content: Text(
                              success
                                  ? 'Invoice uploaded successfully with IRN protection!'
                                  : 'Failed to upload invoice.',
                            ),
                          ),
                        );
                      }
                    }
                  },
                  icon: const Icon(Icons.check_circle_outline),
                  label: const Text('Confirm & Upload for Discounting'),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

  static const _labelStyle = TextStyle(
    color: AppTheme.textMuted,
    fontSize: 11,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.5,
  );
}
