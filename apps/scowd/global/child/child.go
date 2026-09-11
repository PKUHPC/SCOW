package child

import (
	"crypto/rsa"
	"sync"
	"time"
)

var (
	LastRequestTime *time.Time
	mu              sync.RWMutex
)

var PublicKey *rsa.PublicKey

// SetRequestValue 设置 RequestValue 的值
func SetLastRequestTime(t time.Time) {
	mu.Lock()
	defer mu.Unlock()
	LastRequestTime = &t
}

// GetRequestValue 获取 RequestValue 的值
func GetLastRequestTime() *time.Time {
	mu.RLock()
	defer mu.RUnlock()
	return LastRequestTime
}
