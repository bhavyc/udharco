package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rateRecord struct {
	count     int
	firstTime time.Time
}

type MemoryRateLimiter struct {
	mu      sync.Mutex
	records map[string]*rateRecord
	limit   int
	window  time.Duration
}

func NewMemoryRateLimiter(limit int, window time.Duration) *MemoryRateLimiter {
	return &MemoryRateLimiter{
		records: make(map[string]*rateRecord),
		limit:   limit,
		window:  window,
	}
}

func (rl *MemoryRateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		rl.mu.Lock()
		rec, exists := rl.records[ip]
		if !exists || now.Sub(rec.firstTime) > rl.window {
			rl.records[ip] = &rateRecord{count: 1, firstTime: now}
			rl.mu.Unlock()
			c.Next()
			return
		}

		if rec.count >= rl.limit {
			rl.mu.Unlock()
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error":   "RATE_LIMIT_EXCEEDED",
				"message": "Too many requests. Please wait a few moments before retrying.",
			})
			c.Abort()
			return
		}

		rec.count++
		rl.mu.Unlock()
		c.Next()
	}
}
