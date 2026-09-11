package process

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"scowd/global/parent"

	"github.com/sirupsen/logrus"
	"golang.org/x/net/http2"
)

type ClientCreator[C any] func(httpClient *http.Client, url string) C

func GetChildProcessClient[C any](creator ClientCreator[C], childProcess *parent.ChildProcess) C {
	// 先获取port值，避免在持有锁的情况下调用GetPort
	port := childProcess.GetPort()

	childProcess.Mu.Lock()
	defer childProcess.Mu.Unlock()

	// 检查是否已有缓存的client
	if cachedClient, ok := childProcess.Client.(C); ok {
		return cachedClient
	}

	// 创建新的client
	client := creator(
		&http.Client{
			Transport: &http2.Transport{
				AllowHTTP: true,
				DialTLS: func(network, addr string, _ *tls.Config) (net.Conn, error) {
					return net.Dial(network, addr)
				},
			},
		},
		fmt.Sprintf("http://127.0.0.1:%s", port),
	)
	logrus.Debugf("create client for process on port: %s", port)
	// 缓存client
	childProcess.Client = client
	return client
}
