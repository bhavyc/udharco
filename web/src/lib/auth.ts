import "server-only";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { SessionRole } from "@/lib/session";

// ---------------------------------------------------------------------------
// requireAuth — call at the top of any API route handler that needs auth.
//
// Usage:
//   const auth = await requireAuth();
//   if (auth instanceof NextResponse) return auth; // 401 short-circuit
//   const { userId, role, entityId } = auth;
//
// Optionally restrict to one or more roles:
//   const auth = await requireAuth("SELLER");
//   const auth = await requireAuth(["ANCHOR", "INVESTOR"]);
// ---------------------------------------------------------------------------

export interface AuthContext {
  userId: string;
  role: SessionRole;
  entityId: string; // Seller.id | Anchor.id | Investor.id
}

export async function requireAuth(
  allowedRoles?: SessionRole | SessionRole[]
): Promise<AuthContext | NextResponse> {
  const headerStore = await headers();
  const userId = headerStore.get("x-user-id");
  const role = headerStore.get("x-user-role") as SessionRole | null;
  const entityId = headerStore.get("x-entity-id");

  if (!userId || !role || !entityId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Please log in." },
      { status: 401 }
    );
  }

  if (allowedRoles) {
    const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!allowed.includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Forbidden. Required role: ${allowed.join(" or ")}.`,
        },
        { status: 403 }
      );
    }
  }

  return { userId, role, entityId };
}

// ---------------------------------------------------------------------------
// requireAdminAuth — for /admin/api routes.
// ---------------------------------------------------------------------------

export interface AdminAuthContext {
  adminId: string;
  email: string;
}

export async function requireAdminAuth(): Promise<
  AdminAuthContext | NextResponse
> {
  const headerStore = await headers();
  const adminId = headerStore.get("x-admin-id");
  const email = headerStore.get("x-admin-email");

  if (!adminId || !email) {
    return NextResponse.json(
      { success: false, error: "Admin authentication required." },
      { status: 401 }
    );
  }

  return { adminId, email };
}
