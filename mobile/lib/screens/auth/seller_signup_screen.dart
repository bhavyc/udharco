import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/app_state.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

class SellerSignupScreen extends StatefulWidget {
  final String? initialMobile;
  final String? initialOtp;

  const SellerSignupScreen({
    super.key,
    this.initialMobile,
    this.initialOtp,
  });

  @override
  State<SellerSignupScreen> createState() => _SellerSignupScreenState();
}

class _SellerSignupScreenState extends State<SellerSignupScreen> {
  int _currentStep = 1;
  bool _isLoading = false;
  String? _errorMessage;

  // Step 1: Mobile & OTP
  late final TextEditingController _mobileController;
  late final TextEditingController _otpController;
  bool _otpSent = false;
  String? _demoOtpNotice;

  // Step 2: GSTIN & PAN
  final _gstinController = TextEditingController();
  final _panController = TextEditingController();
  final _legalNameController = TextEditingController();

  // Step 3: Penny Drop Bank
  final _bankAccountController = TextEditingController();
  final _bankIfscController = TextEditingController();

  // Step 4: e-NACH Mandate
  final _mandateIdController = TextEditingController();

  // Step 5 & 6: Dynamic Scoring & Limits from backend
  int _aaScore = 780;
  String _sanctionLimitFormatted = '₹50,00,000';
  String _annualSalesFormatted = 'Audited via GST';
  String _monthlyCashflowFormatted = 'Audited via AA';
  String _ratingTier = 'Prime Low Risk';

  @override
  void initState() {
    super.initState();
    _mobileController = TextEditingController(text: widget.initialMobile ?? '');
    _otpController = TextEditingController(text: widget.initialOtp ?? '');
    if (widget.initialOtp != null && widget.initialOtp!.isNotEmpty) {
      _otpSent = true;
      _currentStep = 2; // Mobile was verified in login screen
    }
  }

  @override
  void dispose() {
    _mobileController.dispose();
    _otpController.dispose();
    _gstinController.dispose();
    _panController.dispose();
    _legalNameController.dispose();
    _bankAccountController.dispose();
    _bankIfscController.dispose();
    _mandateIdController.dispose();
    super.dispose();
  }

  // Step 1: Request OTP
  Future<void> _handleRequestOtp() async {
    final mobile = _mobileController.text.trim();
    if (mobile.length != 10) {
      setState(() => _errorMessage = 'Enter a valid 10-digit mobile number');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final res = await ApiService.requestSellerOtp(mobile);
    setState(() {
      _isLoading = false;
      if (res['success'] == true) {
        _otpSent = true;
        _demoOtpNotice = res['otp']?.toString();
        if (_demoOtpNotice != null) {
          _otpController.text = _demoOtpNotice!;
        }
      } else {
        _errorMessage = res['error'] ?? 'Failed to send OTP';
      }
    });
  }

  // Step 1: Verify OTP
  Future<void> _handleVerifyOtp() async {
    final code = _otpController.text.trim();
    if (code.length != 6) {
      setState(() => _errorMessage = 'Enter the 6-digit OTP code');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final res = await ApiService.verifySellerOtp(_mobileController.text.trim(), code);
    setState(() {
      _isLoading = false;
      if (res['success'] == true) {
        _currentStep = 2;
      } else {
        _errorMessage = res['error'] ?? 'OTP verification failed';
      }
    });
  }

  // Step 2: Validate GSTIN & Auto-Extract PAN via Backend
  Future<void> _handleVerifyGst() async {
    final gstin = _gstinController.text.trim().toUpperCase();
    if (gstin.length != 15) {
      setState(() => _errorMessage = 'GSTIN must be exactly 15 characters');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final res = await ApiService.gstLookup(gstin);
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      if (res['success'] == true) {
        _legalNameController.text = res['legalName'] ?? res['tradeName'] ?? '';
        _panController.text = res['pan'] ?? (gstin.length >= 12 ? gstin.substring(2, 12) : '');
        _currentStep = 3;
      } else {
        _errorMessage = res['error'] ?? 'GSTIN lookup failed';
      }
    });
  }

  // Step 3: Run Penny Drop Verification via Backend
  Future<void> _handlePennyDrop() async {
    final acc = _bankAccountController.text.trim();
    final ifsc = _bankIfscController.text.trim().toUpperCase();
    if (acc.isEmpty || ifsc.isEmpty) {
      setState(() => _errorMessage = 'Enter bank account number and IFSC code');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final res = await ApiService.bankLookup(
      accountNumber: acc,
      ifsc: ifsc,
      legalName: _legalNameController.text.trim(),
    );
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      if (res['success'] == true) {
        _currentStep = 4;
      } else {
        _errorMessage = res['error'] ?? 'Penny drop verification failed';
      }
    });
  }

  // Step 4: Authorize e-NACH Mandate via Backend
  Future<void> _handleAuthorizeMandate() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final res = await ApiService.enachMandate(
      mobile: _mobileController.text.trim(),
      bankAccountNo: _bankAccountController.text.trim(),
      bankIfsc: _bankIfscController.text.trim().toUpperCase(),
      legalName: _legalNameController.text.trim(),
    );
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      if (res['success'] == true) {
        _mandateIdController.text = res['mandateId'] ?? 'MND-NPCI-${DateTime.now().millisecondsSinceEpoch}';
        _currentStep = 5;
      } else {
        _errorMessage = res['error'] ?? 'e-NACH registration failed';
      }
    });
  }

  // Step 5: Run Account Aggregator (AA) Scoring via Backend
  Future<void> _handleRunAaScoring() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final res = await ApiService.creditScore(
      gstin: _gstinController.text.trim().toUpperCase(),
      pan: _panController.text.trim().toUpperCase(),
      legalName: _legalNameController.text.trim(),
      mobile: _mobileController.text.trim(),
    );
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      if (res['success'] == true) {
        _aaScore = res['creditScore'] ?? 780;
        _sanctionLimitFormatted = res['sanctionedLimitFormatted'] ?? '₹50,00,000';
        _annualSalesFormatted = res['annualVerifiedSalesFormatted'] ?? 'Audited via GST';
        _monthlyCashflowFormatted = res['monthlyOperatingCashflowFormatted'] ?? 'Audited via AA';
        _ratingTier = res['ratingTier'] ?? 'Prime Low Risk';
        _currentStep = 6;
      } else {
        _errorMessage = res['error'] ?? 'Credit scoring failed';
      }
    });
  }

  // Step 6: Finalize Signup & Launch Dashboard
  Future<void> _handleCompleteSignup() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final appState = Provider.of<AppState>(context, listen: false);
    final success = await appState.completeSellerSignup(
      mobile: _mobileController.text.trim(),
      legalName: _legalNameController.text.trim(),
      gstin: _gstinController.text.trim().toUpperCase(),
      pan: _panController.text.trim().toUpperCase(),
      bankAccountNo: _bankAccountController.text.trim(),
      bankIfsc: _bankIfscController.text.trim().toUpperCase(),
      enachMandateId: _mandateIdController.text.trim(),
    );

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (success) {
      // Pop the signup wizard so the HomeScreen shows the fresh dashboard
      Navigator.of(context).popUntil((route) => route.isFirst);
    } else {
      setState(() {
        _errorMessage = appState.errorMessage ?? 'Failed to finalize signup';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        titleSpacing: 8,
        title: const Text(
          'MSME Onboarding & KYC',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (_currentStep > 1) {
              setState(() => _currentStep--);
            } else {
              Navigator.of(context).pop();
            }
          },
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Step Progress Bar
            _buildStepIndicator(),

            if (_errorMessage != null)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.redAccent.withValues(alpha: 0.5)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.redAccent, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(color: Colors.redAccent, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),

            // Step Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: _buildCurrentStepContent(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepIndicator() {
    final stepTitles = ['Mobile', 'GSTIN', 'Bank', 'e-NACH', 'Score', 'Sanction'];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: AppTheme.surfaceDark,
        border: Border(bottom: BorderSide(color: AppTheme.borderDark)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(6, (index) {
          final stepNum = index + 1;
          final isCompleted = _currentStep > stepNum;
          final isCurrent = _currentStep == stepNum;

          return Column(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isCompleted
                      ? AppTheme.primary
                      : isCurrent
                          ? AppTheme.primary.withValues(alpha: 0.25)
                          : AppTheme.surfaceCard,
                  border: Border.all(
                    color: (isCompleted || isCurrent) ? AppTheme.primary : AppTheme.borderDark,
                    width: isCurrent ? 2 : 1,
                  ),
                ),
                child: Center(
                  child: isCompleted
                      ? const Icon(Icons.check, size: 16, color: Colors.black)
                      : Text(
                          '$stepNum',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: isCurrent ? AppTheme.primary : AppTheme.textMuted,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                stepTitles[index],
                style: TextStyle(
                  fontSize: 10,
                  color: isCurrent ? AppTheme.primary : AppTheme.textMuted,
                  fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ],
          );
        }),
      ),
    );
  }

  Widget _buildCurrentStepContent() {
    switch (_currentStep) {
      case 1:
        return _buildStep1MobileOtp();
      case 2:
        return _buildStep2Gstin();
      case 3:
        return _buildStep3PennyDrop();
      case 4:
        return _buildStep4Enach();
      case 5:
        return _buildStep5AaScoring();
      case 6:
        return _buildStep6SanctionApproved();
      default:
        return const SizedBox.shrink();
    }
  }

  // STEP 1
  Widget _buildStep1MobileOtp() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Step 1: Mobile OTP Verification',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        const SizedBox(height: 4),
        const Text(
          'We will send a 6-digit OTP to authenticate your mobile number.',
          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _mobileController,
          keyboardType: TextInputType.phone,
          maxLength: 10,
          enabled: !_otpSent,
          decoration: const InputDecoration(
            labelText: 'Mobile Number',
            prefixText: '+91 ',
            prefixIcon: Icon(Icons.phone_android),
          ),
        ),
        const SizedBox(height: 12),
        if (!_otpSent) ...[
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _handleRequestOtp,
              child: _isLoading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Send Verification OTP'),
            ),
          ),
        ] else ...[
          if (_demoOtpNotice != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.amber.withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, color: Colors.amber, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Demo Sandbox OTP: $_demoOtpNotice (auto-filled)',
                      style: const TextStyle(color: Colors.amber, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          TextField(
            controller: _otpController,
            keyboardType: TextInputType.number,
            maxLength: 6,
            decoration: const InputDecoration(
              labelText: '6-Digit OTP',
              prefixIcon: Icon(Icons.lock_clock),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _handleVerifyOtp,
              child: _isLoading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Verify & Continue'),
            ),
          ),
          TextButton(
            onPressed: _handleRequestOtp,
            child: const Text('Resend OTP'),
          ),
        ],
      ],
    );
  }

  // STEP 2
  Widget _buildStep2Gstin() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Step 2: Business GSTIN & PAN Auto-Fetch',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        const SizedBox(height: 4),
        const Text(
          'Enter your 15-character GSTIN. We will automatically fetch entity name and PAN from the GST portal.',
          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _gstinController,
          textCapitalization: TextCapitalization.characters,
          maxLength: 15,
          decoration: const InputDecoration(
            labelText: 'GSTIN',
            prefixIcon: Icon(Icons.business),
          ),
          onChanged: (val) {
            if (val.length >= 12) {
              _panController.text = val.substring(2, 12).toUpperCase();
            }
          },
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _panController,
          textCapitalization: TextCapitalization.characters,
          maxLength: 10,
          decoration: const InputDecoration(
            labelText: 'PAN (Auto-Derived)',
            prefixIcon: Icon(Icons.credit_card),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _legalNameController,
          decoration: const InputDecoration(
            labelText: 'Legal Entity Name',
            prefixIcon: Icon(Icons.storefront),
          ),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handleVerifyGst,
            child: _isLoading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Verify GST & Continue'),
          ),
        ),
      ],
    );
  }

  // STEP 3
  Widget _buildStep3PennyDrop() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Step 3: Penny Drop Bank Verification',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        const SizedBox(height: 4),
        const Text(
          'We will deposit ₹1 to verify your primary business account via NPCI IMPS rails.',
          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _bankAccountController,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'Bank Account Number',
            prefixIcon: Icon(Icons.account_balance),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _bankIfscController,
          textCapitalization: TextCapitalization.characters,
          decoration: const InputDecoration(
            labelText: 'IFSC Code',
            prefixIcon: Icon(Icons.pin),
          ),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handlePennyDrop,
            child: _isLoading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Execute ₹1 Penny Drop Verification'),
          ),
        ),
      ],
    );
  }

  // STEP 4
  Widget _buildStep4Enach() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Step 4: e-NACH Mandate Registration',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        const SizedBox(height: 4),
        const Text(
          'NPCI recurring debit mandate for automated recourse recovery. Protects institutional liquidity.',
          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
        ),
        const SizedBox(height: 20),
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
              const Row(
                children: [
                  Icon(Icons.shield_outlined, color: AppTheme.primary, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'NPCI e-NACH Mandate Parameters',
                    style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _buildDetailRow('Mandate ID', _mandateIdController.text),
              _buildDetailRow('Maximum Limit', '₹50,00,000'),
              _buildDetailRow('Frequency', 'As and when presented'),
              _buildDetailRow('Purpose', 'Invoice Discounting Settlement'),
            ],
          ),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handleAuthorizeMandate,
            child: _isLoading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Authorize Mandate via NetBanking / Aadhaar'),
          ),
        ),
      ],
    );
  }

  // STEP 5
  Widget _buildStep5AaScoring() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Step 5: Account Aggregator (AA) Scoring',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        const SizedBox(height: 4),
        const Text(
          'Consents to pull 12 months GST returns (GSTR-1, GSTR-3B) and bank cash flows for dynamic risk appraisal.',
          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
        ),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.surfaceCard,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppTheme.borderDark),
          ),
          child: Column(
            children: [
              const Icon(Icons.analytics_outlined, color: AppTheme.primary, size: 40),
              const SizedBox(height: 8),
              const Text(
                'RBI-Regulated Account Aggregator',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
              ),
              const SizedBox(height: 4),
              const Text(
                'Financial Information Provider (FIP) consent requested.',
                style: TextStyle(color: AppTheme.textMuted, fontSize: 12),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              _buildDetailRow('GST Returns', '12 Months Active Flows'),
              _buildDetailRow('Bank Turnover', '₹3.42 Cr / Annum'),
              _buildDetailRow('Average DSO', '48 Days'),
            ],
          ),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handleRunAaScoring,
            child: _isLoading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Fetch Data & Calculate Credit Score'),
          ),
        ),
      ],
    );
  }

  // STEP 6: Sanction Approved
  Widget _buildStep6SanctionApproved() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF0F2B1D), Color(0xFF0F172A)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppTheme.primary, width: 1.5),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.verified, color: AppTheme.primary, size: 24),
                      SizedBox(width: 8),
                      Text(
                        'SANCTION APPROVED',
                        style: TextStyle(
                          color: AppTheme.primaryLight,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'Score $_aaScore/900',
                      style: const TextStyle(color: AppTheme.primary, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text(
                'Sanctioned Revolving Credit Limit',
                style: TextStyle(color: AppTheme.textMuted, fontSize: 12),
              ),
              const SizedBox(height: 4),
              Text(
                _sanctionLimitFormatted,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 14),
              const Divider(color: AppTheme.borderDark),
              const SizedBox(height: 10),
              _buildDetailRow('Entity', _legalNameController.text),
              _buildDetailRow('GSTIN', _gstinController.text.toUpperCase()),
              _buildDetailRow('e-NACH Mandate', 'ACTIVE (${_mandateIdController.text})'),
              _buildDetailRow('Bank Verification', 'Penny Drop Verified'),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Your account is ready! Your dashboard starts with zero invoices until you upload your first invoice against Tata Motors or other tier-1 buyers.',
          style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handleCompleteSignup,
            child: _isLoading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Access Seller Dashboard'),
          ),
        ),
      ],
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppTheme.textMuted, fontSize: 12)),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
