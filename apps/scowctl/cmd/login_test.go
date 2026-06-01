package cmd

import (
	"context"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildAuthURL(t *testing.T) {
	tests := []struct {
		name        string
		baseURL     string
		callbackURL string
		want        string
	}{
		{
			name:        "root base url",
			baseURL:     "https://scow.example.com",
			callbackURL: "http://127.0.0.1:1234/callback",
			want:        "https://scow.example.com/auth/public/auth?callbackUrl=http%3A%2F%2F127.0.0.1%3A1234%2Fcallback",
		},
		{
			name:        "base path",
			baseURL:     "https://scow.example.com/scow",
			callbackURL: "http://127.0.0.1:1234/callback",
			want:        "https://scow.example.com/scow/auth/public/auth?callbackUrl=http%3A%2F%2F127.0.0.1%3A1234%2Fcallback",
		},
		{
			name:        "auth base url",
			baseURL:     "https://scow.example.com/scow/auth",
			callbackURL: "http://127.0.0.1:1234/callback",
			want:        "https://scow.example.com/scow/auth/public/auth?callbackUrl=http%3A%2F%2F127.0.0.1%3A1234%2Fcallback",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			baseURL, err := parseBaseURL(tt.baseURL)
			if err != nil {
				t.Fatal(err)
			}

			if got := buildAuthURL(baseURL, tt.callbackURL); got != tt.want {
				t.Fatalf("buildAuthURL() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestBuildValidateTokenURL(t *testing.T) {
	baseURL, err := parseBaseURL("https://scow.example.com/scow")
	if err != nil {
		t.Fatal(err)
	}

	got := buildValidateTokenURL(baseURL, "token-value")
	want := "https://scow.example.com/scow/auth/public/validateToken?token=token-value"
	if got != want {
		t.Fatalf("buildValidateTokenURL() = %q, want %q", got, want)
	}
}

func TestParseBaseURLRequiresSchemeAndHost(t *testing.T) {
	if _, err := parseBaseURL("http://"); err == nil {
		t.Fatal("parseBaseURL() succeeded, want error")
	}
}

func TestParseBaseURLDefaultsToHTTP(t *testing.T) {
	got, err := parseBaseURL("scow.example.com/scow")
	if err != nil {
		t.Fatal(err)
	}

	want := "http://scow.example.com/scow"
	if got.String() != want {
		t.Fatalf("parseBaseURL() = %q, want %q", got.String(), want)
	}
}

func TestNormalizeLoginAuthOptionsRequiresSecretAndUserTogether(t *testing.T) {
	tests := []struct {
		name    string
		opts    loginOptions
		wantErr bool
	}{
		{name: "neither"},
		{name: "both", opts: loginOptions{authSecret: "secret", authUser: "user"}},
		{name: "secret only", opts: loginOptions{authSecret: "secret"}, wantErr: true},
		{name: "user only", opts: loginOptions{authUser: "user"}, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, err := normalizeLoginAuthOptions(tt.opts)
			if tt.wantErr && err == nil {
				t.Fatal("normalizeLoginAuthOptions() succeeded, want error")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("normalizeLoginAuthOptions() error = %v", err)
			}
		})
	}
}

func TestRunLoginWithStaticAuthSkipsBrowserAndSavesProfile(t *testing.T) {
	configDir := t.TempDir()
	oldUserConfigDir := userConfigDir
	userConfigDir = func() (string, error) {
		return configDir, nil
	}
	t.Cleanup(func() {
		userConfigDir = oldUserConfigDir
	})

	oldOpenBrowser := openBrowser
	openBrowser = func(url string) error {
		t.Fatalf("openBrowser() called with %s", url)
		return nil
	}
	t.Cleanup(func() {
		openBrowser = oldOpenBrowser
	})

	oldHTTPClient := httpClient
	httpClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path != "/meta/api/openapi.json" {
			t.Fatalf("unexpected request path = %q, want /meta/api/openapi.json", r.URL.Path)
		}
		if got := r.Header.Get("x-scow-api-auth-token"); got != "secret-value" {
			t.Fatalf("auth header = %q, want secret-value", got)
		}
		if got := r.Header.Get("x-scow-user-id"); got != "api-user" {
			t.Fatalf("user header = %q, want api-user", got)
		}

		return &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Body:       io.NopCloser(strings.NewReader(`{"openapi":"3.1.0","paths":{"/api/test":{"get":{}}}}`)),
			Header:     http.Header{"Content-Type": []string{"application/json"}},
		}, nil
	})}
	t.Cleanup(func() {
		httpClient = oldHTTPClient
	})

	err := runLogin(context.Background(), "https://scow.example.com", loginOptions{
		authSecret: "secret-value",
		authUser:   "api-user",
	})
	if err != nil {
		t.Fatal(err)
	}

	current, err := getCurrentProfile()
	if err != nil {
		t.Fatal(err)
	}

	if current.Token != "" {
		t.Fatalf("token = %q, want empty", current.Token)
	}
	if current.IdentityID != "api-user" {
		t.Fatalf("identityId = %q, want api-user", current.IdentityID)
	}
	if current.AuthSecret != "secret-value" {
		t.Fatalf("authSecret = %q, want secret-value", current.AuthSecret)
	}
	if current.AuthUser != "api-user" {
		t.Fatalf("authUser = %q, want api-user", current.AuthUser)
	}

	wantCache := filepath.Join(configDir, configDirName, openAPICacheDirName, defaultProfileName)
	if current.OpenAPICache != wantCache {
		t.Fatalf("openapiCache = %q, want %q", current.OpenAPICache, wantCache)
	}

	cachePath := filepath.Join(wantCache, "meta.json")
	cached, err := readCachedOpenAPIForTest(cachePath)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := cached.Spec.Paths["/api/test"]; !ok {
		t.Fatal("cached OpenAPI missing /api/test")
	}
}
