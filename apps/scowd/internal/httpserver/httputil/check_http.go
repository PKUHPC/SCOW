package http

import (
	"fmt"
	"net"
	"time"

	"github.com/sirupsen/logrus"
)

func CheckHTTPServerReady(port string) bool {
	timeout := time.After(3 * time.Second)           // 设置超时时间
	ticker := time.NewTicker(200 * time.Millisecond) // 检查的时间间隔
	defer ticker.Stop()                              // 确保在函数返回前停止计时器

	// 在循环开始前立即尝试连接一次
	conn, err := net.DialTimeout("tcp", fmt.Sprintf(":%s", port), time.Second)
	if err == nil {
		conn.Close() // 关闭连接
		return true  // 成功连接到HTTP端口，返回true
	}
	logrus.Infof("Waiting for child HTTP server to be ready on %s...", port)

	for {
		select {
		case <-timeout:
			return false // 超时返回false
		case <-ticker.C:
			conn, err := net.DialTimeout("tcp", fmt.Sprintf(":%s", port), time.Second)
			if err == nil {
				conn.Close() // 关闭连接
				return true  // 成功连接到HTTP端口，返回true
			}
			logrus.Infof("Waiting for child HTTP server to be ready on %s...", port)
		}
	}
}
