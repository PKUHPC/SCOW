package cmd

import (
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
