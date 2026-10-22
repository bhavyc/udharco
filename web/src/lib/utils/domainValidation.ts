/**
 * Enterprise Corporate Email Domain Validation
 * Prevents fraudulent anchor onboarding using personal/free webmail accounts (Gmail, Yahoo, etc.)
 */

export const BLOCKED_FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "ymail.com",
  "rocketmail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "rediffmail.com",
  "rediff.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "mail.com",
  "gmx.com",
  "aol.com",
  "inbox.com",
  "fastmail.com",
  "tempmail.com",
  "guerrillamail.com",
]);

export interface DomainValidationResult {
  isValid: boolean;
  domain?: string;
  error?: string;
}

export function validateCorporateEmail(email: string): DomainValidationResult {
  if (!email || typeof email !== "string") {
    return { isValid: false, error: "Corporate email is required." };
  }

  const clean = email.trim().toLowerCase();
  const parts = clean.split("@");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { isValid: false, error: "Please enter a valid email address format." };
  }

  const domain = parts[1];

  // Disallow free/personal webmail providers
  if (BLOCKED_FREE_EMAIL_DOMAINS.has(domain)) {
    return {
      isValid: false,
      domain,
      error: `Public webmail addresses (@${domain}) are strictly forbidden for Corporate Anchors. Under FRA 2011 & institutional risk guidelines, you must provide your company's official corporate domain (e.g. name@tatamotors.com).`,
    };
  }

  // Domain must contain at least one dot and valid characters
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return { isValid: false, domain, error: "Invalid email domain structure." };
  }

  return { isValid: true, domain };
}
