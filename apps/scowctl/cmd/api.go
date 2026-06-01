package cmd

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"sort"
	"strings"

	"github.com/spf13/cobra"
)

var apiCmd = &cobra.Command{
	Use:   "api <http method> <path> <parameters...>",
	Short: "Call SCOW HTTP OpenAPI",
	Args:  cobra.MinimumNArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		noPretty, err := cmd.Flags().GetBool("no-pretty")
		if err != nil {
			return err
		}
		return runAPI(cmd.Context(), args[0], args[1], args[2:], os.Stdout, responseOutputOptions{
			pretty: !noPretty && isInteractiveStdout(),
		})
	},
}

var apiRefreshCmd = &cobra.Command{
	Use:   "refresh",
	Short: "Refresh cached SCOW OpenAPI documents",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		verbose, err := cmd.Flags().GetBool("verbose")
		if err != nil {
			return err
		}
		return runAPIRefresh(cmd.Context(), verbose)
	},
}

var apiListCmd = &cobra.Command{
	Use:   "list",
	Short: "List cached SCOW APIs",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		noPager, err := cmd.Flags().GetBool("no-pager")
		if err != nil {
			return err
		}
		return runAPIList(noPager)
	},
}

var apiHelpCmd = &cobra.Command{
	Use:   "help <http method> <path>",
	Short: "Show parameters for a cached SCOW API",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		return runAPIHelp(args[0], args[1], os.Stdout)
	},
}

func init() {
	apiCmd.Flags().Bool("no-pretty", false, "disable pretty JSON output")
	apiRefreshCmd.Flags().Bool("verbose", false, "show OpenAPI discovery details")
	apiListCmd.Flags().Bool("no-pager", false, "print directly without using a pager")
	apiCmd.AddCommand(apiRefreshCmd)
	apiCmd.AddCommand(apiListCmd)
	apiCmd.AddCommand(apiHelpCmd)
}

func runAPIRefresh(ctx context.Context, verbose bool) error {
	current, err := getCurrentProfile()
	if err != nil {
		return err
	}

	if err := refreshOpenAPICache(ctx, current, refreshOpenAPIOptions{verbose: verbose}); err != nil {
		return err
	}

	fmt.Println("OpenAPI cache refreshed")
	return nil
}

func runAPI(
	ctx context.Context,
	method string,
	apiPath string,
	rawParams []string,
	output io.Writer,
	outputOptions responseOutputOptions,
) error {
	current, err := getCurrentProfile()
	if err != nil {
		return err
	}

	systems, err := loadCachedOpenAPIs(current)
	if err != nil {
		return err
	}

	params, err := parseCLIParams(rawParams)
	if err != nil {
		return err
	}

	route, err := findAPIRoute(systems, method, apiPath)
	if err != nil {
		return err
	}

	request, err := buildAPIRequest(ctx, current, route, params)
	if err != nil {
		return err
	}

	resp, err := httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("call API: %w", err)
	}

	return writeResponse(output, resp, outputOptions)
}

func runAPIHelp(method string, apiPath string, output io.Writer) error {
	current, err := getCurrentProfile()
	if err != nil {
		return err
	}

	systems, err := loadCachedOpenAPIs(current)
	if err != nil {
		return err
	}

	route, err := findAPIRoute(systems, method, apiPath)
	if err != nil {
		return err
	}

	_, err = fmt.Fprint(output, formatAPIHelp(route))
	return err
}

type apiListEntry struct {
	system  string
	method  string
	path    string
	summary string
}

func runAPIList(noPager bool) error {
	current, err := getCurrentProfile()
	if err != nil {
		return err
	}

	systems, err := loadCachedOpenAPIs(current)
	if err != nil {
		return err
	}

	entries := collectAPIListEntries(systems)
	if len(entries) == 0 {
		return fmt.Errorf("no API found in cached OpenAPI documents")
	}

	return pageText(formatAPIList(entries), noPager)
}

func collectAPIListEntries(systems []cachedOpenAPISystem) []apiListEntry {
	var entries []apiListEntry
	for _, system := range systems {
		for path, methods := range system.Spec.Paths {
			for method, route := range methods {
				method = strings.ToLower(method)
				if !isHTTPMethod(method) {
					continue
				}

				entries = append(entries, apiListEntry{
					system:  system.Name,
					method:  strings.ToUpper(method),
					path:    displayPath(system, path),
					summary: firstLine(firstNonEmpty(route.Summary, route.Description)),
				})
			}
		}
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].system != entries[j].system {
			return entries[i].system < entries[j].system
		}
		if entries[i].path != entries[j].path {
			return entries[i].path < entries[j].path
		}
		return entries[i].method < entries[j].method
	})

	return entries
}

func formatAPIList(entries []apiListEntry) string {
	var builder strings.Builder
	currentSystem := ""
	for _, entry := range entries {
		if entry.system != currentSystem {
			if currentSystem != "" {
				builder.WriteString("\n")
			}
			currentSystem = entry.system
			builder.WriteString("[")
			builder.WriteString(currentSystem)
			builder.WriteString("]\n")
		}

		builder.WriteString(fmt.Sprintf("  %-7s %-60s", entry.method, entry.path))
		if entry.summary != "" {
			builder.WriteString("  ")
			builder.WriteString(entry.summary)
		}
		builder.WriteString("\n")
	}

	return builder.String()
}

func pageText(text string, noPager bool) error {
	if noPager || !isInteractiveStdout() {
		fmt.Print(text)
		return nil
	}

	pager := os.Getenv("PAGER")
	if pager == "" {
		pager = "less -R"
	}

	fields := strings.Fields(pager)
	if len(fields) == 0 {
		fmt.Print(text)
		return nil
	}

	command := exec.Command(fields[0], fields[1:]...)
	command.Stdin = strings.NewReader(text)
	command.Stdout = os.Stdout
	command.Stderr = os.Stderr

	if err := command.Run(); err != nil {
		fmt.Print(text)
		return nil
	}

	return nil
}

func isInteractiveStdout() bool {
	info, err := os.Stdout.Stat()
	if err != nil {
		return false
	}

	return info.Mode()&os.ModeCharDevice != 0
}

func formatAPIHelp(route *matchedAPIRoute) string {
	var builder strings.Builder
	method := strings.ToUpper(route.method)
	visiblePath := displayPath(route.system, route.path)

	builder.WriteString(method)
	builder.WriteString(" ")
	builder.WriteString(visiblePath)
	builder.WriteString("\n")

	if summary := firstNonEmpty(route.route.Summary, route.route.Description); summary != "" {
		builder.WriteString("\n")
		builder.WriteString(summary)
		builder.WriteString("\n")
	}

	builder.WriteString("\nCall:\n")
	builder.WriteString("  scowctl api ")
	builder.WriteString(method)
	builder.WriteString(" ")
	builder.WriteString(visiblePath)
	builder.WriteString(" [key=value...]\n")

	builder.WriteString("\nParameter Help:\n")
	builder.WriteString("  scowctl api help ")
	builder.WriteString(method)
	builder.WriteString(" ")
	builder.WriteString(visiblePath)
	builder.WriteString("\n")

	parameterSections := groupParameters(route.route.Parameters)
	writeParameterSection(&builder, "Path Parameters", parameterSections["path"])
	writeParameterSection(&builder, "Query Parameters", parameterSections["query"])
	writeParameterSection(&builder, "Header Parameters", parameterSections["header"])
	writeBodyParameterSection(&builder, route.route.RequestBody)

	return builder.String()
}

func groupParameters(parameters []apiParameter) map[string][]apiParameter {
	grouped := map[string][]apiParameter{}
	for _, parameter := range parameters {
		grouped[parameter.In] = append(grouped[parameter.In], parameter)
	}
	return grouped
}

func writeParameterSection(builder *strings.Builder, title string, parameters []apiParameter) {
	if len(parameters) == 0 {
		return
	}

	builder.WriteString("\n")
	builder.WriteString(title)
	builder.WriteString(":\n")
	for _, parameter := range parameters {
		builder.WriteString("  ")
		builder.WriteString(parameter.Name)
		builder.WriteString(formatRequired(parameter.Required))
		if schemaType := schemaType(parameter.Schema); schemaType != "" {
			builder.WriteString("  ")
			builder.WriteString(schemaType)
		}
		builder.WriteString("\n")
	}
}

func writeBodyParameterSection(builder *strings.Builder, requestBody *apiRequestBody) {
	if requestBody == nil {
		return
	}

	builder.WriteString("\nBody Parameters:\n")
	wrote := false
	for _, content := range requestBody.Content {
		properties, ok := content.Schema["properties"].(map[string]any)
		if !ok || len(properties) == 0 {
			builder.WriteString("  <any key=value accepted by request body schema>")
			builder.WriteString(formatRequired(requestBody.Required))
			builder.WriteString("\n")
			return
		}

		required := requiredPropertySet(content.Schema)
		names := make([]string, 0, len(properties))
		for name := range properties {
			names = append(names, name)
		}
		sort.Strings(names)

		for _, name := range names {
			builder.WriteString("  ")
			builder.WriteString(name)
			builder.WriteString(formatRequired(required[name]))
			if propertySchema, ok := properties[name].(map[string]any); ok {
				if schemaType := schemaType(propertySchema); schemaType != "" {
					builder.WriteString("  ")
					builder.WriteString(schemaType)
				}
			}
			builder.WriteString("\n")
			wrote = true
		}
	}

	if !wrote {
		builder.WriteString("  <no named body parameters>\n")
	}
}

type matchedAPIRoute struct {
	system cachedOpenAPISystem
	path   string
	method string
	route  apiRoute
}

func findAPIRoute(systems []cachedOpenAPISystem, method string, apiPath string) (*matchedAPIRoute, error) {
	method = strings.ToLower(method)
	if !strings.HasPrefix(apiPath, "/") {
		apiPath = "/" + apiPath
	}

	var allowed []string
	for _, system := range systems {
		for path, methods := range system.Spec.Paths {
			for candidateMethod, route := range methods {
				candidateMethod = strings.ToLower(candidateMethod)
				if !isHTTPMethod(candidateMethod) {
					continue
				}

				visiblePath := displayPath(system, path)
				if candidateMethod == method && visiblePath == apiPath {
					return &matchedAPIRoute{
						system: system,
						path:   path,
						method: candidateMethod,
						route:  route,
					}, nil
				}

				allowed = append(allowed, strings.ToUpper(candidateMethod)+" "+visiblePath)
			}
		}
	}

	return nil, fmt.Errorf("API %s %s not found in cached OpenAPI documents. Available examples: %s", strings.ToUpper(method), apiPath, strings.Join(firstN(allowed, 10), ", "))
}

func displayPath(system cachedOpenAPISystem, openAPIPath string) string {
	baseURL, err := url.Parse(system.BaseURL)
	if err != nil {
		return openAPIPath
	}

	basePath := strings.TrimRight(baseURL.EscapedPath(), "/")
	if basePath == "" {
		return ensureLeadingSlash(openAPIPath)
	}

	path := ensureLeadingSlash(openAPIPath)
	if strings.HasPrefix(path, basePath+"/") || path == basePath {
		return path
	}

	return joinURLPath(basePath, path)
}

func ensureLeadingSlash(path string) string {
	if strings.HasPrefix(path, "/") {
		return path
	}
	return "/" + path
}

func isHTTPMethod(method string) bool {
	switch method {
	case "get", "post", "put", "patch", "delete", "head", "options":
		return true
	default:
		return false
	}
}

func parseCLIParams(rawParams []string) (map[string]string, error) {
	params := map[string]string{}
	for _, raw := range rawParams {
		key, value, ok := strings.Cut(raw, "=")
		if !ok || key == "" {
			return nil, fmt.Errorf("invalid parameter %q, expected key=value", raw)
		}
		params[key] = value
	}
	return params, nil
}

func formatRequired(required bool) string {
	if required {
		return " (required)"
	}
	return " (optional)"
}

func schemaType(schema map[string]any) string {
	if schema == nil {
		return ""
	}

	if value, ok := schema["type"].(string); ok {
		return value
	}

	if ref, ok := schema["$ref"].(string); ok {
		_, name, found := strings.Cut(ref, "#/components/schemas/")
		if found {
			return name
		}
		return ref
	}

	return ""
}

func requiredPropertySet(schema map[string]any) map[string]bool {
	required := map[string]bool{}
	values, ok := schema["required"].([]any)
	if !ok {
		return required
	}

	for _, value := range values {
		name, ok := value.(string)
		if ok {
			required[name] = true
		}
	}

	return required
}

func buildAPIRequest(ctx context.Context, current *namedProfile, route *matchedAPIRoute, params map[string]string) (*http.Request, error) {
	requestURL, err := buildAPIRequestURL(route, params)
	if err != nil {
		return nil, err
	}

	headers := map[string]string{}
	bodyParams := map[string]any{}
	used := map[string]bool{}

	for _, parameter := range route.route.Parameters {
		value, ok := params[parameter.Name]
		if !ok {
			if parameter.Required {
				return nil, fmt.Errorf("missing required parameter %q in %s", parameter.Name, parameter.In)
			}
			continue
		}

		used[parameter.Name] = true
		if parameter.In == "header" {
			headers[parameter.Name] = value
		}
	}

	for key, value := range params {
		if used[key] {
			continue
		}
		if strings.Contains(route.path, "{"+key+"}") {
			continue
		}
		if isQueryParameter(route.route.Parameters, key) {
			continue
		}
		if !route.allowsBodyParameter(key) {
			return nil, fmt.Errorf("unknown parameter %q for %s %s", key, strings.ToUpper(route.method), route.path)
		}
		if err := setBodyParameter(bodyParams, route, key, value); err != nil {
			return nil, err
		}
	}

	var body io.Reader
	if len(bodyParams) > 0 {
		content, err := json.Marshal(bodyParams)
		if err != nil {
			return nil, fmt.Errorf("marshal request body: %w", err)
		}
		body = bytes.NewReader(content)
	}

	request, err := http.NewRequestWithContext(ctx, strings.ToUpper(route.method), requestURL, body)
	if err != nil {
		return nil, fmt.Errorf("create API request: %w", err)
	}

	setAPIAuthHeaders(request.Header, current)
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	for key, value := range headers {
		request.Header.Set(key, value)
	}

	return request, nil
}

func setAPIAuthHeaders(header http.Header, current *namedProfile) {
	if token := current.apiAuthToken(); token != "" {
		header.Set("x-scow-api-auth-token", token)
	}
	if userID := current.apiAuthUser(); userID != "" {
		header.Set("x-scow-user-id", userID)
	}
}

func (route *matchedAPIRoute) allowsBodyParameter(key string) bool {
	if route.route.RequestBody == nil {
		return false
	}

	topLevelKey, _, _ := strings.Cut(key, ".")
	for _, content := range route.route.RequestBody.Content {
		properties, ok := content.Schema["properties"].(map[string]any)
		if !ok || len(properties) == 0 {
			return true
		}
		if _, ok := properties[topLevelKey]; ok {
			return true
		}
	}

	return false
}

func setBodyParameter(bodyParams map[string]any, route *matchedAPIRoute, key string, rawValue string) error {
	path := strings.Split(key, ".")
	current := bodyParams

	for _, segment := range path[:len(path)-1] {
		if segment == "" {
			return fmt.Errorf("invalid body parameter %q", key)
		}

		if next, ok := current[segment]; ok {
			nextMap, ok := next.(map[string]any)
			if !ok {
				return fmt.Errorf("body parameter %q conflicts with existing value", key)
			}
			current = nextMap
			continue
		}

		nextMap := map[string]any{}
		current[segment] = nextMap
		current = nextMap
	}

	last := path[len(path)-1]
	if last == "" {
		return fmt.Errorf("invalid body parameter %q", key)
	}

	current[last] = parseBodyValue(rawValue, route.bodyParameterSchema(key))
	return nil
}

func parseBodyValue(rawValue string, schema map[string]any) any {
	switch schemaType(schema) {
	case "integer":
		var value int64
		if _, err := fmt.Sscan(rawValue, &value); err == nil {
			return value
		}
	case "number":
		var value float64
		if _, err := fmt.Sscan(rawValue, &value); err == nil {
			return value
		}
	case "boolean":
		if rawValue == "true" {
			return true
		}
		if rawValue == "false" {
			return false
		}
	}
	return rawValue
}

func (route *matchedAPIRoute) bodyParameterSchema(key string) map[string]any {
	if route.route.RequestBody == nil {
		return nil
	}

	path := strings.Split(key, ".")
	for _, content := range route.route.RequestBody.Content {
		schema := content.Schema

		for _, segment := range path {
			properties, ok := schema["properties"].(map[string]any)
			if ok {
				if next, ok := properties[segment].(map[string]any); ok {
					schema = next
					continue
				}
				return nil
			}

			additionalProperties, ok := schema["additionalProperties"].(map[string]any)
			if ok {
				schema = additionalProperties
				continue
			}

			return nil
		}

		return schema
	}

	return nil
}

func buildAPIRequestURL(route *matchedAPIRoute, params map[string]string) (string, error) {
	baseURL, err := url.Parse(route.system.BaseURL)
	if err != nil {
		return "", fmt.Errorf("parse system base url: %w", err)
	}

	path := route.path
	for _, parameter := range route.route.Parameters {
		if parameter.In != "path" {
			continue
		}

		value, ok := params[parameter.Name]
		if !ok {
			return "", fmt.Errorf("missing required path parameter %q", parameter.Name)
		}

		path = strings.ReplaceAll(path, "{"+parameter.Name+"}", value)
	}

	if absolute, err := url.Parse(path); err == nil && absolute.IsAbs() {
		return absolute.String(), nil
	}

	u := *baseURL
	if route.system.BasePath != "" && strings.HasPrefix(path, route.system.BasePath+"/") {
		root := *baseURL
		root.Path = strings.TrimSuffix(strings.TrimSuffix(root.Path, route.system.BasePath), "/")
		u = root
	}
	u.Path = joinURLPath(u.Path, path)

	query := u.Query()
	for _, parameter := range route.route.Parameters {
		if parameter.In != "query" {
			continue
		}

		value, ok := params[parameter.Name]
		if !ok {
			if parameter.Required {
				return "", fmt.Errorf("missing required query parameter %q", parameter.Name)
			}
			continue
		}

		query.Set(parameter.Name, value)
	}
	u.RawQuery = query.Encode()

	return u.String(), nil
}

func isQueryParameter(parameters []apiParameter, key string) bool {
	for _, parameter := range parameters {
		if parameter.Name == key && parameter.In == "query" {
			return true
		}
	}
	return false
}

func firstN(values []string, n int) []string {
	if len(values) <= n {
		return values
	}
	return values[:n]
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func firstLine(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}

	line, _, _ := strings.Cut(value, "\n")
	return strings.TrimSpace(line)
}
