package filesystem

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sirupsen/logrus"
)

func TestPacificLoginDoesNotLogCredentials(t *testing.T) {
	const password = "test-password-secret"
	const authToken = "test-auth-token-secret"
	const csrfToken = "test-csrf-token-secret"
	response := fmt.Sprintf(`{"data":{"x_auth_token":%q,"x_csrf_token":%q},"password":%q}`, authToken, csrfToken, password)

	for _, test := range []struct {
		name    string
		status  int
		body    string
		wantErr bool
	}{
		{name: "success", status: http.StatusOK, body: response},
		{name: "unauthorized", status: http.StatusUnauthorized, body: response, wantErr: true},
		{name: "malformed response", status: http.StatusOK, body: response + "invalid", wantErr: true},
		{
			name: "invalid token type", status: http.StatusOK, wantErr: true,
			body: fmt.Sprintf(`{"data":{"x_auth_token":{"%s":%q},"x_csrf_token":%q}}`, password, authToken, csrfToken),
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			var output bytes.Buffer
			logger := logrus.New()
			logger.SetLevel(logrus.DebugLevel)
			logger.SetOutput(&output)
			// 同时捕获全局 logger，防止错误分支绕过适配器 logger 泄露响应。
			previousOutput := logrus.StandardLogger().Out
			logrus.SetOutput(&output)
			t.Cleanup(func() { logrus.SetOutput(previousOutput) })

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				if req.Method != http.MethodPost || req.URL.Path != "/api/v2/aa/sessions" {
					t.Error("unexpected authentication request")
				}
				var payload map[string]string
				if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
					t.Error("invalid authentication payload")
				}
				if payload["user_name"] != "storage-admin" || payload["password"] != password || payload["scope"] != "0" {
					t.Error("authentication payload changed")
				}
				w.WriteHeader(test.status)
				_, _ = w.Write([]byte(test.body))
			}))
			defer server.Close()
			adapter := &PacificAdapter{
				Username: "storage-admin", Password: password,
				BaseURL: server.URL, HttpClient: server.Client(), logger: logrus.NewEntry(logger),
			}
			err := adapter.Login()
			if (err != nil) != test.wantErr {
				t.Fatalf("unexpected login outcome: success=%v", err == nil)
			}
			if !test.wantErr {
				req, err := http.NewRequest(http.MethodGet, server.URL, nil)
				if err != nil {
					t.Fatal(err)
				}
				adapter.setAuthHeaders(req)
				if req.Header.Get("X-Auth-Token") != authToken || req.Header.Get("X_CSRF_Token") != csrfToken {
					t.Error("authentication tokens were not preserved")
				}
			}
			for _, secret := range []string{password, authToken, csrfToken} {
				if strings.Contains(output.String(), secret) || (err != nil && strings.Contains(err.Error(), secret)) {
					t.Error("credentials leaked into logs or returned error")
				}
			}
			for _, field := range []string{"request_payload", "response_body"} {
				if strings.Contains(output.String(), field) {
					t.Errorf("authentication log contains raw payload field %s", field)
				}
			}
			if !strings.Contains(output.String(), "status_code=200") && !strings.Contains(output.String(), "status_code=401") {
				t.Error("authentication logs must retain the HTTP status code")
			}
		})
	}
}
