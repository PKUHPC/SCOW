package job

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"

	craneProtos "scow-adapters/gen/crane-ai"
	protos "scow-adapters/gen/go"
	ce "scow-adapters/pkg/common/error"
	"scow-adapters/pkg/crane-ai/client"
	"scow-adapters/pkg/crane-ai/utils"
)

// TerminalSizeQueue 复用原有终端大小队列（适配 gRPC 调整请求）
type TerminalSizeQueue struct {
	resizeCh chan remotecommand.TerminalSize
	done     chan struct{}
}

// NewTerminalSizeQueue 初始化终端大小队列
func NewTerminalSizeQueue() *TerminalSizeQueue {
	return &TerminalSizeQueue{
		resizeCh: make(chan remotecommand.TerminalSize, 1),
		done:     make(chan struct{}),
	}
}

func (t *TerminalSizeQueue) Next() *remotecommand.TerminalSize {
	select {
	case size := <-t.resizeCh:
		return &size
	case <-t.done:
		return nil
	}
}

func (t *TerminalSizeQueue) Stop() {
	close(t.done)
}

// waitForConnect 等待连接请求
func (s *ServerJob) waitForConnect(stream protos.JobService_StreamJobShellServer) (*protos.StreamJobShellRequest_Connect, error) {
	// 等待第一个消息，必须是连接请求
	ctx, cancel := context.WithTimeout(stream.Context(), 10*time.Second)
	defer cancel()

	type result struct {
		req *protos.StreamJobShellRequest
		err error
	}

	ch := make(chan result, 1)

	go func() {
		req, err := stream.Recv()
		ch <- result{req, err}
	}()

	select {
	case <-ctx.Done():
		return nil, fmt.Errorf("waiting for connection request timeout")
	case res := <-ch:
		if res.err != nil {
			return nil, fmt.Errorf("failed to receive request: %v", res.err)
		}

		// 检查是否是连接请求
		connectReq := res.req.GetConnect()
		if connectReq == nil {
			return nil, fmt.Errorf("the first message must be a connection request")
		}

		return connectReq, nil
	}
}

func (s *ServerJob) getJobIdStepIdNodeName(connectReq *protos.StreamJobShellRequest_Connect) (uint32, uint32, string, error) {
	connectJobId := connectReq.JobId
	if connectJobId == "" {
		return 0, 0, "", fmt.Errorf("job id cannot be empty")
	}

	jobIDInt, err := strconv.ParseUint(connectJobId, 10, 32)
	if err != nil {
		return 0, 0, "", fmt.Errorf("invalid job ID: %s", connectReq.JobId)
	}
	jobID := uint32(jobIDInt)

	podName := connectReq.PodName
	if podName == "" {
		return 0, 0, "", fmt.Errorf("pod name cannot be empty")
	}

	parts := strings.Split(podName, utils.StepToPodNameEscape)
	// 校验拆分后的片段数量（必须是3段：JobId:::StepId:::nodeName）
	if len(parts) != 3 {
		return 0, 0, "", fmt.Errorf("podName formatting error, need to be JobId:::StepId:::nodeName, current value: %s", podName)
	}

	jobIdStr := parts[0]
	parsedJobId64, err := strconv.ParseUint(jobIdStr, 10, 32)
	if err != nil {
		return 0, 0, "", fmt.Errorf("parsing JobId %s failed: %w", jobIdStr, err)
	}
	parsedJobId := uint32(parsedJobId64)

	if parsedJobId != jobID {
		return 0, 0, "", fmt.Errorf("JobId is inconsistent，pass in the value: %d, value parsed from containerName: %d", jobID, parsedJobId)
	}

	stepIdStr := parts[1]
	stepId64, err := strconv.ParseUint(stepIdStr, 10, 32)
	if err != nil {
		return 0, 0, "", fmt.Errorf("StepId parsing failed: %s, error: %w", stepIdStr, err)
	}
	stepId := uint32(stepId64)

	nodeName := parts[2]
	if nodeName == "" {
		return 0, 0, "", fmt.Errorf("the nodeName field in containerName cannot be empty")
	}

	return parsedJobId, stepId, nodeName, nil
}

func (s *ServerJob) resolveTargetNode(step *craneProtos.StepInfo) (string, error) {
	executionNodes := step.GetExecutionNode()
	switch len(executionNodes) {
	case 0:
		return "", fmt.Errorf("execution node list of this step is empty")
	case 1:
		return executionNodes[0], nil
	default:
		return "", fmt.Errorf("container is running on multiple nodes: %s; please specify --target-node to select one", step.GetCranedList())
	}
}

// createContainerExecStream 创建容器执行流
func (s *ServerJob) createContainerExecStream(jobID, stepID, uid uint32, nodeName string) (string, error) {
	// 创建 exec 请求
	execReq := &craneProtos.ExecInContainerStepRequest{
		Uid:      uid,
		JobId:    jobID,
		StepId:   stepID,
		NodeName: nodeName,
		Command:  []string{"/bin/sh"}, // 默认使用 sh
		Stdin:    true,
		Tty:      true,
		Stdout:   true,
		Stderr:   false, // 在 TTY 模式下，stderr 和 stdout 合并
	}

	log.Debugf("Calling ExecInContainerStep RPC for container %d.%d on node %q",
		jobID, stepID, nodeName)

	reply, err := client.CallCraneCtldForUID(uid, func(ctldClient craneProtos.CraneCtldClient) (*craneProtos.ExecInContainerStepReply, error) {
		return ctldClient.ExecInContainerStep(context.Background(), execReq)
	})
	if err != nil {
		return "", fmt.Errorf("failed to exec into container task: %v", err)
	}

	if !reply.Ok {
		return "", fmt.Errorf("exec failed: %s", reply.GetStatus().GetDescription())
	}

	log.Debugf("Exec request successful for container %d.%d, stream URL: %s",
		jobID, stepID, reply.Url)

	return reply.Url, nil
}

// createContainerExecutor 创建容器流执行器
func (s *ServerJob) createContainerExecutor(streamURL string) (remotecommand.Executor, error) {
	parsedURL, err := url.Parse(streamURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse stream address: %v", err)
	}

	// 构建 rest 配置（禁用 TLS 验证，生产环境需调整）
	config := &rest.Config{
		Host: fmt.Sprintf("%s://%s", parsedURL.Scheme, parsedURL.Host),
		TLSClientConfig: rest.TLSClientConfig{
			Insecure: true,
		},
	}

	// 复用原有 createExecutor 逻辑
	return createExecutor(config, parsedURL)
}

// runContainerStream 启动容器流处理
func (s *ServerJob) runContainerStream(
	ctx context.Context,
	executor remotecommand.Executor,
	stdin io.Reader,
	stdout io.Writer,
	sizeQueue *TerminalSizeQueue,
	errChan chan<- error,
) {
	defer close(errChan)

	streamOpts := remotecommand.StreamOptions{
		Stdin:             stdin,
		Stdout:            stdout,
		Stderr:            nil, // TTY 模式下关闭 stderr
		Tty:               true,
		TerminalSizeQueue: sizeQueue,
	}

	log.Infof("Start container stream")
	errChan <- executor.StreamWithContext(ctx, streamOpts)
}

// forwardContainerOutput 将容器输出转发到 gRPC 客户端
func (s *ServerJob) forwardContainerOutput(
	stdout io.Reader,
	stream protos.JobService_StreamJobShellServer,
	done chan<- struct{},
) {
	defer close(done)
	defer stdout.(*io.PipeReader).Close()

	buf := make([]byte, 4096)
	for {
		n, err := stdout.Read(buf)
		if n > 0 {
			// 发送容器输出到客户端
			if err := stream.Send(&protos.StreamJobShellResponse{
				Payload: &protos.StreamJobShellResponse_Data{
					Data: &protos.StreamJobShellResponse_DataOutput{
						Data: buf[:n],
					},
				},
			}); err != nil {
				log.Errorf("Sending container output failed: %v", err)
				return
			}
		}
		if err != nil {
			if err != io.EOF {
				log.Errorf("Failed to read container output: %v", err)
			}
			return
		}
	}
}

// handleClientRequests 处理客户端后续请求（输入/调整终端/断开）
func (s *ServerJob) handleClientRequests(
	stream protos.JobService_StreamJobShellServer,
	stdin io.Writer,
	sizeQueue *TerminalSizeQueue,
	done chan<- struct{},
) {
	defer close(done)
	defer stdin.(*io.PipeWriter).Close()

	for {
		req, err := stream.Recv()
		if err != nil {
			if err == io.EOF {
				log.Debug("Client disconnects")
			} else {
				log.Errorf("Reading client request failed: %v", err)
			}
			return
		}

		// 解析请求类型
		switch payload := req.Payload.(type) {
		case *protos.StreamJobShellRequest_Data:
			// 客户端输入数据 -> 容器 stdin
			if payload.Data != nil && payload.Data.Data != "" {
				_, err := stdin.Write([]byte(payload.Data.Data))
				if err != nil {
					log.Errorf("Writing to container input failed: %v", err)
					return
				}
			}
		case *protos.StreamJobShellRequest_Resize:
			// 终端大小调整
			if payload.Resize != nil {
				size := remotecommand.TerminalSize{
					Width:  uint16(payload.Resize.Cols),
					Height: uint16(payload.Resize.Rows),
				}
				select {
				case sizeQueue.resizeCh <- size:
				default:
					log.Warn("Terminal size queue is full, drop adjustment requests")
				}
			}
		case *protos.StreamJobShellRequest_Disconnect:
			// 客户端主动断开
			log.Debug("The client requested to disconnect.")
			return
		case *protos.StreamJobShellRequest_Connect_:
			// 忽略重复的 Connect 请求
			log.Warn("Duplicate Connect requests received, ignored")
		default:
			log.Warnf("Unknown request type: %T", req.Payload)
		}
	}
}

// handleStreamExit 处理流退出并返回退出信息给客户端
func (s *ServerJob) handleStreamExit(
	stream protos.JobService_StreamJobShellServer,
	streamErr error,
) error {
	if streamErr == nil {
		// 正常退出
		_ = stream.Send(&protos.StreamJobShellResponse{
			Payload: &protos.StreamJobShellResponse_Exit{
				Exit: &protos.StreamJobShellResponse_ExitOutput{Code: 0},
			},
		})
		return nil
	}
	message := fmt.Errorf("container exec failed %v", streamErr)
	log.Errorf("[StreamJobShell] %v", message)
	return ce.RichError(codes.Internal, "STREAM_JOB_SHELL_FAILED", message.Error())
}

func createExecutor(config *rest.Config, parsedURL *url.URL) (remotecommand.Executor, error) {
	tr, err := rest.TransportFor(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create transport: %w", err)
	}

	if httpTransport, ok := tr.(*http.Transport); ok {
		if httpTransport.TLSClientConfig == nil {
			httpTransport.TLSClientConfig = &tls.Config{}
		}
		httpTransport.TLSClientConfig.InsecureSkipVerify = true
	}

	return createSPDYExecutor(config, parsedURL)
}

func createSPDYExecutor(config *rest.Config, parsedURL *url.URL) (remotecommand.Executor, error) {
	spdyExecutor, err := remotecommand.NewSPDYExecutor(config, "POST", parsedURL)
	if err != nil {
		return nil, fmt.Errorf("failed to create SPDY executor: %w", err)
	}
	log.Debug("Using SPDY executor")
	return spdyExecutor, nil
}
