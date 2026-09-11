package security

import (
	"crypto/rand"
	"crypto/rsa"
	"testing"
)

func TestSignAndVerify(t *testing.T) {
	// 生成RSA密钥对
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("Failed to generate RSA key: %v", err)
	}
	publicKey := &privateKey.PublicKey

	// 要签名的数据
	message := []byte("This is a test message")

	// 使用私钥进行签名
	signature, err := SignWithPrivateKey(message, privateKey)
	if err != nil {
		t.Fatalf("Failed to sign message: %v", err)
	}

	// 使用公钥验证签名
	isValid := VerifySignatureWithPublicKey(publicKey, message, signature)
	if !isValid {
		t.Errorf("Signature verification failed")
	}
}

func TestSerializeAndDeserializePublicKey(t *testing.T) {
	// 生成RSA密钥对
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("Failed to generate RSA key: %v", err)
	}
	publicKey := &privateKey.PublicKey

	// 序列化公钥
	serializedPubKey, err := SerializePublicKey(publicKey)
	if err != nil {
		t.Fatalf("Failed to serialize public key: %v", err)
	}

	// 反序列化公钥
	deserializedPubKey, err := DeserializePublicKey(serializedPubKey)
	if err != nil {
		t.Fatalf("Failed to deserialize public key: %v", err)
	}

	// 比较原始公钥和反序列化后的公钥
	if deserializedPubKey.N.Cmp(publicKey.N) != 0 || deserializedPubKey.E != publicKey.E {
		t.Errorf("Deserialized public key does not match original")
	}
}

func TestDeserializePublicKeyError(t *testing.T) {
	// 错误的PEM数据
	badPEM := "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz2ifmH5XztL+zMQy\n-----END PUBLIC KEY-----"

	_, err := DeserializePublicKey(badPEM)
	if err == nil {
		t.Errorf("Expected an error when deserializing bad PEM data, but got none")
	}
}
