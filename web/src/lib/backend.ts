import "server-only";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8080";

export async function backendFetch(path: string, options: RequestInit = {}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("udharco_session")?.value;
  const adminCookie = cookieStore.get("udharco_admin_session")?.value;

  const cookieHeader = [
    sessionCookie ? `udharco_session=${sessionCookie}` : "",
    adminCookie ? `udharco_admin_session=${adminCookie}` : "",
  ].filter(Boolean).join("; ");

  const headers = new Headers(options.headers || {});
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = `${BACKEND_URL}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers,
      cache: "no-store",
    });
    return res;
  } catch (error: any) {
    console.error(`[backendFetch Error] Failed to fetch ${url}:`, error.message);
    throw error;
  }
}
