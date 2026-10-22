import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/session";

// POST /api/v1/auth/logout
// Clears the user session cookie and redirects to /login if requested via HTML form.
export async function POST(request: Request) {
  await deleteSession();
  const accept = request.headers.get("accept") || "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }
  return NextResponse.json({ success: true, message: "Logged out." });
}

// GET /api/v1/auth/logout - direct link to logout and go to /login
export async function GET(request: Request) {
  await deleteSession();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
