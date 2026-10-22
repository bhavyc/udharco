import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/invoice_card.dart';
import 'auth/login_screen.dart';
import 'seller/seller_dashboard.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentTabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context);

    // Zero-Trust: If unauthenticated, display LoginScreen
    if (!appState.isAuthenticated) {
      return const LoginScreen();
    }

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 12,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppTheme.primary,
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Icon(Icons.currency_rupee, color: Colors.white, size: 14),
            ),
            const SizedBox(width: 6),
            const Text(
              'UdharCo',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        actions: [
          // Authenticated MSME Entity Badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.surfaceCard,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppTheme.primary.withValues(alpha: 0.4),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.storefront,
                  size: 12,
                  color: AppTheme.primary,
                ),
                const SizedBox(width: 4),
                Text(
                  appState.entityName ?? 'MSME Seller',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primary,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Sign Out',
            padding: const EdgeInsets.symmetric(horizontal: 8),
            constraints: const BoxConstraints(),
            onPressed: () => appState.logout(),
            icon: const Icon(Icons.logout, size: 18, color: Colors.redAccent),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: _buildBody(appState),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentTabIndex,
        backgroundColor: AppTheme.surfaceDark,
        indicatorColor: AppTheme.primary.withValues(alpha: 0.2),
        onDestinationSelected: (index) => setState(() => _currentTabIndex = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard, color: AppTheme.primary),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long, color: AppTheme.primary),
            label: 'My Invoices',
          ),
          NavigationDestination(
            icon: Icon(Icons.verified_outlined),
            selectedIcon: Icon(Icons.verified, color: AppTheme.primary),
            label: 'Factoring Shield',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings, color: AppTheme.primary),
            label: 'Settings',
          ),
        ],
      ),
    );
  }

  Widget _buildBody(AppState appState) {
    if (_currentTabIndex == 0) {
      return const SellerDashboard();
    } else if (_currentTabIndex == 1) {
      return _buildMyInvoicesTab(appState);
    } else if (_currentTabIndex == 2) {
      return _buildFintechShieldTab();
    } else {
      return _buildSettingsTab();
    }
  }

  Widget _buildMyInvoicesTab(AppState appState) {
    final invoices = appState.invoices;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                'My Invoices (${invoices.length})',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            IconButton(
              icon: const Icon(Icons.refresh, size: 18, color: AppTheme.primary),
              onPressed: appState.loadData,
              tooltip: 'Refresh',
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (invoices.isEmpty)
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Column(
                children: [
                  Icon(Icons.receipt_long_outlined, size: 48, color: AppTheme.textMuted.withValues(alpha: 0.5)),
                  const SizedBox(height: 12),
                  const Text('No invoices uploaded yet.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                  const SizedBox(height: 4),
                  const Text('Upload an invoice to receive upfront financing.', style: TextStyle(color: AppTheme.textMuted, fontSize: 11)),
                ],
              ),
            ),
          )
        else
          ...invoices.map((inv) => InvoiceCard(invoice: inv)),
      ],
    );
  }

  Widget _buildFintechShieldTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'Factoring & Regulatory Safeguards',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
        ),
        const SizedBox(height: 6),
        const Text(
          'Governed under the Factoring Regulation Act, 2011 & RBI Digital Lending Directions.',
          style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
        ),
        const SizedBox(height: 16),
        _buildShieldCard(
          icon: Icons.fingerprint,
          color: Colors.amber,
          title: 'SHA-256 Anti-Fraud Registry',
          subtitle: 'Cryptographic hash prevents double-financing across platforms.',
        ),
        const SizedBox(height: 10),
        _buildShieldCard(
          icon: Icons.qr_code_2,
          color: Colors.cyan,
          title: '64-Char e-Invoice IRN Verification',
          subtitle: 'Validated in real time via Government IRP portal to guarantee invoice authenticity.',
        ),
        const SizedBox(height: 10),
        _buildShieldCard(
          icon: Icons.verified_user,
          color: AppTheme.primary,
          title: 'CERSAI Asset Charge Filing',
          subtitle: 'National central registry recording ensures absolute priority of claim.',
        ),
        const SizedBox(height: 10),
        _buildShieldCard(
          icon: Icons.account_balance,
          color: Colors.purple,
          title: 'RBI Escrow Direct Flow',
          subtitle: 'Capital flows Investor Escrow directly to Seller bank account. Zero platform pooling.',
        ),
      ],
    );
  }

  Widget _buildShieldCard({
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.surfaceCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white)),
                const SizedBox(height: 3),
                Text(subtitle, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary, height: 1.3)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'API & Environment Settings',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppTheme.surfaceCard,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.borderDark),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Active Backend Base URL', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
              const SizedBox(height: 4),
              Text(
                ApiService.baseUrl,
                style: const TextStyle(fontSize: 13, fontFamily: 'monospace', color: AppTheme.primary, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              const Divider(color: AppTheme.borderDark),
              const SizedBox(height: 8),
              const Text(
                'Note: In Android Emulator, localhost is mapped to http://10.0.2.2:3000.',
                style: TextStyle(fontSize: 11, color: AppTheme.textSecondary),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
