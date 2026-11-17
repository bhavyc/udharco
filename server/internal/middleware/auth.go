package middleware

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/bhavyc/udharco/server/internal/config"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type AuthUser struct {
	UserID   string `json:"userId"`
	Role     string `json:"role"` // SELLER, ANCHOR, INVESTOR, ADMIN
	EntityID string `json:"entityId"`
	Mobile   string `json:"mobile,omitempty"`
	Email    string `json:"email,omitempty"`
}

type CustomClaims struct {
	UserID   string `json:"userId"`
	Role     string `json:"role"`
	EntityID string `json:"entityId"`
	Mobile   string `json:"mobile,omitempty"`
	Email    string `json:"email,omitempty"`
	jwt.RegisteredClaims
}

// GenerateToken creates a signed JWT for platform sessions
func GenerateToken(cfg *config.Config, user AuthUser, duration time.Duration) (string, error) {
	secret := cfg.SessionSecret
	if user.Role == "ADMIN" {
		secret = cfg.AdminSessionSecret
	}

	claims := CustomClaims{
		UserID:   user.UserID,
		Role:     user.Role,
		EntityID: user.EntityID,
		Mobile:   user.Mobile,
		Email:    user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "udharco-clearing-engine",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ParseToken validates a signed JWT
func ParseToken(cfg *config.Config, tokenStr string, isAdmin bool) (*AuthUser, error) {
	secret := cfg.SessionSecret
	if isAdmin {
		secret = cfg.AdminSessionSecret
	}

	token, err := jwt.ParseWithClaims(tokenStr, &CustomClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing algorithm")
		}
		return []byte(secret), nil
	})

	if err != nil {
		// Fallback check: If verifying standard session with admin secret or vice versa
		token, err = jwt.ParseWithClaims(tokenStr, &CustomClaims{}, func(t *jwt.Token) (interface{}, error) {
			otherSecret := cfg.AdminSessionSecret
			if isAdmin {
				otherSecret = cfg.SessionSecret
			}
			return []byte(otherSecret), nil
		})
	}

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*CustomClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid or expired authentication token")
	}

	return &AuthUser{
		UserID:   claims.UserID,
		Role:     claims.Role,
		EntityID: claims.EntityID,
		Mobile:   claims.Mobile,
		Email:    claims.Email,
	}, nil
}

// RequireAuth middleware protects routes and enforces RBAC
func RequireAuth(cfg *config.Config, allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenStr string

		// 1. Check Authorization Bearer header
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
		}

		// 2. Check Cookie (udharco_session or udharco_admin_session)
		if tokenStr == "" {
			if cookie, err := c.Cookie("udharco_session"); err == nil && cookie != "" {
				tokenStr = cookie
			} else if adminCookie, err := c.Cookie("udharco_admin_session"); err == nil && adminCookie != "" {
				tokenStr = adminCookie
			}
		}

		if tokenStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "UNAUTHORIZED",
				"message": "Authentication required. Please log in to access this resource.",
			})
			c.Abort()
			return
		}

		isAdminRoute := strings.HasPrefix(c.Request.URL.Path, "/admin")
		user, err := ParseToken(cfg, tokenStr, isAdminRoute)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "TOKEN_INVALID_OR_EXPIRED",
				"message": "Session expired or invalid token. Please log in again.",
			})
			c.Abort()
			return
		}

		// Role Check
		if len(allowedRoles) > 0 {
			roleAllowed := false
			for _, r := range allowedRoles {
				if user.Role == r {
					roleAllowed = true
					break
				}
			}
			if !roleAllowed {
				c.JSON(http.StatusForbidden, gin.H{
					"success": false,
					"error":   "FORBIDDEN_ROLE",
					"message": "You do not have administrative permissions to perform this action.",
				})
				c.Abort()
				return
			}
		}

		c.Set("user", user)
		c.Next()
	}
}

// GetAuthUser retrieves authenticated user from gin context
func GetAuthUser(c *gin.Context) *AuthUser {
	val, exists := c.Get("user")
	if !exists {
		return nil
	}
	u, ok := val.(*AuthUser)
	if !ok {
		return nil
	}
	return u
}
