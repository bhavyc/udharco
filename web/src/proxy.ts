import { NextRequest, NextResponse } from "next/server";
import { decryptSession, decryptAdminSession } from "@/lib/session";

// ---------------------------------------------------------------------------
// Route matchers
// ---------------------------------------------------------------------------

// Public routes that do NOT require authentication
const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/api/v1/auth/seller/request-otp",
  "/api/v1/auth/seller/verify-otp",
  "/api/v1/auth/seller/complete-signup",
  "/api/v1/auth/login",          // Anchor / Investor invite login
  "/api/v1/kyc",                 // KYC lookup during signup (GSTIN, bank penny drop)
  "/api/v1/webhooks",            // Webhooks are validated by their own signature check
  "/corporate/apply",            // Semi-Self-Service Anchor Application Form
  "/api/v1/corporate",           // Corporate application submission endpoint
  "/api/v1/entities",            // Public entity lookup for onboarding (anchors, sellers)
];

// Admin-only routes — validated against adminKey (totally separate from user sessions)
const ADMIN_ROUTE_PREFIX = "/admin";

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Admin routes ────────────────────────────────────────────────────────
  if (pathname.startsWith(ADMIN_ROUTE_PREFIX)) {
    // The admin login page itself is public
    if (pathname === "/admin/login" || pathname.startsWith("/admin/api/auth")) {
      return NextResponse.next();
    }

    const adminToken = request.cookies.get("udharco_admin_session")?.value;
    const adminSession = await decryptAdminSession(adminToken);

    if (!adminSession) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    // Inject admin identity into request headers for downstream route handlers
    const res = NextResponse.next();
    res.headers.set("x-admin-id", adminSession.adminId);
    res.headers.set("x-admin-email", adminSession.email);
    return res;
  }

  // ── 2. Public user routes ──────────────────────────────────────────────────
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
  if (isPublic) {
    return NextResponse.next();
  }

  // ── 3. Protected user routes ───────────────────────────────────────────────
  const sessionToken = request.cookies.get("udharco_session")?.value;
  const session = await decryptSession(sessionToken);

  if (!session) {
    // API routes → 401 JSON; page routes → redirect to /login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Inject user identity into request headers for downstream route handlers
  const res = NextResponse.next();
  res.headers.set("x-user-id", session.userId);
  res.headers.set("x-user-role", session.role);
  res.headers.set("x-entity-id", session.entityId);
  return res;
}

export const config = {
  // Apply to all routes except Next.js internals and static files
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|images).*)",
  ],
};
