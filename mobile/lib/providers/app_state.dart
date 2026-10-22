import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/api_service.dart';

enum UserRole { seller, anchor, investor, admin }

class AppState extends ChangeNotifier {
  bool _isAuthenticated = false;
  UserRole _currentRole = UserRole.seller;
  String? _entityId;
  String? _entityName;
  String? _userIdentifier;

  bool _isLoading = false;
  String? _errorMessage;

  List<Invoice> _invoices = [];
  List<Seller> _sellers = [];
  List<Anchor> _anchors = [];
  List<Investor> _investors = [];

  bool get isAuthenticated => _isAuthenticated;
  UserRole get currentRole => _currentRole;
  String? get entityId => _entityId;
  String? get entityName => _entityName;
  String? get userIdentifier => _userIdentifier;

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  List<Invoice> get invoices => _invoices;
  List<Seller> get sellers => _sellers;
  List<Anchor> get anchors => _anchors;
  List<Investor> get investors => _investors;

  Seller? get currentSeller {
    if (_entityId != null) {
      try {
        return _sellers.firstWhere((s) => s.id == _entityId);
      } catch (_) {}
    }
    return _sellers.isNotEmpty ? _sellers.first : null;
  }

  // Computed metrics
  double get totalDisbursed => _invoices
      .where((i) => i.status == 'FUNDED' || i.status == 'SETTLED')
      .fold(0.0, (sum, i) => sum + i.upfrontDisbursedAmount);

  double get totalFundedVolume => _invoices
      .where((i) => i.status == 'FUNDED' || i.status == 'SETTLED')
      .fold(0.0, (sum, i) => sum + i.totalAmount);

  int get pendingAnchorCount => _invoices
      .where((i) => i.status == 'VERIFIED' || i.status == 'UPLOADED')
      .length;

  int get marketplaceListingCount =>
      _invoices.where((i) => i.status == 'LISTED').length;

  AppState() {
    // Zero-trust: Do NOT auto-login as Seller. User must authenticate first.
  }

  // --- AUTHENTICATION FLOWS ---

  // Seller Mobile OTP login
  Future<bool> loginSeller({
    required String mobile,
    required String code,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiService.verifySellerOtp(mobile, code);
      if (res['success'] == true) {
        if (res['needsOnboarding'] == true) {
          _errorMessage = 'NEEDS_ONBOARDING';
          return false;
        }

        _isAuthenticated = true;
        _currentRole = UserRole.seller;
        _userIdentifier = mobile;
        _entityName = res['seller']?['legalName'] ?? (res['seller']?['corporateName'] ?? 'Verified Seller');
        _entityId = res['seller']?['id'] ?? '';

        await loadData();
        return true;
      } else {
        _errorMessage = res['error'] ?? 'OTP verification failed';
        return false;
      }
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Complete 6-Step Seller Signup & KYC
  Future<bool> completeSellerSignup({
    required String mobile,
    required String legalName,
    required String gstin,
    required String pan,
    required String bankAccountNo,
    required String bankIfsc,
    String? enachMandateId,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiService.completeSellerSignup(
        mobile: mobile,
        legalName: legalName,
        gstin: gstin,
        pan: pan,
        bankAccountNo: bankAccountNo,
        bankIfsc: bankIfsc,
        enachMandateId: enachMandateId,
      );

      if (res['success'] == true) {
        final sellerData = res['seller'];
        _isAuthenticated = true;
        _currentRole = UserRole.seller;
        _userIdentifier = mobile;
        _entityName = sellerData?['legalName'] ?? legalName;
        _entityId = sellerData?['id'] ?? 'seller-${DateTime.now().millisecondsSinceEpoch}';

        final newSeller = Seller(
          id: _entityId!,
          legalName: _entityName!,
          gstin: sellerData?['gstin'] ?? gstin,
          pan: pan,
          bankAccountNo: bankAccountNo,
          bankIfsc: bankIfsc,
          kycStatus: 'VERIFIED',
          enachMandateStatus: 'ACTIVE',
          enachMandateId: enachMandateId ?? 'MND-NPCI-882910',
        );

        _sellers = [newSeller, ..._sellers.where((s) => s.id != _entityId)];
        _invoices = []; // Zero data guarantee for new account

        await loadData();
        return true;
      } else {
        _errorMessage = res['error'] ?? 'Signup completion failed';
        return false;
      }
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Corporate Anchor or Investor login
  Future<bool> loginCorporate({
    required String email,
    required String password,
    required UserRole expectedRole,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiService.loginWithCredentials(email, password);
      if (res['success'] == true) {
        _isAuthenticated = true;
        _currentRole = expectedRole;
        _userIdentifier = email;
        _entityId = res['entityId'] ?? (expectedRole == UserRole.anchor ? 'anchor-1' : 'investor-1');
        _entityName = expectedRole == UserRole.anchor ? 'Tata Motors Ltd' : 'Bajaj Finance NBFC';

        await loadData();
        return true;
      } else {
        _errorMessage = res['error'] ?? 'Authentication failed';
        return false;
      }
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Admin login
  Future<bool> loginAdmin({
    required String email,
    required String password,
    String? totpCode,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiService.adminLogin(email, password, totpCode: totpCode);
      if (res['success'] == true) {
        _isAuthenticated = true;
        _currentRole = UserRole.admin;
        _userIdentifier = email;
        _entityName = 'UdharCo Platform SuperAdmin';

        await loadData();
        return true;
      } else {
        _errorMessage = res['error'] ?? 'Admin authentication failed';
        return false;
      }
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Logout
  Future<void> logout() async {
    await ApiService.logout();
    _isAuthenticated = false;
    _entityId = null;
    _entityName = null;
    _userIdentifier = null;
    _invoices = [];
    _sellers = [];
    _anchors = [];
    _investors = [];
    notifyListeners();
  }

  Future<void> loadData() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        ApiService.getInvoices(),
        ApiService.getSellers(),
        ApiService.getAnchors(),
        ApiService.getInvestors(),
      ]);

      _invoices = results[0] as List<Invoice>;
      final fetchedSellers = results[1] as List<Seller>;
      if (_currentRole == UserRole.seller && _entityId != null) {
        final found = fetchedSellers.where((s) => s.id == _entityId).toList();
        if (found.isEmpty && _sellers.isNotEmpty) {
          _sellers = [_sellers.first, ...fetchedSellers];
        } else {
          _sellers = fetchedSellers;
        }
      } else {
        _sellers = fetchedSellers;
      }
      _anchors = results[2] as List<Anchor>;
      _investors = results[3] as List<Investor>;
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createInvoice({
    required String sellerId,
    required String anchorId,
    required String invoiceNumber,
    required double totalAmount,
    required String dueDate,
    required String irn,
    String pricingModel = 'NET_DISBURSED',
    String recourseType = 'RECOURSE',
    String? ewayBillNo,
    String? poNumber,
  }) async {
    _isLoading = true;
    notifyListeners();

    final res = await ApiService.uploadInvoice(
      sellerId: _entityId ?? sellerId,
      anchorId: anchorId,
      invoiceNumber: invoiceNumber,
      totalAmount: totalAmount,
      dueDate: dueDate,
      irn: irn,
      pricingModel: pricingModel,
      recourseType: recourseType,
      ewayBillNo: ewayBillNo,
      poNumber: poNumber,
    );

    if (res['success'] == true) {
      await loadData();
      return true;
    } else {
      _errorMessage = res['error'] ?? res['message'] ?? 'Failed to create invoice';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> confirmAnchorNOA(String invoiceId, {String? notes}) async {
    _isLoading = true;
    notifyListeners();
    final res = await ApiService.anchorConfirm(invoiceId, notes: notes);
    _isLoading = false;
    if (res['success'] == true) {
      await loadData();
      return true;
    }
    _errorMessage = res['error'] ?? 'Anchor confirmation failed';
    notifyListeners();
    return false;
  }

  Future<bool> rejectAnchorNOA(String invoiceId, {required String reason}) async {
    _isLoading = true;
    notifyListeners();
    final res = await ApiService.anchorReject(invoiceId, reason: reason);
    _isLoading = false;
    if (res['success'] == true) {
      await loadData();
      return true;
    }
    _errorMessage = res['error'] ?? 'Dispute rejection failed';
    notifyListeners();
    return false;
  }

  Future<bool> fundInvoice(String invoiceId, {String? investorId}) async {
    _isLoading = true;
    notifyListeners();
    final res = await ApiService.fundInvoice(invoiceId, investorId: _entityId ?? investorId ?? 'investor-1');
    _isLoading = false;
    if (res['success'] == true) {
      await loadData();
      return true;
    }
    _errorMessage = res['error'] ?? res['message'] ?? 'Funding failed';
    notifyListeners();
    return false;
  }

  Future<bool> settleInvoice(String invoiceId, {double? settlementAmount, double? repaymentAmount, bool isDefault = false}) async {
    _isLoading = true;
    notifyListeners();
    final res = await ApiService.settleInvoice(
      invoiceId,
      settlementAmount: settlementAmount ?? repaymentAmount,
    );
    _isLoading = false;
    if (res['success'] == true) {
      await loadData();
      return true;
    }
    _errorMessage = res['error'] ?? 'Waterfall settlement failed';
    notifyListeners();
    return false;
  }

  Future<Map<String, dynamic>> processReminders() async {
    _isLoading = true;
    notifyListeners();
    final res = await ApiService.processAnchorReminders();
    await loadData();
    _isLoading = false;
    notifyListeners();
    return res;
  }
}
