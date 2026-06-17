package cmd

import (
	"bytes"
	"io"
	"net/http"
	"regexp"
	"strings"
	"testing"
)

func TestCollectAPIListEntries(t *testing.T) {
	entries := collectAPIListEntries([]cachedOpenAPISystem{
		{
			Name:    "portal",
			BaseURL: "https://scow.example.com",
			Spec: openAPISpec{
				Paths: map[string]map[string]apiRoute{
					"/api/b": {
						"post": {Description: "Create b\nwith more details"},
					},
					"/api/a": {
						"get": {Summary: "Get a"},
					},
				},
			},
		},
		{
			Name:    "ai",
			BaseURL: "https://scow.example.com/ai/api",
			Spec: openAPISpec{
				Paths: map[string]map[string]apiRoute{
					"/authInfo": {
						"get": {Summary: "Get auth info"},
					},
				},
			},
		},
	})

	if len(entries) != 3 {
		t.Fatalf("entries length = %d, want 3", len(entries))
	}

	if entries[0].method != "GET" || entries[0].path != "/ai/api/authInfo" || entries[0].summary != "Get auth info" {
		t.Fatalf("unexpected first entry: %+v", entries[0])
	}

	if entries[1].method != "GET" || entries[1].path != "/api/a" || entries[1].summary != "Get a" {
		t.Fatalf("unexpected second entry: %+v", entries[1])
	}

	if entries[2].method != "POST" || entries[2].path != "/api/b" || entries[2].summary != "Create b" {
		t.Fatalf("unexpected third entry: %+v", entries[2])
	}
}

func TestFormatAPIList(t *testing.T) {
	output := formatAPIList([]apiListEntry{
		{system: "portal", method: "GET", path: "/api/a", summary: "Get a"},
	})

	if !strings.Contains(output, "[portal]") {
		t.Fatalf("output missing system header: %q", output)
	}
	if !strings.Contains(output, "GET") || !strings.Contains(output, "/api/a") || !strings.Contains(output, "Get a") {
		t.Fatalf("output missing API entry: %q", output)
	}
}

func TestAPICommandHelpIncludesParameterForms(t *testing.T) {
	var output bytes.Buffer
	apiCmd.SetOut(&output)
	apiCmd.SetErr(&output)
	t.Cleanup(func() {
		apiCmd.SetOut(nil)
		apiCmd.SetErr(nil)
	})

	if err := apiCmd.Help(); err != nil {
		t.Fatal(err)
	}

	help := output.String()
	for _, want := range []string{
		"Parameters use key=value syntax",
		"customAttributes.CODE_SERVER_VERSION=4.105.1",
		"ids=1 ids=2",
		`names='["alice","bob"]'`,
		`items='[{"id":"item1"},{"id":"item2"}]'`,
		"?ids=1&ids=2",
		"For non-array parameters repeated keys use the last value",
		"--body",
		`--body '{"name":"test","ids":[1,2]}'`,
		"must not provide request body fields",
	} {
		if !strings.Contains(help, want) {
			t.Fatalf("api help missing %q:\n%s", want, help)
		}
	}
}

func TestFindAPIRouteUsesDisplayPath(t *testing.T) {
	route, err := findAPIRoute([]cachedOpenAPISystem{
		{
			Name:    "ai",
			BaseURL: "https://scow.example.com/ai/api",
			Spec: openAPISpec{
				Paths: map[string]map[string]apiRoute{
					"/authInfo": {
						"get": {Summary: "Get auth info"},
					},
				},
			},
		},
	}, "GET", "/ai/api/authInfo")
	if err != nil {
		t.Fatal(err)
	}

	if route.path != "/authInfo" {
		t.Fatalf("matched raw path = %q, want /authInfo", route.path)
	}
}

func TestFormatAPIHelp(t *testing.T) {
	help := formatAPIHelp(&matchedAPIRoute{
		system: cachedOpenAPISystem{
			Name:    "ai",
			BaseURL: "https://scow.example.com/ai/api",
		},
		path:   "/jobs/{id}",
		method: "post",
		route: apiRoute{
			Summary: "Create job",
			Parameters: []apiParameter{
				{Name: "id", In: "path", Required: true, Schema: map[string]any{"type": "string"}},
				{Name: "verbose", In: "query", Schema: map[string]any{"type": "boolean"}},
			},
			RequestBody: &apiRequestBody{
				Content: map[string]apiRequestBodyItem{
					"application/json": {
						Schema: map[string]any{
							"required": []any{"name"},
							"properties": map[string]any{
								"name": map[string]any{"type": "string"},
							},
						},
					},
				},
			},
		},
	})

	for _, want := range []string{
		"POST /ai/api/jobs/{id}",
		"Create job",
		"id (required)  string",
		"verbose (optional)  boolean",
		"name (required)  string",
	} {
		if !strings.Contains(help, want) {
			t.Fatalf("help missing %q:\n%s", want, help)
		}
	}
}

func TestWriteResponseSuccessPrintsBodyOnly(t *testing.T) {
	var output bytes.Buffer
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Status:     "200 OK",
		Body:       io.NopCloser(strings.NewReader(`{"ok":true}`)),
	}

	if err := writeResponse(&output, resp, responseOutputOptions{}); err != nil {
		t.Fatal(err)
	}

	if got, want := output.String(), "{\"ok\":true}\n"; got != want {
		t.Fatalf("output = %q, want %q", got, want)
	}
}

func TestWriteResponseFailurePrintsStatusAndBody(t *testing.T) {
	var output bytes.Buffer
	resp := &http.Response{
		StatusCode: http.StatusBadRequest,
		Status:     "400 Bad Request",
		Body:       io.NopCloser(strings.NewReader(`{"error":"bad request"}`)),
	}

	err := writeResponse(&output, resp, responseOutputOptions{})
	if err == nil {
		t.Fatal("expected error")
	}

	wantOutput := "HTTP 400 Bad Request\n{\"error\":\"bad request\"}\n"
	if got := output.String(); got != wantOutput {
		t.Fatalf("output = %q, want %q", got, wantOutput)
	}

	if !strings.Contains(err.Error(), "400 Bad Request") {
		t.Fatalf("error missing status: %v", err)
	}
}

func TestWriteResponsePrettyPrintsJSON(t *testing.T) {
	var output bytes.Buffer
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Status:     "200 OK",
		Body:       io.NopCloser(strings.NewReader(`{"ok":true,"items":[1,"a"]}`)),
	}

	if err := writeResponse(&output, resp, responseOutputOptions{pretty: true}); err != nil {
		t.Fatal(err)
	}

	outputString := output.String()
	plainOutput := regexp.MustCompile(`\x1b\[[0-9;]*m`).ReplaceAllString(outputString, "")
	for _, want := range []string{
		"{\n",
		"  ",
		"\"ok\"",
		"\"items\"",
		"\"a\"",
	} {
		if !strings.Contains(plainOutput, want) {
			t.Fatalf("pretty output missing %q:\n%q", want, outputString)
		}
	}

	for _, want := range []string{
		"\x1b[",
	} {
		if !strings.Contains(outputString, want) {
			t.Fatalf("pretty output missing %q:\n%q", want, outputString)
		}
	}
}
