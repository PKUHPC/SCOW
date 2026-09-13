package parent

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"fmt"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/process/common"
	"sync"
)

type SecureKeyManager struct {
	mu          sync.RWMutex
	privateKeys map[string]*rsa.PrivateKey
	publicKeys  map[string]*rsa.PublicKey
	signTokens  map[string][]byte
}

var GlobalSecureKeyManager = &SecureKeyManager{
	privateKeys: make(map[string]*rsa.PrivateKey),
	publicKeys:  make(map[string]*rsa.PublicKey),
	signTokens:  make(map[string][]byte),
}

// AddKeyPair adds a new key pair to the SecureKeyManager struct.
func (s *SecureKeyManager) AddKeyPair(port string, priv *rsa.PrivateKey, pub *rsa.PublicKey) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.privateKeys[port] = priv
	s.publicKeys[port] = pub
}

// GetPrivateKey retrieves a private key by port.
func (s *SecureKeyManager) GetPrivateKey(port string) (*rsa.PrivateKey, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	privKey, ok := s.privateKeys[port]
	if !ok {
		return nil, fmt.Errorf("private key for port '%s' not found", port)
	}

	return privKey, nil
}

// GetPublicKey retrieves a public key by port.
func (s *SecureKeyManager) GetPublicKey(port string) (*rsa.PublicKey, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	pubKey, ok := s.publicKeys[port]
	if !ok {
		return nil, fmt.Errorf("public key for port '%s' not found", port)
	}

	return pubKey, nil
}

// GetSignToken retrieves a sign token by port.
func (s *SecureKeyManager) GetSignToken(port string) ([]byte, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	signToken, ok := s.signTokens[port]
	if !ok {
		return nil, fmt.Errorf("sign token for port '%s' not found", port)
	}

	return signToken, nil
}

// DeleteKeyPair removes a key pair from the SecureKeyManager struct.
func (s *SecureKeyManager) DeleteKeyPair(port string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.privateKeys, port)
	delete(s.publicKeys, port)
}

// GenerateKeyPairAndSignToekn generates a new RSA key pair and sign the common SecureToken and adds them to SecureKeyManager.
func (s *SecureKeyManager) GenerateKeyPairAndSignToken(port string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return fmt.Errorf("failed to generate private key: %v", err)
	}
	s.privateKeys[port] = privKey

	pubKey := &privKey.PublicKey
	s.publicKeys[port] = pubKey

	hashed := sha256.Sum256([]byte(common.SecureToken))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privKey, crypto.SHA256, hashed[:])
	if err != nil {
		return err
	}

	s.signTokens[port] = signature

	return nil
}
