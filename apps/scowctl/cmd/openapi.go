package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/tidwall/pretty"
)

const openAPICacheDirName = "openapi"
const metaOpenAPIPath = "/meta/api/openapi.json"
const metaSystemName = "meta"

var httpClient = http.DefaultClient

type cachedOpenAPISystem struct {
	Name     string      `json:"name"`
	BaseURL  string      `json:"baseUrl"`
	BasePath string      `json:"basePath"`
	Spec     openAPISpec `json:"spec"`
}

type openAPISpec struct {
	OpenAPI string                         `json:"openapi"`
	Info    map[string]any                 `json:"info"`
	Servers []openAPIServer                `json:"servers"`
	Paths   map[string]map[string]apiRoute `json:"paths"`
	Sources []openAPISourceStatus          `json:"x-scow-sources"`
}

type openAPISourceStatus struct {
	Name  string `json:"name"`
	URL   string `json:"url"`
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

type openAPIServer struct {
	URL string `json:"url"`
}

type apiRoute struct {
	OperationID string          `json:"operationId"`
	Summary     string          `json:"summary"`
	Description string          `json:"description"`
	Parameters  []apiParameter  `json:"parameters"`
	RequestBody *apiRequestBody `json:"requestBody"`
}

type apiParameter struct {
	Name     string         `json:"name"`
	In       string         `json:"in"`
	Required bool           `json:"required"`
	Schema   map[string]any `json:"schema"`
}

type apiRequestBody struct {
	Required bool                          `json:"required"`
	Content  map[string]apiRequestBodyItem `json:"content"`
}

type apiRequestBodyItem struct {
	Schema map[string]any `json:"schema"`
}

type refreshOpenAPIOptions struct {
	verbose bool
	log     io.Writer
}

func refreshOpenAPICache(ctx context.Context, current *namedProfile, opts refreshOpenAPIOptions) error {
	cacheDir, err := refreshOpenAPICacheFiles(ctx, current, opts)
	if err != nil {
		return err
	}

	return updateCurrentProfile(func(current *profile) {
		current.OpenAPICache = cacheDir
	})
}

func refreshOpenAPICacheFiles(ctx context.Context, current *namedProfile, opts refreshOpenAPIOptions) (string, error) {
	baseURL, err := parseBaseURL(current.BaseURL)
	if err != nil {
		return "", err
	}

	cacheDir, err := createOpenAPICacheDir(current.Name)
	if err != nil {
		return "", err
	}
	if err := clearOpenAPICacheDir(cacheDir); err != nil {
		return "", err
	}

	metaOpenAPIURL := buildSystemURL(baseURL, metaOpenAPIPath)
	metadata, err := downloadMetadataOpenAPI(ctx, baseURL, metaOpenAPIURL, current, opts)
	if err != nil {
		return "", fmt.Errorf("download merged OpenAPI from meta-server %s: %w", metaOpenAPIURL, err)
	}

	if err := writeCachedOpenAPI(cacheDir, metaSystemName, metadata); err != nil {
		return "", err
	}

	return cacheDir, nil
}

func downloadMetadataOpenAPI(
	ctx context.Context,
	baseURL *url.URL,
	openAPIURL string,
	current *namedProfile,
	opts refreshOpenAPIOptions,
) (*cachedOpenAPISystem, error) {
	verbosef(opts, "Downloading merged OpenAPI from meta-server %s\n", openAPIURL)

	spec, err := downloadOpenAPI(ctx, openAPIURL, current)
	if err != nil {
		return nil, err
	}

	verbosef(opts, "Downloaded merged OpenAPI from meta-server\n")
	for _, source := range spec.Sources {
		if source.OK {
			verbosef(opts, "  source %s ok: %s\n", source.Name, source.URL)
		} else {
			verbosef(opts, "  source %s failed: %s (%s)\n", source.Name, source.Error, source.URL)
		}
	}

	return &cachedOpenAPISystem{
		Name:     metaSystemName,
		BaseURL:  buildRootBaseURL(baseURL),
		BasePath: "",
		Spec:     *spec,
	}, nil
}

func verbosef(opts refreshOpenAPIOptions, format string, args ...any) {
	if !opts.verbose {
		return
	}

	output := opts.log
	if output == nil {
		output = os.Stderr
	}

	fmt.Fprintf(output, format, args...)
}

func clearOpenAPICacheDir(cacheDir string) error {
	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		return fmt.Errorf("read OpenAPI cache dir: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		if err := os.Remove(filepath.Join(cacheDir, entry.Name())); err != nil {
			return fmt.Errorf("remove stale OpenAPI cache %s: %w", entry.Name(), err)
		}
	}

	return nil
}

func createOpenAPICacheDir(profileName string) (string, error) {
	configPath, err := getConfigPath()
	if err != nil {
		return "", err
	}

	cacheDir := filepath.Join(filepath.Dir(configPath), openAPICacheDirName, sanitizeProfileName(profileName))
	if err := os.MkdirAll(cacheDir, configDirPermission); err != nil {
		return "", fmt.Errorf("create OpenAPI cache dir: %w", err)
	}

	return cacheDir, nil
}

func sanitizeProfileName(profileName string) string {
	profileName = strings.TrimSpace(profileName)
	if profileName == "" {
		return defaultProfileName
	}

	replacer := strings.NewReplacer("/", "_", "\\", "_", ":", "_")
	return replacer.Replace(profileName)
}

func downloadOpenAPI(ctx context.Context, openAPIURL string, current *namedProfile) (*openAPISpec, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, openAPIURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create OpenAPI request: %w", err)
	}
	setAPIAuthHeaders(request.Header, current)

	resp, err := httpClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("not found")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("status %s", resp.Status)
	}

	var spec openAPISpec
	if err := json.NewDecoder(resp.Body).Decode(&spec); err != nil {
		return nil, fmt.Errorf("decode OpenAPI: %w", err)
	}
	if len(spec.Paths) == 0 {
		return nil, errors.New("OpenAPI document has no paths")
	}

	return &spec, nil
}

func writeCachedOpenAPI(cacheDir string, systemName string, cached *cachedOpenAPISystem) error {
	content, err := json.MarshalIndent(cached, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal OpenAPI cache: %w", err)
	}
	content = append(content, '\n')

	path := filepath.Join(cacheDir, systemName+".json")
	if err := os.WriteFile(path, content, configPermission); err != nil {
		return fmt.Errorf("write OpenAPI cache: %w", err)
	}
	if err := os.Chmod(path, configPermission); err != nil {
		return fmt.Errorf("set OpenAPI cache permission: %w", err)
	}

	return nil
}

func loadCachedOpenAPIs(current *namedProfile) ([]cachedOpenAPISystem, error) {
	cacheDir := current.OpenAPICache
	if cacheDir == "" {
		configPath, err := getConfigPath()
		if err != nil {
			return nil, err
		}
		cacheDir = filepath.Join(filepath.Dir(configPath), openAPICacheDirName, sanitizeProfileName(current.Name))
	}

	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, errors.New("OpenAPI cache not found, run scowctl api refresh or scowctl login first")
		}
		return nil, fmt.Errorf("read OpenAPI cache dir: %w", err)
	}

	var systems []cachedOpenAPISystem
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		content, err := os.ReadFile(filepath.Join(cacheDir, entry.Name()))
		if err != nil {
			return nil, fmt.Errorf("read OpenAPI cache %s: %w", entry.Name(), err)
		}

		var cached cachedOpenAPISystem
		if err := json.Unmarshal(content, &cached); err != nil {
			return nil, fmt.Errorf("parse OpenAPI cache %s: %w", entry.Name(), err)
		}
		systems = append(systems, cached)
	}

	if len(systems) == 0 {
		return nil, errors.New("OpenAPI cache is empty, run scowctl api refresh")
	}

	return systems, nil
}

func buildSystemURL(baseURL *url.URL, systemPath string) string {
	u := *baseURL
	u.Path = joinURLPath(baseURL.Path, systemPath)
	u.RawQuery = ""
	u.Fragment = ""
	return u.String()
}

func buildRootBaseURL(baseURL *url.URL) string {
	u := *baseURL
	u.Path = ""
	u.RawQuery = ""
	u.Fragment = ""
	return strings.TrimRight(u.String(), "/")
}

func joinURLPath(base string, elem string) string {
	base = strings.TrimRight(base, "/")
	elem = strings.TrimLeft(elem, "/")
	if elem == "" {
		if base == "" {
			return ""
		}
		return base
	}
	if base == "" {
		return "/" + elem
	}
	return base + "/" + elem
}

type responseOutputOptions struct {
	pretty bool
}

func formatResponseBody(body []byte, usePretty bool) []byte {
	if !usePretty || !json.Valid(body) {
		return body
	}

	return pretty.Color(pretty.Pretty(body), nil)
}

func writeResponse(output io.Writer, resp *http.Response, options responseOutputOptions) error {
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		fmt.Fprintf(output, "HTTP %s\n", resp.Status)
	}

	if len(body) > 0 {
		_, err = output.Write(formatResponseBody(body, options.pretty))
		if err != nil {
			return err
		}
		if body[len(body)-1] != '\n' {
			fmt.Fprintln(output)
		}
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("API request failed with status %s", resp.Status)
	}

	return nil
}
