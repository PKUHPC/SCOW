package cmd

import (
	"encoding/json"
	"net/url"
	"testing"
)

func TestBuildShellWebSocketURLIncludesBasePath(t *testing.T) {
	baseURL, err := parseBaseURL("https://scow.example.com/scow")
	if err != nil {
		t.Fatal(err)
	}

	query := url.Values{}
	query.Set("cluster", "hpc01")

	wsURL := buildShellWebSocketURL(baseURL, "wss", query)
	got := wsURL.String()
	want := "wss://scow.example.com/scow/api/shell?cluster=hpc01"
	if got != want {
		t.Fatalf("buildShellWebSocketURL() = %q, want %q", got, want)
	}
}

func TestBuildShellWebSocketURLWithRootBasePath(t *testing.T) {
	baseURL, err := parseBaseURL("http://scow.example.com")
	if err != nil {
		t.Fatal(err)
	}

	wsURL := buildShellWebSocketURL(baseURL, "ws", nil)
	got := wsURL.String()
	want := "ws://scow.example.com/api/shell"
	if got != want {
		t.Fatalf("buildShellWebSocketURL() = %q, want %q", got, want)
	}
}

func TestLoginNodeUnmarshalSupportsI18nName(t *testing.T) {
	data := []byte(`{
		"name": {
			"i18n": {
				"default": "login-default",
				"zh_cn": "登录节点"
			}
		},
		"address": "10.129.227.94"
	}`)

	var node loginNode
	if err := json.Unmarshal(data, &node); err != nil {
		t.Fatal(err)
	}

	if node.Address != "10.129.227.94" {
		t.Fatalf("address = %q, want %q", node.Address, "10.129.227.94")
	}
	if got := node.DisplayName(); got != "login-default" {
		t.Fatalf("DisplayName() = %q, want %q", got, "login-default")
	}
}

func TestLoginNodeUnmarshalSupportsLegacyString(t *testing.T) {
	var node loginNode
	if err := json.Unmarshal([]byte(`"10.129.227.94"`), &node); err != nil {
		t.Fatal(err)
	}

	if node.Address != "10.129.227.94" {
		t.Fatalf("address = %q, want %q", node.Address, "10.129.227.94")
	}
	if got := node.DisplayName(); got != "10.129.227.94" {
		t.Fatalf("DisplayName() = %q, want %q", got, "10.129.227.94")
	}
}
