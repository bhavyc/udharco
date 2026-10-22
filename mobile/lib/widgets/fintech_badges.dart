import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class StatusPill extends StatelessWidget {
  final String status;

  const StatusPill({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    IconData icon;

    switch (status) {
      case 'UPLOADED':
        bg = Colors.amber.withOpacity(0.15);
        fg = Colors.amber;
        icon = Icons.upload_file;
        break;
      case 'VERIFIED':
        bg = Colors.blue.withOpacity(0.15);
        fg = Colors.blue;
        icon = Icons.verified_user;
        break;
      case 'ANCHOR_CONFIRMED':
        bg = Colors.indigo.withOpacity(0.15);
        fg = Colors.indigoAccent;
        icon = Icons.fact_check;
        break;
      case 'LISTED':
        bg = Colors.purple.withOpacity(0.15);
        fg = Colors.purpleAccent;
        icon = Icons.storefront;
        break;
      case 'FUNDED':
        bg = AppTheme.primary.withOpacity(0.15);
        fg = AppTheme.primary;
        icon = Icons.check_circle;
        break;
      case 'SETTLED':
        bg = const Color(0xFF059669);
        fg = Colors.white;
        icon = Icons.done_all;
        break;
      case 'DEFAULTED':
      case 'REJECTED':
      case 'REJECTED_TIMEOUT':
        bg = Colors.red.withOpacity(0.15);
        fg = Colors.redAccent;
        icon = Icons.warning_amber;
        break;
      default:
        bg = Colors.grey.withOpacity(0.15);
        fg = Colors.grey;
        icon = Icons.info_outline;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: fg.withOpacity(0.3), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: fg),
          const SizedBox(width: 5),
          Text(
            status.replaceAll('_', ' '),
            style: TextStyle(
              color: fg,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}

class FintechChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;

  const FintechChip({
    super.key,
    required this.label,
    required this.icon,
    this.color = AppTheme.primary,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.25), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
