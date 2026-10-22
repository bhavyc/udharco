import 'package:flutter_test/flutter_test.dart';
import 'package:udharco_mobile/main.dart';

void main() {
  testWidgets('UdharCo app boots successfully smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const UdharCoApp());
    expect(find.text('UdharCo'), findsOneWidget);
  });
}
