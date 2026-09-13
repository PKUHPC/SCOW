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

// StartExpirationCheck 在 stop 关闭时停止检查，仅在过期检查失败时关闭返回的通知通道。
func StartExpirationCheck(stop <-chan struct{}) <-chan struct{} {
	expired := make(chan struct{})
	go func() {
		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()
		checkExpiration(stop, ticker.C, expired)
	}()
	return expired
}

func checkExpiration(stop <-chan struct{}, ticks <-chan time.Time, expired chan<- struct{}) {
	for {
		select {
		case <-stop:
			return
		case <-ticks:
			if err := CheckExpireTime(); err != nil {
				logrus.Errorf("Binary expiration check failed: %v", err)
				// 只有检查协程关闭通知通道，不依赖主进程是否仍在接收。
				close(expired)
				return
			}
		}
	}
}
