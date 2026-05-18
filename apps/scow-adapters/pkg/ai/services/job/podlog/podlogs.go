package podlogs

import (
	"errors"
	"io"
	"io/ioutil"
)

var (
	ErrPodNotFound      = errors.New(`no logs return,because not found instance`)
	ErrTooManyPodsFound = errors.New(`too many pods found in the job`)
)

type PodLogPrinter struct {
	PodNames []string
	PodLog   *PodLog
	Pipe
}

type Pipe struct {
	Reader io.ReadCloser
	Writer io.WriteCloser
}

func NewPodLogPrinter(podNames []string, logArgs *OuterRequestArgs) (*PodLogPrinter, error) {
	podLog, err := NewPodLog(logArgs)
	if err != nil {
		return nil, err
	}
	piper, pipew := io.Pipe()
	pipe := Pipe{Reader: piper, Writer: pipew}
	return &PodLogPrinter{
		PodNames: podNames,
		PodLog:   podLog,
		Pipe:     pipe,
	}, nil
}

func (slp *PodLogPrinter) CheckPodIsInJob() error {
	podName := slp.PodLog.Args.PodName
	names := slp.PodNames
	switch length := len(names); {
	case length == 0:
		return ErrPodNotFound
	case length == 1:
		if podName == "" {
			slp.PodLog.Args.PodName = names[0]
			return nil
		} else if podName == names[0] {
			return nil
		}
		return ErrPodNotFound
	default:
		if podName == "" {
			return ErrTooManyPodsFound
		}
		for _, name := range names {
			if name == podName {
				return nil
			}
		}
		return ErrPodNotFound
	}
}

func (slp *PodLogPrinter) Reader() ([]byte, error) {
	var content []byte
	var err error
	defer slp.Pipe.Reader.Close()
	if err = slp.CheckPodIsInJob(); err != nil {
		if err == ErrTooManyPodsFound {
			return content, nil
		}
		return content, err
	}
	if err = slp.PodLog.GetPodLogEntry(func(reader io.ReadCloser) {
		defer slp.Pipe.Writer.Close()
		defer reader.Close()
		io.Copy(slp.Pipe.Writer, reader)
	}); err != nil {
		return content, err
	}
	content, err = ioutil.ReadAll(slp.Pipe.Reader)
	return content, nil
}
