import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/app_state.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import 'seller_signup_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  // Seller Mobile OTP (Empty initial state, no demo hardcoding)
  final _mobileController = TextEditingController();
  final _otpController = TextEditingController();
  bool _otpSent = false;

  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _mobileController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _handleRequestOtp() async {
    final mobile = _mobileController.text.trim();
    if (mobile.length != 10) {
      setState(() => _error = 'Enter a valid 10-digit mobile number');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    final res = await ApiService.requestSellerOtp(mobile);
    setState(() {
      _isSubmitting = false;
      if (res['success'] == true) {
        _otpSent = true;
      } else {
        _error = res['error'] ?? 'Failed to send OTP';
      }
    });
  }

  Future<void> _handleVerifySellerOtp() async {
    final code = _otpController.text.trim();
    if (code.length != 6) {
      setState(() => _error = 'Enter the 6-digit OTP code');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    final res = await ApiService.verifySellerOtp(_mobileController.text.trim(), code);

    if (res['needsOnboarding'] == true) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => SellerSignupScreen(
            initialMobile: _mobileController.text.trim(),
            initialOtp: code,
          ),
        ),
      );
      return;
    }

    if (!mounted) return;
    final appState = Provider.of<AppState>(context, listen: false);
    final success = await appState.loginSeller(
      mobile: _mobileController.text.trim(),
      code: code,
    );

    if (!mounted) return;
    setState(() {
      _isSubmitting = false;
      if (!success) {
        _error = appState.errorMessage ?? 'OTP verification failed';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 28),
              // Logo & App Name
              Center(
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.primary,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.primary.withValues(alpha: 0.3),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.account_balance_wallet,
                        color: Colors.black,
                        size: 32,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'UdharCo',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'MSME INVOICE DISCOUNTING PORTAL',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.2,
                        color: AppTheme.primary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // Compliance Notice
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceCard,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.borderDark),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.shield_outlined, color: AppTheme.primary, size: 18),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Governed under Factoring Regulation Act, 2011. Mobile OTP Authentication required.',
                        style: TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Error Display
              if (_error != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.redAccent.withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Colors.redAccent, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _error!,
                          style: const TextStyle(fontSize: 12, color: Colors.redAccent),
                        ),
                      ),
                    ],
                  ),
                ),

              // SELLER MOBILE OTP AUTHENTICATION
              if (!_otpSent) ...[
                const Text(
                  'Registered Indian Mobile Number',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _mobileController,
                  keyboardType: TextInputType.phone,
                  maxLength: 10,
                  style: const TextStyle(color: Colors.white, fontSize: 15),
                  decoration: InputDecoration(
                    prefixIcon: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                      child: Text('+91', style: TextStyle(color: AppTheme.textSecondary, fontSize: 15)),
                    ),
                    hintText: 'Enter 10-digit number',
                    hintStyle: const TextStyle(color: AppTheme.textMuted),
                    filled: true,
                    fillColor: AppTheme.surfaceDark,
                    counterText: '',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppTheme.borderDark),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppTheme.primary, width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _isSubmitting ? null : _handleRequestOtp,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text('Send OTP via SMS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                            SizedBox(width: 8),
                            Icon(Icons.arrow_forward, size: 18),
                          ],
                        ),
                ),
              ] else ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Enter 6-Digit OTP',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white),
                    ),
                    TextButton(
                      onPressed: () => setState(() {
                        _otpSent = false;
                        _otpController.clear();
                      }),
                      child: const Text('Change Mobile', style: TextStyle(color: AppTheme.primary, fontSize: 12)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _otpController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontSize: 20, letterSpacing: 8, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    hintText: '••••••',
                    hintStyle: const TextStyle(color: AppTheme.textMuted, letterSpacing: 8),
                    filled: true,
                    fillColor: AppTheme.surfaceDark,
                    counterText: '',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppTheme.borderDark),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppTheme.primary, width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _isSubmitting ? null : _handleVerifySellerOtp,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text('Verify & Sign In', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                            SizedBox(width: 8),
                            Icon(Icons.check_circle_outline, size: 18),
                          ],
                        ),
                ),
              ],

              const SizedBox(height: 36),
              const Divider(color: AppTheme.borderDark),
              const SizedBox(height: 16),

              // Signup Navigation Link
              Center(
                child: Column(
                  children: [
                    const Text(
                      'First time on UdharCo?',
                      style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                    ),
                    const SizedBox(height: 6),
                    TextButton.icon(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const SellerSignupScreen()),
                        );
                      },
                      icon: const Icon(Icons.flash_on, color: AppTheme.primary, size: 16),
                      label: const Text(
                        'Complete 6-Step MSME Onboarding & KYC',
                        style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),
              const Center(
                child: Text(
                  'Corporate Anchors & Institutional Investors:\nPlease access the platform via Web Portal.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.textMuted, fontSize: 10, height: 1.4),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
