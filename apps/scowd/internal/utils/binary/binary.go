package binary

import (
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
)

// 通过ldflags在编译时注入
var (
	ExpireTime string
)

// CheckExpireTime 检查二进制文件是否过期
func CheckExpireTime() error {
	if ExpireTime == "" {
		return nil
	}

	expire, err := time.Parse(time.RFC3339, ExpireTime)
	if err != nil {
		return fmt.Errorf("parse expire time failed: %v", err)
	}

	if time.Now().After(expire) {
		return fmt.Errorf("binary expired")
	}

	return nil
}

// StartExpirationCheck 启动过期检查协程
func StartExpirationCheck(shutdown chan struct{}) {
	go func() {
		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			if err := CheckExpireTime(); err != nil {
				logrus.Errorf("Binary expiration check failed: %v", err)
				shutdown <- struct{}{}
				return
			}
		}
	}()
}
