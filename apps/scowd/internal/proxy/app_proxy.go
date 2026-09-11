package proxy

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"regexp"
	"scowd/pkg/config"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
)

// Configuration constants
const (
	MaxBodySize      = 10000 << 20 // 10000MB
	ProxyReadTimeout = 36000 * time.Second
)

// Precompiled regular expressions for matching paths
var (
	relativeRegex = regexp.MustCompile(`^/?([^/]+/)?api/proxy/(?P<clusterId>[^/]+)/relative/(?P<node>[-\w.]+)/(?P<port>\d+)(?P<rest>/.*)?$`)
	absoluteRegex = regexp.MustCompile(`^/?([^/]+/)?api/proxy/(?P<clusterId>[^/]+)/absolute/(?P<node>[-\w.]+)/(?P<port>\d+)(?P<rest>/.*)?$`)
)

// InitAppProxy initializes the application proxy server
func InitAppProxy(ctx context.Context) {
	// Read SCOWD configuration
	scowdConfig, err := config.GetScowdConfig()
	if err != nil {
		logrus.Fatalf("[InitAppProxy] Failed to read SCOWD config: %s", err)
	}

	address := fmt.Sprintf("%s:%d", scowdConfig.Proxy.AppProxy.Host, scowdConfig.Proxy.AppProxy.Port)

	// Create HTTP server
	server := &http.Server{
		Addr:         address,
		Handler:      http.HandlerFunc(proxyHandler),
		ReadTimeout:  10 * time.Second,    // Timeout for reading the request
		WriteTimeout: 36000 * time.Second, // Timeout for writing the response, matching Nginx's proxy_read_timeout
		IdleTimeout:  60 * time.Second,    // Timeout for idle connections
	}

	// Start the HTTP server
	go func() {
		logrus.Infof("App proxy HTTP server is running on %s", address)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logrus.Fatalf("App proxy HTTP server failed: %v", err)
		}
	}()

	// Monitor shutdown signal
	go func() {
		<-ctx.Done()

		logrus.Info("Shutting down app proxy HTTP server...")
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutdownCancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			logrus.Errorf("Error during app proxy HTTP server shutdown: %v", err)
		} else {
			logrus.Infof("App proxy HTTP server shut down gracefully")
		}
	}()
}

// proxyHandler processes incoming proxy requests
func proxyHandler(w http.ResponseWriter, r *http.Request) {
	logrus.Debugf("[proxyHandler] Received request: %s %s", r.Method, r.URL.Path)

	// Limit request body size
	r.Body = http.MaxBytesReader(w, r.Body, MaxBodySize)

	// Match relative path
	if matches := relativeRegex.FindStringSubmatch(r.URL.Path); matches != nil {
		params := extractParams(relativeRegex, matches)
		logrus.Debugf("[proxyHandler] Matched relative path with params: %+v", params)
		proxyURL := buildRelativeProxyURL(params, r)
		if proxyURL == nil {
			logrus.Warnf("[proxyHandler] Invalid relative proxy URL: %s", r.URL.Path)
			http.Error(w, "Invalid proxy URL", http.StatusBadRequest)
			return
		}
		logrus.Debugf("[proxyHandler] Proxying request to relative URL: %s", proxyURL.String())
		serveReverseProxy(w, r, proxyURL, false, params["rest"])
		return
	}

	// Match absolute path
	if matches := absoluteRegex.FindStringSubmatch(r.URL.Path); matches != nil {
		params := extractParams(absoluteRegex, matches)
		logrus.Debugf("[proxyHandler] Matched absolute path with params: %+v", params)
		proxyURL := buildAbsoluteProxyURL(params)
		if proxyURL == nil {
			logrus.Warnf("[proxyHandler] Invalid absolute proxy URL: %s", r.URL.Path)
			http.Error(w, "Invalid proxy URL", http.StatusBadRequest)
			return
		}
		logrus.Infof("[proxyHandler] Proxying request to absolute URL: %s", proxyURL.String())
		serveReverseProxy(w, r, proxyURL, true, "")
		return
	}

	// No match found, return 404
	logrus.Warnf("[proxyHandler] No matching route for path: %s", r.URL.Path)
	http.NotFound(w, r)
}

// extractParams extracts named parameters from regex match results
func extractParams(regex *regexp.Regexp, matches []string) map[string]string {
	paramsMap := make(map[string]string)
	for i, name := range regex.SubexpNames() {
		if i != 0 && name != "" {
			paramsMap[name] = matches[i]
		}
	}
	return paramsMap
}

// buildRelativeProxyURL constructs the target URL for relative paths
func buildRelativeProxyURL(params map[string]string, r *http.Request) *url.URL {
	node := params["node"]
	port := params["port"]
	rest := params["rest"]
	if rest == "" {
		rest = "/"
	}
	// Construct relative proxy URL like "http://node:port/rest?args"
	target := &url.URL{
		Scheme:   "http",
		Host:     net.JoinHostPort(node, port),
		Path:     rest,
		RawQuery: r.URL.RawQuery,
	}
	return target
}

// buildAbsoluteProxyURL constructs the target URL for absolute paths
func buildAbsoluteProxyURL(params map[string]string) *url.URL {
	node := params["node"]
	port := params["port"]
	// 构建目标 URL，仅包含 Scheme 和 Host
	target := &url.URL{
		Scheme: "http",
		Host:   net.JoinHostPort(node, port),
		// Path 留空，保持原始请求的 Path
		// RawQuery 也留空，由 ReverseProxy 保留原始请求的 RawQuery
	}
	return target
}

// serveReverseProxy forwards the request to the target server
func serveReverseProxy(w http.ResponseWriter, r *http.Request, target *url.URL, isAbsolute bool, rest string) {
	proxy := httputil.NewSingleHostReverseProxy(target)

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		// 原始请求头
		logrus.Debugf("[proxy.Director] Original request headers: %v", r.Header)

		originalDirector(req)

		// 设置 Host 头
		req.Host = r.Host
		req.Header.Set("X-Forwarded-Host", r.Host)

		// 设置 X-Real-IP 和 X-Forwarded-For 头
		clientIP := getIP(r)
		req.Header.Set("X-Real-IP", clientIP)
		addXForwardedFor(req, r)

		// 处理 Upgrade 和 Connection 头
		if upgrade := r.Header.Get("Upgrade"); upgrade != "" {
			req.Header.Set("Upgrade", upgrade)
			req.Header.Set("Connection", r.Header.Get("Connection"))
		} else {
			req.Header.Set("Connection", "keep-alive")
		}

		// 转发 Origin 头
		if origin := r.Header.Get("Origin"); origin != "" {
			req.Header.Set("Origin", origin)
		}

		// 修改后的请求头
		logrus.Debugf("[proxy.Director] Modified proxy request headers: %v", req.Header)

		if isAbsolute {
			// 对于 absolute 路径，保留原始的 Path 和 RawQuery
			req.URL.Path = r.URL.Path
			req.URL.RawPath = r.URL.RawPath
			req.URL.RawQuery = r.URL.RawQuery
		} else {
			// For relative paths, set Path to rest and append RawQuery
			req.URL.Path = rest
			req.URL.RawQuery = r.URL.RawQuery
		}
	}

	// 保留 ModifyResponse、Transport 和 ErrorHandler 不变
	proxy.ModifyResponse = func(resp *http.Response) error {
		logrus.Debugf("[serveReverseProxy] Response Headers: %v", resp.Header)
		logrus.Debugf("[serveReverseProxy] Response Status: %s", resp.Status)
		return nil
	}

	proxy.Transport = &loggingTransport{
		underlyingTransport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			ForceAttemptHTTP2:     false, // 禁用 HTTP/2
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		},
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		logrus.Errorf("[serveReverseProxy] Proxy error: %v", err)
		http.Error(w, "Proxy error", http.StatusBadGateway)
	}

	// 处理代理请求
	proxy.ServeHTTP(w, r)
}

// loggingTransport wraps an http.RoundTripper to log request details
type loggingTransport struct {
	underlyingTransport http.RoundTripper
}

func (t *loggingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Log the target URL and request headers
	logrus.Debugf("[serveReverseProxy] Forwarding request to: %s", req.URL.String())
	logrus.Debugf("[serveReverseProxy] Request Headers: %v", req.Header)
	return t.underlyingTransport.RoundTrip(req)
}

// getIP retrieves the client's IP address
func getIP(r *http.Request) string {
	// Try to get from X-Real-IP or X-Forwarded-For
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	if ips := r.Header.Get("X-Forwarded-For"); ips != "" {
		// X-Forwarded-For can contain multiple IPs, take the first one
		parts := strings.Split(ips, ",")
		return strings.TrimSpace(parts[0])
	}
	// Otherwise, extract from RemoteAddr
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		logrus.Errorf("[getIP] Error parsing RemoteAddr: %v", err)
		return r.RemoteAddr
	}
	return host
}

// addXForwardedFor adds the client's IP to the X-Forwarded-For header
func addXForwardedFor(req *http.Request, r *http.Request) {
	xff := r.Header.Get("X-Forwarded-For")
	clientIP := getIP(r)
	if xff != "" {
		xff = xff + ", " + clientIP
	} else {
		xff = clientIP
	}
	req.Header.Set("X-Forwarded-For", xff)
}
