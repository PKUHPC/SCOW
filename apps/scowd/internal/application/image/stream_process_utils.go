package image

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os/exec"
	"regexp"
	"strings"
	"sync"

	"github.com/sirupsen/logrus"
)

// BuildOciCommand 构建并返回最终的命令和参数
// command: 基础命令，例如 "nerdctl" 或 "nerdctl -n k8s.io"
// args: 附加的参数，例如 []string{"pull", "nginx"}
// 返回值:
//   - string: 最终的执行命令，如 "nerdctl"
//   - []string: 最终的参数列表，如 []string{"-n", "k8s.io", "pull", "nginx"}
//   - error: 构建过程中的错误
func BuildOciCommand(command string, args []string) (string, []string, error) {
	if command == "" {
		return "", nil, fmt.Errorf("command cannot be empty")
	}

	// 如果 command 包含空格，说明是像 "nerdctl -n k8s.io" 这样的形式
	if strings.Contains(command, " ") {
		parts := strings.Fields(command) // 自动按空白符分割
		if len(parts) == 0 {
			// 通常不会发生，因为上面检查了command不为空
			return "", nil, fmt.Errorf("empty command after parsing: %q", command)
		}
		baseCmd := parts[0]
		baseArgs := parts[1:]
		finalArgs := append(baseArgs, args...)
		return baseCmd, finalArgs, nil
	}

	// 否则，command本身是基础命令，直接附加参数
	return command, args, nil
}

var (
	// ANSI转义序列与颜色相关的正则表达式
	ansiColorRegex = regexp.MustCompile(`\x1b\[[0-9;]*m`)
	// docker进度相关的正则表达式
	dockerProgressRegex = regexp.MustCompile(`\[[=>\s]*\]\s*\d+\.?\d*%`)
	// nerd进度相关的正则表达式
	nerdProgressRegex = regexp.MustCompile(`\|[-+]+\|`)
)

type OutputFormatOptions struct {
	FilterProgress bool
	AddNewlines    bool
}

// format 返回流的格式
// 对于进度相关的流，过滤掉ANSI码颜色相关的转义序列
// 对于系统日志相关信息流，确保增加换行符
func FormatStreamOutput(content string, options OutputFormatOptions) string {
	formatted := content
	if options.FilterProgress {
		// （1）移除ANSI相关转义序列
		formatted = ansiColorRegex.ReplaceAllString(formatted, "")
		// (2) 移除docker进度相关
		formatted = dockerProgressRegex.ReplaceAllString(formatted, "")
		// (3) 移除nerd进度相关
		formatted = nerdProgressRegex.ReplaceAllString(formatted, "")
	}

	if options.AddNewlines {
		lines := strings.Split(formatted, "\n")
		var result []string

		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line != "" {
				// 如果行不以换行符结尾，确保添加
				if !strings.HasSuffix(line, "\n") {
					line += "\n"
				}
				result = append(result, line)
			}
		}
		formatted = strings.Join(result, "")
	}
	return formatted
}

// 流式输出处理器接口
type StreamingSender interface {
	SendStdout(content string, options OutputFormatOptions) error
	SendStderr(content string, options OutputFormatOptions) error
}

// 因为无需考虑ANSI控制码
// 使用 bufio.Scanner 按行返回更合理
// Scan() 无需考虑EOF
func handleStream(
	ctx context.Context,
	pipe io.ReadCloser,
	sendFunc func(string, OutputFormatOptions) error,
	streamName string,
	wg *sync.WaitGroup,
) {
	defer func() {
		// 确保管道被关闭
		if pipe != nil {
			if err := pipe.Close(); err != nil {
				logrus.Errorf("Failed to close pipe for %s: %v", streamName, err)
			}
		}
		wg.Done()
	}()

	scanner := bufio.NewScanner(pipe)

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			logrus.Infof("%s processing cancelled", streamName)
			return
		default:
		}

		line := scanner.Text()
		if err := sendFunc(line+"\n", OutputFormatOptions{
			FilterProgress: true,
		}); err != nil {
			logrus.Errorf("Failed to send %s: %v", streamName, err)
		}
	}

	if err := scanner.Err(); err != nil {
		logrus.Errorf("Error scanning %s: %v", streamName, err)
	}
}

// ExecOciCommandStreamingBuffered 通用的流式命令执行函数
func ExecOciCommandStreamingBuffered(
	ctx context.Context,
	command string,
	args []string,
	sender StreamingSender,
	stdin ...io.Reader,
) (int, error) {
	baseCmd, finalArgs, buildErr := BuildOciCommand(command, args)
	if buildErr != nil {
		return 1, buildErr
	}
	logrus.Infof("Executing buffered command: %s %s", baseCmd, RedactSensitiveArgs(finalArgs))

	cmd := exec.CommandContext(ctx, baseCmd, finalArgs...)
	if len(stdin) > 0 {
		cmd.Stdin = stdin[0]
	}

	// 创建管道
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return 1, fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return 1, fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	// 启动命令
	if err := cmd.Start(); err != nil {
		return 1, fmt.Errorf("failed to start command: %w", err)
	}

	var wg sync.WaitGroup
	// stdout 和 stderr的 goroutine
	wg.Add(2)

	// stdout 处理 goroutine
	go handleStream(ctx, stdoutPipe, sender.SendStdout, "stdout", &wg)
	// stderr 处理 goroutine
	go handleStream(ctx, stderrPipe, sender.SendStderr, "stderr", &wg)

	// 等待命令完成
	err = cmd.Wait()
	wg.Wait()

	exitCode := 0

	if err != nil {
		if ctx.Err() != nil {
			logrus.Warnf("Command cancelled by context")
			return 130, nil
		}

		if exitError, ok := err.(*exec.ExitError); ok {
			exitCode = exitError.ExitCode()
			logrus.Warnf("Command exited with code: %d", exitCode)
		} else {
			exitCode = 1
			logrus.Errorf("Command failed: %v", err)
		}
	}

	logrus.Infof("Command completed with exit code: %d", exitCode)
	return exitCode, nil
}

// RedactSensitiveArgs removes values passed to password options before logging.
func RedactSensitiveArgs(args []string) string {
	redacted := append([]string(nil), args...)
	for i := range redacted {
		if (redacted[i] == "-p" || redacted[i] == "--password") && i+1 < len(redacted) {
			redacted[i+1] = "[REDACTED]"
		}
	}
	return strings.Join(redacted, " ")
}
