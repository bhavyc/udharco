package utils

import (
	"fmt"
	"strings"
)

var blockedFreeEmailDomains = map[string]bool{
	"gmail.com":        true,
	"googlemail.com":   true,
	"yahoo.com":        true,
	"yahoo.co.in":      true,
	"yahoo.co.uk":      true,
	"ymail.com":        true,
	"rocketmail.com":   true,
	"hotmail.com":      true,
	"outlook.com":      true,
	"live.com":         true,
	"msn.com":          true,
	"rediffmail.com":   true,
	"rediff.com":       true,
	"icloud.com":       true,
	"me.com":           true,
	"mac.com":          true,
	"protonmail.com":   true,
	"proton.me":        true,
	"zoho.com":         true,
	"mail.com":         true,
	"gmx.com":          true,
	"aol.com":          true,
	"inbox.com":        true,
	"fastmail.com":     true,
	"tempmail.com":     true,
	"guerrillamail.com": true,
}

// ValidateCorporateEmail checks whether the email is a valid corporate business domain
func ValidateCorporateEmail(email string) (bool, string, error) {
	clean := strings.ToLower(strings.TrimSpace(email))
	if clean == "" {
		return false, "", fmt.Errorf("Corporate email is required.")
	}

	parts := strings.Split(clean, "@")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return false, "", fmt.Errorf("Please enter a valid email address format.")
	}

	domain := parts[1]
	if blockedFreeEmailDomains[domain] {
		return false, domain, fmt.Errorf("Public webmail addresses (@%s) are strictly forbidden for Corporate Anchors. Under FRA 2011 & institutional risk guidelines, you must provide your company's official corporate domain (e.g. name@tatamotors.com).", domain)
	}

	if !strings.Contains(domain, ".") || strings.HasPrefix(domain, ".") || strings.HasSuffix(domain, ".") {
		return false, domain, fmt.Errorf("Invalid email domain structure.")
	}

	return true, domain, nil
}
