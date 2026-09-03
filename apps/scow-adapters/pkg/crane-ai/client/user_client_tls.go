package client

import (
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// fingerprintCertificateFiles 返回 user.pem 和 user.key 的内容指纹。
// 连接缓存按该指纹判断证书是否发生变化；文件名也参与摘要，避免两个
// 文件内容拼接后出现理论上的边界歧义。
func fingerprintCertificateFiles(certDir string) (string, error) {
	hash := sha256.New()
	for _, name := range []string{"user.pem", "user.key"} {
		content, err := os.ReadFile(filepath.Join(certDir, name))
		if err != nil {
			return "", err
		}
		_, _ = hash.Write([]byte(name))
		_, _ = hash.Write([]byte{0})
		_, _ = hash.Write(content)
	}
	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

// readTLSConfig 从用户目录加载客户端证书，并使用 Crane 的外部证书作为
// 服务端信任根。TLS 最低版本固定为 1.2，以兼容只支持 TLS 1.2 的旧环境；
// 如果服务端支持 TLS 1.3，Go 会自动优先协商更高版本。
func readTLSConfig(config *CraneConfig, certDir string, expectedUID *uint32) (*tls.Config, error) {
	userKeyPath := filepath.Join(certDir, "user.key")
	userCertPath := filepath.Join(certDir, "user.pem")
	cert, err := tls.LoadX509KeyPair(userCertPath, userKeyPath)
	if err != nil {
		return nil, fmt.Errorf("load Crane TLS certificate %s and key %s: %w", userCertPath, userKeyPath, err)
	}
	if expectedUID != nil {
		if err := validateCertificateUID(cert, *expectedUID); err != nil {
			return nil, fmt.Errorf("validate Crane TLS certificate %s: %w", userCertPath, err)
		}
	}

	caPEM, err := os.ReadFile(config.TLS.ExternalCertFilePath)
	if err != nil {
		return nil, fmt.Errorf("read Crane TLS server certificate %s: %w", config.TLS.ExternalCertFilePath, err)
	}
	caPool := x509.NewCertPool()
	if !caPool.AppendCertsFromPEM(caPEM) {
		return nil, fmt.Errorf("parse Crane TLS server certificate %s", config.TLS.ExternalCertFilePath)
	}
	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   tls.VersionTLS12,
		RootCAs:      caPool,
	}, nil
}

// validateCertificateUID 校验用户证书 Common Name 的 UID 前缀。
// Crane 的用户证书通常使用“UID.域名”作为 Common Name；只校验前缀，
// 域名部分交由证书链和 CraneCtld 的 TLS 校验处理。
func validateCertificateUID(cert tls.Certificate, expectedUID uint32) error {
	if len(cert.Certificate) == 0 {
		return fmt.Errorf("certificate chain is empty")
	}
	leaf, err := x509.ParseCertificate(cert.Certificate[0])
	if err != nil {
		return fmt.Errorf("parse certificate: %w", err)
	}
	uidPart, _, _ := strings.Cut(leaf.Subject.CommonName, ".")
	parsedUID, err := strconv.ParseUint(uidPart, 10, 32)
	if err != nil {
		return fmt.Errorf("certificate common name %q does not contain a valid UID", leaf.Subject.CommonName)
	}
	if uint32(parsedUID) != expectedUID {
		return fmt.Errorf("certificate UID %d does not match requested UID %d", parsedUID, expectedUID)
	}
	return nil
}
