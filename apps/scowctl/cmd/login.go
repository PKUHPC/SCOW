package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

const loginCallbackPath = "/callback"

var openBrowser = openURL

var loginCmd = &cobra.Command{
	Use:   "login <scow-base-url>",
	Short: "Log in to SCOW",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		verbose, err := cmd.Flags().GetBool("verbose")
		if err != nil {
			return err
		}
		authSecret, err := cmd.Flags().GetString("auth-secret")
		if err != nil {
			return err
		}
		authUser, err := cmd.Flags().GetString("auth-user")
		if err != nil {
			return err
		}

		return runLogin(cmd.Context(), args[0], loginOptions{
			verbose:    verbose,
			authSecret: authSecret,
			authUser:   authUser,
		})
	},
}

type loginOptions struct {
	verbose    bool
	authSecret string
	authUser   string
}

type loginResult struct {
	token string
	err   error
}

type validateTokenResponse struct {
	IdentityID string `json:"identityId"`
}

func init() {
	loginCmd.Flags().Bool("verbose", false, "show OpenAPI discovery details")
	loginCmd.Flags().String("auth-secret", "", "static secret string used when calling SCOW APIs")
	loginCmd.Flags().String("auth-user", "", "user ID used with --auth-secret when calling SCOW APIs")
}

func runLogin(ctx context.Context, scowBaseURL string, opts loginOptions) error {
	baseURL, err := parseBaseURL(scowBaseURL)
	if err != nil {
		return err
	}
	authSecret, authUser, err := normalizeLoginAuthOptions(opts)
	if err != nil {
		return err
	}

	if authSecret != "" {
		return runStaticAuthLogin(ctx, baseURL, authSecret, authUser, opts)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return fmt.Errorf("listen callback server: %w", err)
	}
	defer listener.Close()

	callbackURL := (&url.URL{
		Scheme: "http",
		Host:   listener.Addr().String(),
		Path:   loginCallbackPath,
	}).String()

	authURL := buildAuthURL(baseURL, callbackURL)

	resultCh := make(chan loginResult, 1)
	server := newCallbackServer(resultCh)

	serverErrCh := make(chan error, 1)
	go func() {
		if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrCh <- err
		}
		close(serverErrCh)
	}()

	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	fmt.Printf("Opening browser for SCOW login: %s\n", authURL)
	if err := openBrowser(authURL); err != nil {
		fmt.Printf("Failed to open browser automatically: %v\nOpen this URL manually: %s\n", err, authURL)
	}

	select {
	case result := <-resultCh:
		if result.err != nil {
			return result.err
		}

		user, err := validateToken(ctx, baseURL, result.token)
		if err != nil {
			return err
		}

		if err := saveLoginProfile(baseURL.String(), result.token, user.IdentityID, authSecret, authUser); err != nil {
			return err
		}

		if err := refreshOpenAPICache(ctx, &namedProfile{
			Name: defaultProfileName,
			profile: profile{
				BaseURL:    baseURL.String(),
				Token:      result.token,
				IdentityID: user.IdentityID,
				AuthSecret: authSecret,
				AuthUser:   authUser,
			},
		}, refreshOpenAPIOptions{verbose: opts.verbose}); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to refresh OpenAPI cache: %v\n", err)
		}

		fmt.Printf("Logged in as %s\n", user.IdentityID)
		return nil
	case err := <-serverErrCh:
		if err != nil {
			return fmt.Errorf("callback server failed: %w", err)
		}
		return errors.New("callback server stopped before login completed")
	case <-ctx.Done():
		return ctx.Err()
	}
}

func runStaticAuthLogin(ctx context.Context, baseURL *url.URL, authSecret string, authUser string, opts loginOptions) error {
	current := &namedProfile{
		Name: defaultProfileName,
		profile: profile{
			BaseURL:    baseURL.String(),
			IdentityID: authUser,
			AuthSecret: authSecret,
			AuthUser:   authUser,
		},
	}

	cacheDir, err := refreshOpenAPICacheFiles(ctx, current, refreshOpenAPIOptions{verbose: opts.verbose})
	if err != nil {
		return fmt.Errorf("static API auth test failed: %w", err)
	}

	if err := saveLoginProfile(baseURL.String(), "", authUser, authSecret, authUser); err != nil {
		return err
	}

	if err := updateCurrentProfile(func(current *profile) {
		current.OpenAPICache = cacheDir
	}); err != nil {
		return err
	}

	fmt.Printf("Static API auth verified as %s\n", authUser)
	return nil
}

func normalizeLoginAuthOptions(opts loginOptions) (string, string, error) {
	authSecret := strings.TrimSpace(opts.authSecret)
	authUser := strings.TrimSpace(opts.authUser)

	if (authSecret == "") != (authUser == "") {
		return "", "", errors.New("--auth-secret and --auth-user must be specified together")
	}

	return authSecret, authUser, nil
}

func newCallbackServer(resultCh chan<- loginResult) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc(loginCallbackPath, func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		if token == "" {
			err := errors.New("callback request missing token")
			http.Error(w, err.Error(), http.StatusBadRequest)
			sendLoginResult(resultCh, loginResult{err: err})
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = fmt.Fprint(w, "SCOW login completed. You can close this page.")

		sendLoginResult(resultCh, loginResult{token: token})
	})

	return &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
}

func sendLoginResult(resultCh chan<- loginResult, result loginResult) {
	select {
	case resultCh <- result:
	default:
	}
}

func parseBaseURL(raw string) (*url.URL, error) {
	if raw == "" {
		return nil, errors.New("scow base url is required")
	}

	if !strings.Contains(raw, "://") {
		raw = "http://" + raw
	}

	parsed, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("parse scow base url: %w", err)
	}

	if parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("invalid scow base url %q: host is required", raw)
	}

	parsed.RawQuery = ""
	parsed.Fragment = ""
	parsed.Path = strings.TrimRight(parsed.Path, "/")

	return parsed, nil
}

func buildAuthURL(baseURL *url.URL, callbackURL string) string {
	authURL := *baseURL
	if strings.HasSuffix(authURL.Path, "/auth") {
		authURL.Path += "/public/auth"
	} else {
		authURL.Path += "/auth/public/auth"
	}

	query := authURL.Query()
	query.Set("callbackUrl", callbackURL)
	authURL.RawQuery = query.Encode()

	return authURL.String()
}

func buildValidateTokenURL(baseURL *url.URL, token string) string {
	validateURL := *baseURL
	if strings.HasSuffix(validateURL.Path, "/auth") {
		validateURL.Path += "/public/validateToken"
	} else {
		validateURL.Path += "/auth/public/validateToken"
	}

	query := validateURL.Query()
	query.Set("token", token)
	validateURL.RawQuery = query.Encode()

	return validateURL.String()
}

func validateToken(ctx context.Context, baseURL *url.URL, token string) (*validateTokenResponse, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, buildValidateTokenURL(baseURL, token), nil)
	if err != nil {
		return nil, fmt.Errorf("create validate token request: %w", err)
	}

	resp, err := httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("validate token: %w", err)
	}
	defer resp.Body.Close()

  if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("validate token failed: status %s", resp.Status)
	}

	var body validateTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("decode validate token response: %w", err)
	}

	if body.IdentityID == "" {
		return nil, errors.New("validate token response missing identityId")
	}

	return &body, nil
}

func openURL(rawURL string) error {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", rawURL)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", rawURL)
	default:
		cmd = exec.Command("xdg-open", rawURL)
	}

	return cmd.Start()
}
