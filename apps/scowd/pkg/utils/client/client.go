package client

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"

	"golang.org/x/net/http2"

	"scowd/pkg/config"
)

type ClientCreator[C any] func(httpClient *http.Client, url string) C

func CreateClient[C any](config config.ServerTLS, creator ClientCreator[C], url string) (C, error) {
	// 创建基础HTTP客户端
	var (
		client     C
		httpClient = &http.Client{}
	)

	// 配置传输层
	var transport http.RoundTripper
	if config.Enabled {
		// TLS配置
		tlsConfig := &tls.Config{
			MinVersion: tls.VersionTLS12, // 强制使用TLS1.2+
		}

		// 证书加载
		if config.ServerCertPath != "" && config.ServerPrivateKeyPath != "" {
			cert, err := tls.LoadX509KeyPair(config.ServerCertPath, config.ServerPrivateKeyPath)
			if err != nil {
				return client, err
			}
			tlsConfig.Certificates = []tls.Certificate{cert}
		}

		// CA证书验证
		if config.CaCertPath != "" {
			caCert, err := os.ReadFile(config.CaCertPath)
			if err != nil {
				return client, err
			}
			caCertPool := x509.NewCertPool()
			caCertPool.AppendCertsFromPEM(caCert)
			tlsConfig.RootCAs = caCertPool
		}

		// 创建HTTP2 Transport
		transport = &http2.Transport{
			TLSClientConfig: tlsConfig,
			AllowHTTP:       false, // 强制使用HTTPS
			IdleConnTimeout: 90 * time.Second,
		}
		// 创建 https 客户端
		client = creator(httpClient, fmt.Sprintf("https://%s", url))
	} else {
		// 普通HTTP/2明文传输
		transport = &http2.Transport{
			AllowHTTP: true, // 允许明文通信
			DialTLS: func(network, addr string, _ *tls.Config) (net.Conn, error) {
				return net.Dial(network, addr)
			},
			IdleConnTimeout: 90 * time.Second,
		}

		// 创建 http 客户端
		client = creator(httpClient, fmt.Sprintf("http://%s", url))
	}

	// 设置传输层并创建客户端
	httpClient.Transport = transport

	return client, nil
}
