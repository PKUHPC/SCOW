package tls

import (
	"crypto/tls"
	"crypto/x509"
	"os"
	"scowd/pkg/config"

	"github.com/sirupsen/logrus"
)

func GetServerTLSConfig(fileConfig *config.ServerTLS) *tls.Config {
	// 加载服务器的证书和私钥
	serverCert, err := tls.LoadX509KeyPair(fileConfig.ServerCertPath, fileConfig.ServerPrivateKeyPath)
	if err != nil {
		logrus.Fatalf("server: loadkeys: %s", err)
	}

	// 双向 TLS 暂时不需要
	// 加载 CA 证书，用于验证客户端证书
	caCert, err := os.ReadFile(fileConfig.CaCertPath)
	if err != nil {
		logrus.Fatalf("Couldn't read client CA file: %s", err)
	}
	clientCAPool := x509.NewCertPool()
	clientCAPool.AppendCertsFromPEM(caCert)

	// 创建一个新的 TLS 配置
	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{serverCert},  // 服务器证书
		ClientAuth:   tls.RequireAndVerifyClientCert, // 要求并验证客户端证书
		ClientCAs:    clientCAPool,                   // 客户端 CA
	}

	return tlsConfig
}

func GetClientTLSConfig(fileConfig *config.ClientTLS) *tls.Config {
	// 可选：加载客户端证书和私钥（用于双向 TLS）
	var certificates []tls.Certificate
	if fileConfig.ClientCertPath != "" && fileConfig.ClientPrivateKeyPath != "" {
		pair, err := tls.LoadX509KeyPair(fileConfig.ClientCertPath, fileConfig.ClientPrivateKeyPath)
		if err != nil {
			logrus.Fatalf("LoadX509KeyPair error: %v", err)
		}
		certificates = []tls.Certificate{pair}
	}

	// 创建根证书池并加载 CA 证书
	certPool := x509.NewCertPool()
	ca, err := os.ReadFile(fileConfig.CaCertPath)
	if err != nil {
		logrus.Fatalf("read ca pem error: %v", err)
	}
	if ok := certPool.AppendCertsFromPEM(ca); !ok {
		logrus.Fatal("AppendCertsFromPEM error")
	}

	return &tls.Config{
		Certificates: certificates, // 客户端证书（如果需要）
		RootCAs:      certPool,     // 用于验证服务器证书的根 CA
	}
}
