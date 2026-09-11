package security

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/pem"
	"errors"
)

// SignWithPrivateKey 使用私钥进行签名。
func SignWithPrivateKey(msg []byte, privateKey *rsa.PrivateKey) ([]byte, error) {
	hasher := sha256.New()
	hasher.Write(msg)
	hashed := hasher.Sum(nil)

	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, hashed)
	if err != nil {
		return nil, err
	}
	return signature, nil
}

// SerializePublicKey 序列化公钥为PEM格式字符串
func SerializePublicKey(pubKey *rsa.PublicKey) (string, error) {
	publicKeyBytes, err := x509.MarshalPKIXPublicKey(pubKey)
	if err != nil {
		return "", err
	}
	publicKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: publicKeyBytes,
	})
	return string(publicKeyPEM), nil
}

// DeserializePublicKey 从PEM格式的字符串反序列化公钥
func DeserializePublicKey(pemStr string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, errors.New("public key decode error: PEM data is not found")
	}

	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}

	switch pub := pub.(type) {
	case *rsa.PublicKey:
		return pub, nil
	default:
		return nil, errors.New("public key decode error: unexpected type of public key")
	}
}

// VerifySignatureWithPublicKey 使用公钥验证签名。
func VerifySignatureWithPublicKey(publicKey *rsa.PublicKey, data, signature []byte) bool {
	hasher := sha256.New()
	hasher.Write(data)
	hashed := hasher.Sum(nil)

	err := rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, hashed, signature)
	return err == nil
}
