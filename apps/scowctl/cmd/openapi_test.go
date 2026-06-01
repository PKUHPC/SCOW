package cmd

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRefreshOpenAPICacheDownloadsAvailableSystems(t *testing.T) {
	configDir := t.TempDir()
	oldUserConfigDir := userConfigDir
	userConfigDir = func() (string, error) {
		return configDir, nil
	}
	t.Cleanup(func() {
		userConfigDir = oldUserConfigDir
	})

	oldHTTPClient := httpClient
	httpClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if got := r.Header.Get("x-scow-api-auth-token"); got != "token-value" {
			t.Fatalf("OpenAPI auth header = %q, want token-value", got)
		}
		if got := r.Header.Get("x-scow-user-id"); got != "" {
			t.Fatalf("OpenAPI user header = %q, want empty", got)
		}
		if r.URL.Path == "/meta/api/openapi.json" {
			return &http.Response{
				StatusCode: http.StatusOK,
				Status:     "200 OK",
				Body:       io.NopCloser(strings.NewReader(`{"openapi":"3.1.0","paths":{"/api/test":{"get":{"parameters":[{"name":"name","in":"query","required":true}]}}},"x-scow-sources":[{"name":"portal","url":"http://portal-web:3000/api/openapi.json","ok":true}]}`)),
				Header:     http.Header{"Content-Type": []string{"application/json"}},
			}, nil
		}

		return &http.Response{
			StatusCode: http.StatusNotFound,
			Status:     "404 Not Found",
			Body:       io.NopCloser(strings.NewReader("")),
			Header:     http.Header{},
		}, nil
	})}
	t.Cleanup(func() {
		httpClient = oldHTTPClient
	})

	if err := saveLoginProfile("https://scow.example.com", "token-value", "user1", "", ""); err != nil {
		t.Fatal(err)
	}

	current, err := getCurrentProfile()
	if err != nil {
		t.Fatal(err)
	}

	if err := refreshOpenAPICache(context.Background(), current, refreshOpenAPIOptions{}); err != nil {
		t.Fatal(err)
	}

	cachePath := filepath.Join(configDir, configDirName, openAPICacheDirName, defaultProfileName, "meta.json")
	cached, err := readCachedOpenAPIForTest(cachePath)
	if err != nil {
		t.Fatal(err)
	}

	if cached.Name != metaSystemName {
		t.Fatalf("cached system = %q, want meta", cached.Name)
	}
	if cached.BaseURL != "https://scow.example.com" {
		t.Fatalf("cached base url = %q, want https://scow.example.com", cached.BaseURL)
	}
	if _, ok := cached.Spec.Paths["/api/test"]; !ok {
		t.Fatal("cached OpenAPI missing /api/test")
	}
}

func TestRefreshOpenAPICacheFailsWhenMetadataOpenAPIUnavailable(t *testing.T) {
	configDir := t.TempDir()
	oldUserConfigDir := userConfigDir
	userConfigDir = func() (string, error) {
		return configDir, nil
	}
	t.Cleanup(func() {
		userConfigDir = oldUserConfigDir
	})

	oldHTTPClient := httpClient
	httpClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path == "/meta/api/openapi.json" {
			return &http.Response{
				StatusCode: http.StatusNotFound,
				Status:     "404 Not Found",
				Body:       io.NopCloser(strings.NewReader("")),
				Header:     http.Header{},
			}, nil
		}

		t.Fatalf("unexpected fallback OpenAPI request to %s", r.URL.Path)
		return nil, nil
	})}
	t.Cleanup(func() {
		httpClient = oldHTTPClient
	})

	if err := saveLoginProfile("https://scow.example.com", "token-value", "user1", "", ""); err != nil {
		t.Fatal(err)
	}

	current, err := getCurrentProfile()
	if err != nil {
		t.Fatal(err)
	}

	err = refreshOpenAPICache(context.Background(), current, refreshOpenAPIOptions{})
	if err == nil {
		t.Fatal("refreshOpenAPICache() succeeded, want error")
	}
	if !strings.Contains(err.Error(), "download merged OpenAPI from meta-server") {
		t.Fatalf("refreshOpenAPICache() error = %q, want meta-server error", err.Error())
	}
}

func readCachedOpenAPIForTest(path string) (*cachedOpenAPISystem, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cached cachedOpenAPISystem
	if err := json.Unmarshal(content, &cached); err != nil {
		return nil, err
	}

	return &cached, nil
}

func TestRefreshOpenAPICacheUsesStaticAPIAuth(t *testing.T) {
	configDir := t.TempDir()
	oldUserConfigDir := userConfigDir
	userConfigDir = func() (string, error) {
		return configDir, nil
	}
	t.Cleanup(func() {
		userConfigDir = oldUserConfigDir
	})

	oldHTTPClient := httpClient
	httpClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if got := r.Header.Get("x-scow-api-auth-token"); got != "secret-value" {
			t.Fatalf("OpenAPI auth header = %q, want secret-value", got)
		}
		if got := r.Header.Get("x-scow-user-id"); got != "api-user" {
			t.Fatalf("OpenAPI user header = %q, want api-user", got)
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

	if err := saveLoginProfile("https://scow.example.com", "token-value", "user1", "secret-value", "api-user"); err != nil {
		t.Fatal(err)
	}

	current, err := getCurrentProfile()
	if err != nil {
		t.Fatal(err)
	}

	if err := refreshOpenAPICache(context.Background(), current, refreshOpenAPIOptions{}); err != nil {
		t.Fatal(err)
	}
}

func TestBuildAPIRequest(t *testing.T) {
	route := &matchedAPIRoute{
		system: cachedOpenAPISystem{
			BaseURL:  "https://scow.example.com/mis",
			BasePath: "/mis",
		},
		path:   "/mis/api/users/{id}",
		method: "post",
		route: apiRoute{
			Parameters: []apiParameter{
				{Name: "id", In: "path", Required: true},
				{Name: "verbose", In: "query"},
				{Name: "x-custom", In: "header"},
			},
			RequestBody: &apiRequestBody{
				Content: map[string]apiRequestBodyItem{
					"application/json": {
						Schema: map[string]any{
							"properties": map[string]any{
								"name":      map[string]any{"type": "string"},
								"coreCount": map[string]any{"type": "number"},
								"customAttributes": map[string]any{
									"type":                 "object",
									"additionalProperties": map[string]any{"type": "string"},
								},
							},
						},
					},
				},
			},
		},
	}

	request, err := buildAPIRequest(context.Background(), &namedProfile{profile: profile{Token: "token-value"}}, route, map[string]string{
		"id":                                   "user 1",
		"verbose":                              "true",
		"x-custom":                             "header-value",
		"name":                                 "Alice",
		"coreCount":                            "1",
		"customAttributes.CODE_SERVER_VERSION": "4.105.1",
		"customAttributes.sbatchOptions":       "",
	})
	if err != nil {
		t.Fatal(err)
	}

	wantURL := "https://scow.example.com/mis/api/users/user%201?verbose=true"
	if got := request.URL.String(); got != wantURL {
		t.Fatalf("request URL = %q, want %q", got, wantURL)
	}
	if got := request.Header.Get("x-scow-api-auth-token"); got != "token-value" {
		t.Fatalf("auth header = %q, want token-value", got)
	}
	if got := request.Header.Get("x-scow-user-id"); got != "" {
		t.Fatalf("user header = %q, want empty", got)
	}
	if got := request.Header.Get("x-custom"); got != "header-value" {
		t.Fatalf("custom header = %q, want header-value", got)
	}

	body, err := io.ReadAll(request.Body)
	if err != nil {
		t.Fatal(err)
	}

	var gotBody map[string]any
	if err := json.Unmarshal(body, &gotBody); err != nil {
		t.Fatal(err)
	}

	if gotBody["coreCount"] != float64(1) {
		t.Fatalf("coreCount = %#v, want 1", gotBody["coreCount"])
	}
	customAttributes, ok := gotBody["customAttributes"].(map[string]any)
	if !ok {
		t.Fatalf("customAttributes = %#v, want object", gotBody["customAttributes"])
	}
	if customAttributes["CODE_SERVER_VERSION"] != "4.105.1" {
		t.Fatalf("CODE_SERVER_VERSION = %#v, want 4.105.1", customAttributes["CODE_SERVER_VERSION"])
	}
	if customAttributes["sbatchOptions"] != "" {
		t.Fatalf("sbatchOptions = %#v, want empty string", customAttributes["sbatchOptions"])
	}
}

func TestBuildAPIRequestUsesStaticAPIAuth(t *testing.T) {
	route := &matchedAPIRoute{
		system: cachedOpenAPISystem{BaseURL: "https://scow.example.com"},
		path:   "/api/test",
		method: "get",
	}

	request, err := buildAPIRequest(context.Background(), &namedProfile{profile: profile{
		Token:      "token-value",
		AuthSecret: "secret-value",
		AuthUser:   "api-user",
	}}, route, nil)
	if err != nil {
		t.Fatal(err)
	}

	if got := request.Header.Get("x-scow-api-auth-token"); got != "secret-value" {
		t.Fatalf("auth header = %q, want secret-value", got)
	}
	if got := request.Header.Get("x-scow-user-id"); got != "api-user" {
		t.Fatalf("user header = %q, want api-user", got)
	}
}

func TestCreateOpenAPICacheDirUsesProfileName(t *testing.T) {
	configDir := t.TempDir()
	oldUserConfigDir := userConfigDir
	userConfigDir = func() (string, error) {
		return configDir, nil
	}
	t.Cleanup(func() {
		userConfigDir = oldUserConfigDir
	})

	got, err := createOpenAPICacheDir("dev/profile")
	if err != nil {
		t.Fatal(err)
	}

	want := filepath.Join(configDir, configDirName, openAPICacheDirName, "dev_profile")
	if got != want {
		t.Fatalf("cache dir = %q, want %q", got, want)
	}
}

func TestBuildAPIRequestURLWithServerAPIBase(t *testing.T) {
	route := &matchedAPIRoute{
		system: cachedOpenAPISystem{
			BaseURL:  "https://scow.example.com/scow/ai/api",
			BasePath: "/ai",
		},
		path:   "/jobs",
		method: "get",
	}

	got, err := buildAPIRequestURL(route, nil)
	if err != nil {
		t.Fatal(err)
	}

	want := "https://scow.example.com/scow/ai/api/jobs"
	if got != want {
		t.Fatalf("buildAPIRequestURL() = %q, want %q", got, want)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}
