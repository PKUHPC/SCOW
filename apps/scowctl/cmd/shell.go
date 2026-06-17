package cmd

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

const clusterConfigFilesPath = "/api/getClusterConfigFiles"
const shellWebSocketPath = "/api/shell"

var shellCmd = &cobra.Command{
	Use:   "shell <cluster id> [login node ip] [-- <command>]",
	Short: "Open an interactive shell or run a command on a cluster login node",
	Long: `Open an interactive shell on a cluster login node through portal-web.

If login node ip is not specified, the first login node of the cluster is used.
If -- <command> is provided, the command is executed non-interactively and its output is printed.
Run without cluster id to see the list of available clusters.`,
	DisableFlagParsing: true,
	SilenceUsage:       true,
	SilenceErrors:      true,
	RunE: func(cmd *cobra.Command, args []string) error {
		return runShell(cmd.Context(), args)
	},
}

func init() {
	rootCmd.AddCommand(shellCmd)
}

type shellInputMessage struct {
	Case string `json:"$case"`
	Data struct {
		Data string `json:"data"`
	} `json:"data,omitempty"`
	Resize struct {
		Cols int `json:"cols"`
		Rows int `json:"rows"`
	} `json:"resize,omitempty"`
}

type shellOutputMessage struct {
	Case string `json:"$case"`
	Data struct {
		Data string `json:"data"`
	} `json:"data,omitempty"`
	Exit struct {
		Code   int    `json:"code"`
		Signal string `json:"signal"`
	} `json:"exit,omitempty"`
}

type clusterConfigFilesResponse struct {
	ClusterConfigs map[string]clusterConfig `json:"clusterConfigs"`
}

type clusterConfig struct {
	DisplayName json.RawMessage `json:"displayName"`
	Priority    float64         `json:"priority"`
	LoginNodes  []loginNode     `json:"loginNodes"`
}

type loginNode struct {
	Name    string `json:"name"`
	Address string `json:"address"`
}

func (n *loginNode) UnmarshalJSON(data []byte) error {
	var address string
	if err := json.Unmarshal(data, &address); err == nil {
		n.Name = address
		n.Address = address
		return nil
	}

	type loginNodeObject loginNode
	var obj loginNodeObject
	if err := json.Unmarshal(data, &obj); err != nil {
		return err
	}

	*n = loginNode(obj)
	return nil
}

func runShell(ctx context.Context, args []string) error {
	current, err := getCurrentProfile()
	if err != nil {
		return err
	}

	clusters, err := fetchClusterConfigFiles(ctx, current)
	if err != nil {
		return err
	}

	if len(args) == 0 {
		return listClustersAndError(clusters)
	}

	clusterID, loginNode, command, err := parseShellArgs(args, clusters)
	if err != nil {
		return err
	}

	if command == "" {
		fmt.Fprintf(os.Stderr, "Connecting to login node %s (%s) on cluster %s...\n", loginNode.Name, loginNode.Address, clusterID)
	}

	return connectShell(ctx, current, clusterID, loginNode.Address, command)
}

func parseShellArgs(args []string, clusters map[string]clusterConfig) (string, loginNode, string, error) {
	clusterID := args[0]
	cluster, ok := clusters[clusterID]
	if !ok {
		fmt.Fprintf(os.Stderr, "Unknown cluster %q.\n\nAvailable clusters:\n", clusterID)
		printClusterList(clusters)
		return "", loginNode{}, "", fmt.Errorf("unknown cluster %q", clusterID)
	}

	loginNodes := normalizeLoginNodes(cluster.LoginNodes)
	if len(loginNodes) == 0 {
		return "", loginNode{}, "", fmt.Errorf("cluster %q has no login nodes", clusterID)
	}

	loginNodeAddress := loginNodes[0].Address

	var command string
	dashIndex := -1
	for i, arg := range args[1:] {
		if arg == "--" {
			dashIndex = i + 1
			break
		}
	}

	if dashIndex == -1 {
		// shell <cluster id> [login node ip]
		if len(args) >= 2 && args[1] != "" {
			loginNodeAddress = args[1]
		}
	} else {
		// shell <cluster id> [login node ip] -- <command>
		if dashIndex >= 2 {
			loginNodeAddress = args[1]
		}
		if dashIndex+1 < len(args) {
			command = args[dashIndex+1]
			for _, arg := range args[dashIndex+2:] {
				command += " " + arg
			}
		}
	}

	var selectedNode loginNode
	for _, node := range loginNodes {
		if node.Address == loginNodeAddress {
			selectedNode = node
			break
		}
	}
	if selectedNode.Address == "" {
		fmt.Fprintf(os.Stderr, "Unknown login node %q for cluster %q.\n\nAvailable login nodes:\n", loginNodeAddress, clusterID)
		for _, node := range loginNodes {
			fmt.Fprintf(os.Stderr, "  %s\n", node.Address)
		}
		return "", loginNode{}, "", fmt.Errorf("unknown login node %q", loginNodeAddress)
	}

	return clusterID, selectedNode, command, nil
}

func normalizeLoginNodes(nodes []loginNode) []loginNode {
	result := make([]loginNode, 0, len(nodes))
	for _, node := range nodes {
		if node.Address == "" {
			continue
		}
		result = append(result, node)
	}
	return result
}

func listClustersAndError(clusters map[string]clusterConfig) error {
	fmt.Fprintln(os.Stderr, "Cluster id is required.")
	fmt.Fprintln(os.Stderr)
	fmt.Fprintln(os.Stderr, "Available clusters:")
	printClusterList(clusters)
	return errors.New("cluster id is required")
}

func printClusterList(clusters map[string]clusterConfig) {
	for id, config := range clusters {
		fmt.Fprintf(os.Stderr, "  %s", id)
		if name := extractDisplayName(config.DisplayName); name != "" && name != id {
			fmt.Fprintf(os.Stderr, " (%s)", name)
		}
		fmt.Fprintln(os.Stderr)
	}
}

func extractDisplayName(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}

	var str string
	if err := json.Unmarshal(raw, &str); err == nil {
		return str
	}

	var obj struct {
		Default string `json:"default"`
	}
	if err := json.Unmarshal(raw, &obj); err == nil {
		return obj.Default
	}

	return ""
}

func fetchClusterConfigFiles(ctx context.Context, current *namedProfile) (map[string]clusterConfig, error) {
	baseURL, err := parseBaseURL(current.BaseURL)
	if err != nil {
		return nil, err
	}

	requestURL := buildSystemURL(baseURL, clusterConfigFilesPath)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create cluster config request: %w", err)
	}
	setAPIAuthHeaders(request.Header, current)

	resp, err := httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("fetch cluster configs: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("fetch cluster configs failed: %s\n%s", resp.Status, string(body))
	}

	var result clusterConfigFilesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode cluster configs: %w", err)
	}

	return result.ClusterConfigs, nil
}

func connectShell(ctx context.Context, current *namedProfile, clusterID, loginNodeAddress, command string) error {
	baseURL, err := parseBaseURL(current.BaseURL)
	if err != nil {
		return err
	}

	wsScheme := "ws"
	if baseURL.Scheme == "https" {
		wsScheme = "wss"
	}

	cols, rows, err := terminalSize()
	if err != nil {
		cols = 80
		rows = 30
	}

	query := url.Values{}
	query.Set("cluster", clusterID)
	query.Set("loginNode", loginNodeAddress)
	query.Set("path", "")
	query.Set("cols", fmt.Sprintf("%d", cols))
	query.Set("rows", fmt.Sprintf("%d", rows))
	query.Set("useRoot", "false")

	wsURL := buildShellWebSocketURL(baseURL, wsScheme, query)

	headers := http.Header{}
	setAPIAuthHeaders(headers, current)

	dialer := websocket.Dialer{}
	conn, resp, err := dialer.DialContext(ctx, wsURL.String(), headers)
	if err != nil {
		if resp != nil {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			return fmt.Errorf("connect shell websocket: %w\n%s", err, string(body))
		}
		return fmt.Errorf("connect shell websocket: %w", err)
	}
	defer conn.Close()

	if command != "" {
		return runSingleCommandShell(ctx, conn, command)
	}

	if !term.IsTerminal(int(os.Stdin.Fd())) {
		return runNonInteractiveShell(ctx, conn)
	}

	return runInteractiveShell(ctx, conn)
}

func buildShellWebSocketURL(baseURL *url.URL, wsScheme string, query url.Values) url.URL {
	wsURL := *baseURL
	wsURL.Scheme = wsScheme
	wsURL.Path = joinURLPath(baseURL.Path, shellWebSocketPath)
	wsURL.RawQuery = query.Encode()
	wsURL.Fragment = ""
	return wsURL
}

func runSingleCommandShell(ctx context.Context, conn *websocket.Conn, command string) error {
	var outputBuffer bytes.Buffer
	dataCh := make(chan struct{}, 1)

	type result struct {
		exitCode int
		err      error
	}
	resultCh := make(chan result, 1)

	go func() {
		exitCode, _, err := readShellMessagesForCommand(ctx, conn, &outputBuffer, dataCh)
		resultCh <- result{exitCode: exitCode, err: err}
	}()

	// Wait for the shell to become ready. The backend shell initialization is slow,
	// so wait until we receive at least one data message and then a quiet period.
	const readyQuietPeriod = 800 * time.Millisecond
	const readyTimeout = 60 * time.Second
	if err := waitForShellReady(ctx, dataCh, readyQuietPeriod, readyTimeout); err != nil {
		return err
	}

	// Suppress interactive shell noise (prompt, command echo, terminal title) for clean output.
	setup := "stty -echo\nPS1=''\nPROMPT_COMMAND=''\n"
	if err := sendShellData(conn, setup); err != nil {
		return fmt.Errorf("send shell setup: %w", err)
	}
	time.Sleep(200 * time.Millisecond)

	const startMarker = "__SCOW_CMD_START__"
	const endMarker = "__SCOW_CMD_END__"
	cmdLine := fmt.Sprintf("echo %s\n%s\necho %s:$?\nexit\n", startMarker, command, endMarker)
	if err := sendShellData(conn, cmdLine); err != nil {
		return fmt.Errorf("send command: %w", err)
	}

	var res result
	select {
	case res = <-resultCh:
	case <-ctx.Done():
		return ctx.Err()
	}

	cleanOutput, commandExitCode := extractCommandOutput(outputBuffer.String(), startMarker, endMarker)
	if commandExitCode == -1 {
		// The shell exited before the end marker was printed (e.g. user's command called exit).
		// Fall back to the shell's reported exit code and strip the shell's logout message.
		commandExitCode = res.exitCode
		cleanOutput = stripTrailingLogout(cleanOutput)
	}
	fmt.Print(cleanOutput)

	if res.err != nil {
		return res.err
	}

	if commandExitCode != 0 {
		return &CommandExitError{code: commandExitCode}
	}
	return nil
}

// CommandExitError is returned when a single-command shell exits with a non-zero code.
// It carries the exit code so the main function can exit silently.
type CommandExitError struct {
	code int
}

func (e *CommandExitError) Error() string {
	return fmt.Sprintf("command exited with code %d", e.code)
}

// Code returns the command's exit code.
func (e *CommandExitError) Code() int {
	return e.code
}

func extractCommandOutput(raw, startMarker, endMarker string) (string, int) {
	cleaned := strings.ReplaceAll(stripANSI(raw), "\r", "")
	startIdx := strings.Index(cleaned, startMarker+"\n")
	if startIdx == -1 {
		startIdx = strings.Index(cleaned, startMarker)
	}
	if startIdx == -1 {
		return "", -1
	}
	startIdx += len(startMarker)
	for startIdx < len(cleaned) && cleaned[startIdx] == '\n' {
		startIdx++
	}

	endIdx := strings.Index(cleaned[startIdx:], "\n"+endMarker+":")
	if endIdx == -1 {
		endIdx = strings.Index(cleaned[startIdx:], endMarker+":")
	}

	exitCode := -1
	if endIdx != -1 {
		markerLine := cleaned[startIdx+endIdx:]
		markerLine = strings.TrimPrefix(markerLine, "\n")
		if strings.HasPrefix(markerLine, endMarker+":") {
			codeStr := markerLine[len(endMarker)+1:]
			if nlIdx := strings.IndexAny(codeStr, "\n\r"); nlIdx != -1 {
				codeStr = codeStr[:nlIdx]
			}
			fmt.Sscanf(codeStr, "%d", &exitCode)
		}
	}

	if endIdx == -1 {
		return cleaned[startIdx:], exitCode
	}

	return cleaned[startIdx : startIdx+endIdx], exitCode
}

func stripTrailingLogout(output string) string {
	output = strings.TrimRight(output, "\n\r")
	if !strings.HasSuffix(output, "logout") {
		return output
	}
	output = output[:len(output)-len("logout")]
	output = strings.TrimRight(output, "\n\r")
	return output + "\n"
}

var ansiEscapeRe = regexp.MustCompile("\\[\\??[0-9;]*[a-zA-Z]")

func stripANSI(s string) string {
	return ansiEscapeRe.ReplaceAllString(s, "")
}

func waitForShellReady(ctx context.Context, dataCh <-chan struct{}, quietPeriod, timeout time.Duration) error {
	lastDataTime := time.Now()
	receivedData := false
	deadline := time.After(timeout)
	for {
		select {
		case <-dataCh:
			receivedData = true
			lastDataTime = time.Now()
		case <-deadline:
			if !receivedData {
				return fmt.Errorf("timed out waiting for shell to become ready")
			}
			return nil
		case <-ctx.Done():
			return ctx.Err()
		default:
			if receivedData && time.Since(lastDataTime) >= quietPeriod {
				return nil
			}
			time.Sleep(50 * time.Millisecond)
		}
	}
}

func readShellMessagesForCommand(ctx context.Context, conn *websocket.Conn, output io.Writer, dataCh chan<- struct{}) (int, *shellOutputMessage, error) {
	for {
		messageType, data, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				return 1, nil, fmt.Errorf("connection closed unexpectedly: %w", err)
			}
			return 1, nil, nil
		}

		if messageType != websocket.TextMessage {
			continue
		}

		var msg shellOutputMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}

		switch msg.Case {
		case "data":
			select {
			case dataCh <- struct{}{}:
			default:
			}
			_, _ = output.Write([]byte(msg.Data.Data))
		case "exit":
			_ = conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			return msg.Exit.Code, &msg, nil
		}
	}
}

func runNonInteractiveShell(ctx context.Context, conn *websocket.Conn) error {
	// Read all stdin first so commands are not dropped before the shell is ready.
	stdinData, err := io.ReadAll(os.Stdin)
	if err != nil {
		return fmt.Errorf("read stdin: %w", err)
	}

	type result struct {
		exitCode int
		err      error
	}
	resultCh := make(chan result, 1)
	dataCh := make(chan struct{}, 1)

	go func() {
		exitCode, _, err := readShellMessagesForCommand(ctx, conn, os.Stdout, dataCh)
		resultCh <- result{exitCode: exitCode, err: err}
	}()

	const readyQuietPeriod = 800 * time.Millisecond
	const readyTimeout = 60 * time.Second
	if err := waitForShellReady(ctx, dataCh, readyQuietPeriod, readyTimeout); err != nil {
		return err
	}

	if len(stdinData) > 0 {
		if err := sendShellData(conn, string(stdinData)); err != nil {
			return fmt.Errorf("send stdin data: %w", err)
		}
	}

	var res result
	select {
	case res = <-resultCh:
	case <-ctx.Done():
		return ctx.Err()
	}

	if res.err != nil {
		return res.err
	}
	if res.exitCode != 0 {
		return &CommandExitError{code: res.exitCode}
	}
	return nil
}

func runInteractiveShell(ctx context.Context, conn *websocket.Conn) error {
	oldState, err := term.MakeRaw(int(os.Stdin.Fd()))
	if err != nil {
		return fmt.Errorf("set terminal raw mode: %w", err)
	}
	defer term.Restore(int(os.Stdin.Fd()), oldState)

	done := make(chan struct{})

	go func() {
		buffer := make([]byte, 4096)
		for {
			n, err := os.Stdin.Read(buffer)
			if n > 0 {
				if err := sendShellData(conn, string(buffer[:n])); err != nil {
					return
				}
			}
			if err != nil {
				sendShellDisconnect(conn)
				return
			}
		}
	}()

	go func() {
		readShellMessages(conn, os.Stdout, done)
	}()

	resizeCh := make(chan struct{}, 1)
	watchTerminalResize(resizeCh)

	go func() {
		for {
			select {
			case <-resizeCh:
				cols, rows, err := terminalSize()
				if err == nil {
					sendShellResize(conn, cols, rows)
				}
			case <-done:
				return
			case <-ctx.Done():
				return
			}
		}
	}()

	select {
	case <-done:
	case <-ctx.Done():
	}

	return nil
}

func readShellMessages(conn *websocket.Conn, output io.Writer, done chan<- struct{}) {
	defer close(done)
	for {
		messageType, data, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				fmt.Fprintf(os.Stderr, "\nConnection closed: %v\n", err)
			}
			return
		}

		if messageType != websocket.TextMessage {
			continue
		}

		var msg shellOutputMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}

		switch msg.Case {
		case "data":
			_, _ = output.Write([]byte(msg.Data.Data))
		case "exit":
			fmt.Fprintf(os.Stderr, "\nProcess exited with code %d and signal %s.\n", msg.Exit.Code, msg.Exit.Signal)
			_ = conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			return
		}
	}
}

func sendShellData(conn *websocket.Conn, data string) error {
	msg := shellInputMessage{Case: "data"}
	msg.Data.Data = data
	return conn.WriteJSON(msg)
}

func sendShellResize(conn *websocket.Conn, cols, rows int) error {
	msg := shellInputMessage{Case: "resize"}
	msg.Resize.Cols = cols
	msg.Resize.Rows = rows
	return conn.WriteJSON(msg)
}

func sendShellDisconnect(conn *websocket.Conn) {
	_ = conn.WriteJSON(shellInputMessage{Case: "disconnect"})
}

func terminalSize() (int, int, error) {
	if !term.IsTerminal(int(os.Stdin.Fd())) {
		return 80, 30, errors.New("not a terminal")
	}
	return term.GetSize(int(os.Stdin.Fd()))
}

func watchTerminalResize(resizeCh chan<- struct{}) {
	sigCh := make(chan os.Signal, 1)
	setupTerminalResizeSignal(sigCh)
	go func() {
		for range sigCh {
			select {
			case resizeCh <- struct{}{}:
			default:
			}
		}
	}()
}
