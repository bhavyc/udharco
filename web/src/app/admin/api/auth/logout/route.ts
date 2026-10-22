import { NextResponse } from "next/server";
import { deleteAdminSession } from "@/lib/session";

// POST /admin/api/auth/logout
export async function POST(request: Request) {
  await deleteAdminSession();
  const accept = request.headers.get("accept") || "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/admin/login", request.url), { status: 303 });
  }
  return NextResponse.json({ success: true, message: "Admin logged out." });
}

// GET /admin/api/auth/logout
export async function GET(request: Request) {
  await deleteAdminSession();
  return NextResponse.redirect(new URL("/admin/login", request.url), { status: 303 });
}
