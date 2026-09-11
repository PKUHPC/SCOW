package stream

import (
	"scowd/pkg/utils/image"
	apiv1 "scowd/protos/gen/api/application"
	"sync"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
)

// Pull 操作的发送器
type PullStreamSender struct {
	stream *connect.ServerStream[apiv1.PullImageResponse]
	mu     sync.Mutex
}

func (p *PullStreamSender) SendStdout(content string, options image.OutputFormatOptions) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	content = image.FormatStreamOutput(content, options)
	logrus.Debugf("Command output formatted data of pulling image stdout: %q", content)
	err := p.stream.Send(&apiv1.PullImageResponse{
		Message: &apiv1.PullImageResponse_Output{
			Output: &apiv1.OutputLine{
				StdoutContent: content,
			},
		},
	})

	if err != nil {
		// 不抛出错误继续执行
		logrus.Errorf("Failed to send pull stdout content: %v", err)
	}
	return nil
}

func (p *PullStreamSender) SendStderr(content string, options image.OutputFormatOptions) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	content = image.FormatStreamOutput(content, options)
	logrus.Debugf("Command output formatted data of pulling image stderr: %q", content)
	err := p.stream.Send(&apiv1.PullImageResponse{
		Message: &apiv1.PullImageResponse_Output{
			Output: &apiv1.OutputLine{
				StdoutContent: content,
				StderrContent: &content,
			},
		},
	})

	if err != nil {
		// 不抛出错误继续执行
		logrus.Errorf("Failed to send pull stderr content: %v", err)
	}
	return nil
}

// Push 操作的发送器
type PushStreamSender struct {
	stream *connect.ServerStream[apiv1.PushImageToHarborResponse]
	mu     sync.Mutex
}

func (p *PushStreamSender) SendStdout(content string, options image.OutputFormatOptions) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	content = image.FormatStreamOutput(content, options)
	logrus.Debugf("Command output formatted data of pushing image stdout: %q", content)
	err := p.stream.Send(&apiv1.PushImageToHarborResponse{
		Message: &apiv1.PushImageToHarborResponse_Output{
			Output: &apiv1.OutputLine{
				StdoutContent: content,
			},
		},
	})
	if err != nil {
		// 不抛出错误继续执行
		logrus.Errorf("Failed to send push stdout content: %v", err)
	}
	return nil
}
func (p *PushStreamSender) SendStderr(content string, options image.OutputFormatOptions) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	content = image.FormatStreamOutput(content, options)
	logrus.Debugf("Command output formatted data of pushing image stderr: %q", content)

	err := p.stream.Send(&apiv1.PushImageToHarborResponse{
		Message: &apiv1.PushImageToHarborResponse_Output{
			Output: &apiv1.OutputLine{
				StderrContent: &content,
			},
		},
	})
	if err != nil {
		// 不抛出错误继续执行
		logrus.Errorf("Failed to send push stderr content: %v", err)
	}
	return nil
}

func NewPullSender(stream *connect.ServerStream[apiv1.PullImageResponse]) *PullStreamSender {
	return &PullStreamSender{stream: stream}
}

func NewPushSender(stream *connect.ServerStream[apiv1.PushImageToHarborResponse]) *PushStreamSender {
	return &PushStreamSender{stream: stream}
}
