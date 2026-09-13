package proxy

import (
	"context"
	"crypto/tls"
	"fmt"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/config"
	tlsUtil "github.com/PKUHPC/private-scow/apps/scowd/internal/tls"
	"io"
	"net"
	"time"

	"github.com/sirupsen/logrus"
)

// handleConnection 处理客户端连接并转发到目标服务
func handleConnection(clientConn net.Conn, targetAddress string, tlsConfig *tls.Config) {
	defer func() {
		err := clientConn.Close()
		if err != nil {
			logrus.Errorf("Error closing client connection: %v", err)
		} else {
			logrus.Infof("Closed client connection from %s", clientConn.RemoteAddr())
		}
	}()

	logrus.Infof("Accepted connection from %s", clientConn.RemoteAddr())

	var targetConn net.Conn
	var err error

	// 判断是否使用 TLS
	if tlsConfig == nil {
		// 不使用 TLS，直接建立普通 TCP 连接
		logrus.Infof("Establishing plain TCP connection to target %s", targetAddress)
		targetConn, err = net.Dial("tcp", targetAddress)
	} else {
		// 使用 TLS，建立加密连接
		logrus.Infof("Establishing TLS connection to target %s", targetAddress)
		targetConn, err = tls.Dial("tcp", targetAddress, tlsConfig)
	}

	if err != nil {
		logrus.Errorf("Failed to connect to target server %s: %v", targetAddress, err)
		return
	}
	defer func() {
		err := targetConn.Close()
		if err != nil {
			logrus.Errorf("Error closing target connection: %v", err)
		} else {
			logrus.Infof("Closed target connection to %s", targetAddress)
		}
	}()

	logrus.Infof("Successfully connected to target %s", targetAddress)

	// 使用 goroutines 实现双向数据流转发
	copyFinished := make(chan struct{}, 2)

	// 从客户端读取数据并发送到目标服务器
	go func() {
		defer func() { copyFinished <- struct{}{} }()
		bytesCopied, err := io.Copy(targetConn, clientConn)
		if err != nil {
			logrus.Errorf("Error forwarding data from client %s to target %s: %v", clientConn.RemoteAddr(), targetAddress, err)
		}
		logrus.Infof("Forwarded %d bytes from client %s to target %s", bytesCopied, clientConn.RemoteAddr(), targetAddress)
	}()

	// 从目标服务器读取数据并发送到客户端
	go func() {
		defer func() { copyFinished <- struct{}{} }()
		bytesCopied, err := io.Copy(clientConn, targetConn)
		if err != nil {
			logrus.Errorf("Error forwarding data from target %s to client %s: %v", targetAddress, clientConn.RemoteAddr(), err)
		}
		logrus.Infof("Forwarded %d bytes from target %s to client %s", bytesCopied, targetAddress, clientConn.RemoteAddr())
	}()

	// 等待双向复制完成
	<-copyFinished
	logrus.Infof("Connection between client %s and target %s closed", clientConn.RemoteAddr(), targetAddress)
}

// InitAdapterProxy 初始化适配器代理
func InitAdapterProxy(ctx context.Context) {
	// 创建 TLS 监听器，监听代理端口
	scowdConfig, err := config.GetScowdConfig()
	if err != nil {
		logrus.Fatalf("[InitAdapterProxy] Read SCOWD Config Failed: %s", err)
	}
	adapterProxyConfig := scowdConfig.Proxy.AdapaterProxy

	address := fmt.Sprintf("%s:%d", adapterProxyConfig.Host, adapterProxyConfig.Port)

	var listener net.Listener
	if scowdConfig.ServerTLS.Enabled {
		tlsConfig := tlsUtil.GetServerTLSConfig(&scowdConfig.ServerTLS)
		listener, err = tls.Listen("tcp", address, tlsConfig) // 使用 TLS 监听客户端连接
		if err != nil {
			logrus.Fatalf("Error starting adapter proxy server TLS listener on %s: %v", address, err)
		}
		logrus.Infof("Adapter proxy server with TLS listening on %s", address)
	} else {
		listener, err = net.Listen("tcp", address) // 使用普通 TCP 监听客户端连接
		if err != nil {
			logrus.Fatalf("Error starting adapter proxy server TCP listener on %s: %v", address, err)
		}
		logrus.Infof("Adapter proxy server listening on %s", address)
	}

	// 判断是否启动scowd 到 适配器的 TLS
	var adapterTlsConfig *tls.Config
	if adapterProxyConfig.AdapterTLS.Enabled {
		adapterTlsConfig = tlsUtil.GetClientTLSConfig(&adapterProxyConfig.AdapterTLS)
		logrus.Infof("Adapter proxy is configured to use TLS for target connections")
	} else {
		logrus.Infof("Adapter proxy is configured to use plain TCP for target connections")
	}

	// 接收客户端连接并处理
	go func() {
		for {
			select {
			case <-ctx.Done():
				logrus.Infof("Shutting down adapter proxy server")
				if err := listener.Close(); err != nil {
					logrus.Errorf("Error closing listener: %v", err)
				} else {
					logrus.Infof("Listener on %s closed", address)
				}
				return
			default:
				clientConn, err := listener.Accept()
				if err != nil {
					// 检查是否是由于 listener 关闭导致的错误
					if opErr, ok := err.(*net.OpError); ok && !opErr.Temporary() {
						logrus.Infof("Listener closed, stopping accept loop")
						return
					}
					logrus.Errorf("Error accepting client connection: %v", err)
					time.Sleep(100 * time.Millisecond) // 添加短暂休眠
					continue
				}

				// 打印连接的详细信息
				logrus.Infof("Accepted new connection from %s", clientConn.RemoteAddr())

				go handleConnection(clientConn, adapterProxyConfig.AdapterAddress, adapterTlsConfig)
			}
		}
	}()
}
