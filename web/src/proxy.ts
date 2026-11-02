import { NextRequest, NextResponse } from "next/server";
import { decryptSession, decryptAdminSession } from "@/lib/session";

// ---------------------------------------------------------------------------
// Route matchers
// ---------------------------------------------------------------------------

// Public routes that do NOT require authentication
const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/notice",                     // Digital Notice of Assignment portal for Corporate Buyers
  "/api/v1/auth/seller/request-otp",
  "/api/v1/auth/seller/verify-otp",
  "/api/v1/auth/seller/complete-signup",
  "/api/v1/auth/login",          // Anchor / Investor invite login
  "/api/v1/auth/invite",         // Anchor / Investor invite validation
  "/api/v1/kyc",                 // KYC lookup during signup (GSTIN, bank penny drop)
  "/api/v1/webhooks",            // Webhooks are validated by their own signature check
  "/corporate/apply",            // Semi-Self-Service Anchor Application Form
  "/api/v1/corporate/apply",     // Corporate application submission endpoint
];

// Admin-only route prefix
const ADMIN_ROUTE_PREFIX = "/admin";

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 0. Prevent Header Spoofing ─────────────────────────────────────────────
  // Strip untrusted client-supplied identity headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-admin-id");
  requestHeaders.delete("x-admin-email");
  requestHeaders.delete("x-user-id");
  requestHeaders.delete("x-user-role");
  requestHeaders.delete("x-entity-id");

  // Validate Admin Session (if cookie present)
  const adminToken = request.cookies.get("udharco_admin_session")?.value;
  const adminSession = await decryptAdminSession(adminToken);
  if (adminSession) {
    requestHeaders.set("x-admin-id", adminSession.adminId);
    requestHeaders.set("x-admin-email", adminSession.email);
  }

  // ── 1. Admin routes ────────────────────────────────────────────────────────
  if (pathname.startsWith(ADMIN_ROUTE_PREFIX)) {
    // The admin login page and its auth APIs are public
    if (pathname === "/admin/login" || pathname.startsWith("/admin/api/auth")) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    if (!adminSession) {
      if (pathname.startsWith("/admin/api/")) {
        return NextResponse.json(
          { success: false, error: "Unauthorized. Admin login required." },
          { status: 401 }
        );
      }
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── 2. Public user routes ──────────────────────────────────────────────────
  // Check if public route
  const isPublicRoute =
    PUBLIC_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    ) ||
    pathname.includes("/notice-confirm") ||
    // Only GET on /api/v1/entities/anchors or sellers is public (for dropdown lists)
    (request.method === "GET" && (pathname === "/api/v1/entities/anchors" || pathname === "/api/v1/entities/sellers"));

  if (isPublicRoute) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── 3. Protected user routes ───────────────────────────────────────────────
  const sessionToken = request.cookies.get("udharco_session")?.value;
  const session = await decryptSession(sessionToken);

  if (!session && !adminSession) {
    // API routes → 401 JSON; page routes → redirect to /login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session) {
    requestHeaders.set("x-user-id", session.userId);
    requestHeaders.set("x-user-role", session.role);
    requestHeaders.set("x-entity-id", session.entityId);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Apply to all routes except Next.js internals and static files
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|images).*)",
  ],
};