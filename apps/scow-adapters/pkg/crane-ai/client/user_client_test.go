package client

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"math/big"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"

	craneProtos "scow-adapters/gen/crane-ai"
)

type stubCraneCtldClient struct {
	craneProtos.CraneCtldClient
}

func TestValidateCertificateUID(t *testing.T) {
	cert := newTestCertificate(t, "1001.cluster.example")

	if err := validateCertificateUID(cert, 1001); err != nil {
		t.Fatalf("validate matching UID: %v", err)
	}

	err := validateCertificateUID(cert, 1002)
	if err == nil {
		t.Fatal("expected mismatched UID to fail validation")
	}
	want := "certificate UID 1001 does not match requested UID 1002"
	if err.Error() != want {
		t.Fatalf("validation error = %q, want %q", err, want)
	}
}

func TestFingerprintCertificateFilesChangesWhenEitherFileChanges(t *testing.T) {
	dir := t.TempDir()
	pemPath := filepath.Join(dir, "user.pem")
	keyPath := filepath.Join(dir, "user.key")
	if err := os.WriteFile(pemPath, []byte("pem-v1"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keyPath, []byte("key-v1"), 0600); err != nil {
		t.Fatal(err)
	}

	first, err := fingerprintCertificateFiles(dir)
	if err != nil {
		t.Fatalf("fingerprint initial certificate: %v", err)
	}
	if err := os.WriteFile(keyPath, []byte("key-v2"), 0600); err != nil {
		t.Fatal(err)
	}
	second, err := fingerprintCertificateFiles(dir)
	if err != nil {
		t.Fatalf("fingerprint changed certificate: %v", err)
	}
	if first == second {
		t.Fatal("certificate fingerprint did not change after key rotation")
	}
}

func TestFingerprintCertificateFilesReportsMissingFile(t *testing.T) {
	dir := t.TempDir()
	if _, err := fingerprintCertificateFiles(dir); err == nil {
		t.Fatal("expected missing certificate file to fail")
	}
}

func TestCraneCtldClientManagerCachesClientByUID(t *testing.T) {
	manager := newCraneCtldClientManager()
	manager.fingerprintCert = func(string) (string, error) { return "certificate-v1", nil }
	manager.lookupUser = func(uid string) (*user.User, error) {
		if uid != "1001" {
			t.Fatalf("lookup UID = %q, want 1001", uid)
		}
		return &user.User{Uid: uid, HomeDir: "/users/alice"}, nil
	}

	created := 0
	stubClient := &stubCraneCtldClient{}
	manager.newClient = func(_ *CraneConfig, certDir string, expectedUID *uint32) (
		craneProtos.CraneCtldClient,
		*grpc.ClientConn,
		error,
	) {
		created++
		wantCertDir := filepath.Join("/users/alice", ".config", "crane")
		if certDir != wantCertDir {
			t.Fatalf("certificate directory = %q, want %q", certDir, wantCertDir)
		}
		if expectedUID == nil || *expectedUID != 1001 {
			t.Fatalf("expected UID = %v, want 1001", expectedUID)
		}
		return stubClient, newTestClientConn(t), nil
	}

	config := &CraneConfig{TLS: TLSConfig{Enabled: true}}
	first, _, releaseFirst, err := manager.acquire(config, 1001)
	if err != nil {
		t.Fatalf("get first client: %v", err)
	}
	releaseFirst()
	second, _, releaseSecond, err := manager.acquire(config, 1001)
	if err != nil {
		t.Fatalf("get cached client: %v", err)
	}
	releaseSecond()

	if first != stubClient || second != stubClient {
		t.Fatal("manager did not return the created client")
	}
	if created != 1 {
		t.Fatalf("client creation count = %d, want 1", created)
	}
}

func TestCraneCtldClientManagerReloadsChangedCertificate(t *testing.T) {
	manager := newTestClientManager(t)
	fingerprint := "certificate-v1"
	manager.fingerprintCert = func(string) (string, error) { return fingerprint, nil }
	created, closed := 0, 0
	manager.newClient = func(*CraneConfig, string, *uint32) (craneProtos.CraneCtldClient, *grpc.ClientConn, error) {
		created++
		return &stubCraneCtldClient{}, newTestClientConn(t), nil
	}
	manager.closeConn = func(conn *grpc.ClientConn) error {
		closed++
		return conn.Close()
	}

	config := &CraneConfig{TLS: TLSConfig{Enabled: true}}
	first, _, releaseFirst, err := manager.acquire(config, 1001)
	if err != nil {
		t.Fatalf("acquire first client: %v", err)
	}
	releaseFirst()
	fingerprint = "certificate-v2"
	second, _, releaseSecond, err := manager.acquire(config, 1001)
	if err != nil {
		t.Fatalf("acquire client after certificate change: %v", err)
	}
	releaseSecond()

	if first == second {
		t.Fatal("certificate change reused the old client")
	}
	if created != 2 || closed != 1 {
		t.Fatalf("created = %d, closed = %d; want created=2, closed=1", created, closed)
	}
}

func TestCraneCtldClientManagerKeepsActiveRotatedConnectionUntilRelease(t *testing.T) {
	manager := newTestClientManager(t)
	fingerprint := "certificate-v1"
	manager.fingerprintCert = func(string) (string, error) { return fingerprint, nil }
	closed := 0
	manager.closeConn = func(conn *grpc.ClientConn) error {
		closed++
		return conn.Close()
	}
	config := &CraneConfig{TLS: TLSConfig{Enabled: true}}

	_, oldEntry, releaseOld, err := manager.acquire(config, 1001)
	if err != nil {
		t.Fatalf("acquire old client: %v", err)
	}
	fingerprint = "certificate-v2"
	_, newEntry, releaseNew, err := manager.acquire(config, 1001)
	if err != nil {
		t.Fatalf("acquire rotated client: %v", err)
	}
	if closed != 0 || oldEntry.closed {
		t.Fatal("active connection was closed during certificate rotation")
	}
	if manager.clients[1001] != newEntry {
		t.Fatal("rotated client did not replace the cache entry")
	}

	releaseOld()
	if closed != 1 || !oldEntry.closed {
		t.Fatal("rotated connection was not closed after its active call finished")
	}
	releaseNew()
}

func TestCraneCtldClientManagerDoesNotEvictActiveEntry(t *testing.T) {
	manager := newTestClientManager(t)
	manager.maxEntries = 1
	closed := 0
	manager.closeConn = func(conn *grpc.ClientConn) error {
		closed++
		return conn.Close()
	}
	config := &CraneConfig{TLS: TLSConfig{Enabled: true}}

	_, firstEntry, releaseFirst, err := manager.acquire(config, 1001)
	if err != nil {
		t.Fatalf("acquire active client: %v", err)
	}
	_, secondEntry, releaseSecond, err := manager.acquire(config, 1002)
	if err != nil {
		t.Fatalf("acquire overflow client: %v", err)
	}
	if !firstEntry.cached || secondEntry.cached {
		t.Fatalf("cache flags first=%t second=%t, want first cached and second uncached", firstEntry.cached, secondEntry.cached)
	}

	releaseSecond()
	if closed != 1 {
		t.Fatalf("closed after overflow release = %d, want 1", closed)
	}
	releaseFirst()
	if manager.clients[1001] != firstEntry {
		t.Fatal("active cached entry was evicted")
	}
}

func TestCraneCtldClientManagerEvictsLeastRecentlyUsedEntry(t *testing.T) {
	manager := newTestClientManager(t)
	manager.maxEntries = 2
	now := time.Unix(1_000, 0)
	manager.now = func() time.Time { return now }
	config := &CraneConfig{TLS: TLSConfig{Enabled: true}}

	acquireAndReleaseTestClient(t, manager, config, 1001)
	now = now.Add(time.Minute)
	acquireAndReleaseTestClient(t, manager, config, 1002)
	now = now.Add(time.Minute)
	acquireAndReleaseTestClient(t, manager, config, 1001)
	now = now.Add(time.Minute)
	acquireAndReleaseTestClient(t, manager, config, 1003)

	if _, ok := manager.clients[1002]; ok {
		t.Fatal("least recently used UID 1002 was not evicted")
	}
	if manager.clients[1001] == nil || manager.clients[1003] == nil {
		t.Fatal("expected recently used clients to remain cached")
	}
}

func TestCraneCtldClientManagerRemovesIdleEntry(t *testing.T) {
	manager := newTestClientManager(t)
	manager.idleTimeout = 30 * time.Minute
	now := time.Unix(1_000, 0)
	manager.now = func() time.Time { return now }
	closed := 0
	manager.closeConn = func(conn *grpc.ClientConn) error {
		closed++
		return conn.Close()
	}
	config := &CraneConfig{TLS: TLSConfig{Enabled: true}}

	acquireAndReleaseTestClient(t, manager, config, 1001)
	now = now.Add(31 * time.Minute)
	manager.cleanupIdleEntries()

	if manager.clients[1001] != nil || closed != 1 {
		t.Fatalf("idle client still cached or not closed: cached=%t closed=%d", manager.clients[1001] != nil, closed)
	}
}

func TestCallWithUserCraneCtldClientRetriesUnauthenticated(t *testing.T) {
	manager := newTestClientManager(t)
	created := 0
	manager.newClient = func(*CraneConfig, string, *uint32) (craneProtos.CraneCtldClient, *grpc.ClientConn, error) {
		created++
		return &stubCraneCtldClient{}, newTestClientConn(t), nil
	}
	config := &CraneConfig{TLS: TLSConfig{Enabled: true}}
	calls := 0

	result, err := callWithUserCraneCtldClient(manager, config, 1001, func(craneProtos.CraneCtldClient) (string, error) {
		calls++
		if calls == 1 {
			return "", status.Error(codes.Unauthenticated, "certificate expired")
		}
		return "ok", nil
	})
	if err != nil {
		t.Fatalf("call after certificate reload: %v", err)
	}
	if result != "ok" || calls != 2 || created != 2 {
		t.Fatalf("result=%q calls=%d created=%d, want ok/2/2", result, calls, created)
	}
}

func TestCraneCtldClientManagerReleaseIsIdempotent(t *testing.T) {
	manager := newTestClientManager(t)
	closed := 0
	manager.closeConn = func(conn *grpc.ClientConn) error {
		closed++
		return conn.Close()
	}
	release := func() {}
	_, _, release, err := manager.acquire(&CraneConfig{TLS: TLSConfig{Enabled: true}}, 1001)
	if err != nil {
		t.Fatal(err)
	}
	release()
	release()
	if closed != 0 {
		t.Fatalf("cached connection closed after release: %d", closed)
	}
}

func TestCraneCtldClientManagerPropagatesUserLookupError(t *testing.T) {
	manager := newCraneCtldClientManager()
	manager.lookupUser = func(string) (*user.User, error) {
		return nil, os.ErrNotExist
	}
	_, _, _, err := manager.acquire(&CraneConfig{TLS: TLSConfig{Enabled: true}}, 1001)
	if err == nil {
		t.Fatal("expected user lookup error")
	}
}

func TestCraneCtldClientManagerDoesNotCacheWhenMaxEntriesDisabled(t *testing.T) {
	manager := newTestClientManager(t)
	manager.maxEntries = 0
	closed := 0
	manager.closeConn = func(conn *grpc.ClientConn) error {
		closed++
		return conn.Close()
	}
	client, _, release, err := manager.acquire(&CraneConfig{TLS: TLSConfig{Enabled: true}}, 1001)
	if err != nil || client == nil {
		t.Fatalf("acquire uncached client: client=%v err=%v", client, err)
	}
	release()
	if closed != 1 {
		t.Fatalf("uncached connection close count=%d, want 1", closed)
	}
	if len(manager.clients) != 0 {
		t.Fatalf("uncached client was inserted into cache")
	}
}

func TestCraneCtldClientManagerCleanerCanStartAndStopOnce(t *testing.T) {
	manager := newTestClientManager(t)
	manager.startCleaner(time.Hour)
	manager.startCleaner(time.Hour)
	manager.stopCleaner()
	manager.stopCleaner()
	if manager.cleanupStop != nil || manager.cleanupDone != nil {
		t.Fatal("cleaner state was not reset after stop")
	}
}

func newTestClientManager(t *testing.T) *craneCtldClientManager {
	t.Helper()
	manager := newCraneCtldClientManager()
	manager.lookupUser = func(uid string) (*user.User, error) {
		return &user.User{Uid: uid, HomeDir: filepath.Join("/users", uid)}, nil
	}
	manager.fingerprintCert = func(certDir string) (string, error) {
		return "certificate-" + filepath.Base(filepath.Dir(certDir)), nil
	}
	manager.newClient = func(_ *CraneConfig, _ string, expectedUID *uint32) (craneProtos.CraneCtldClient, *grpc.ClientConn, error) {
		return &stubCraneCtldClient{}, newTestClientConn(t), nil
	}
	return manager
}

func newTestClientConn(t *testing.T) *grpc.ClientConn {
	t.Helper()
	conn, err := grpc.NewClient("passthrough:///unused-"+strconv.FormatInt(time.Now().UnixNano(), 10),
		grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("create test gRPC connection: %v", err)
	}
	return conn
}

func acquireAndReleaseTestClient(
	t *testing.T,
	manager *craneCtldClientManager,
	config *CraneConfig,
	uid uint32,
) {
	t.Helper()
	_, _, release, err := manager.acquire(config, uid)
	if err != nil {
		t.Fatalf("acquire client for UID %d: %v", uid, err)
	}
	release()
}

func newTestCertificate(t *testing.T, commonName string) tls.Certificate {
	t.Helper()
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	now := time.Now()
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: commonName},
		NotBefore:    now.Add(-time.Minute),
		NotAfter:     now.Add(time.Hour),
	}
	raw, err := x509.CreateCertificate(rand.Reader, template, template, publicKey, privateKey)
	if err != nil {
		t.Fatalf("create certificate: %v", err)
	}
	return tls.Certificate{Certificate: [][]byte{raw}, PrivateKey: privateKey}
}
