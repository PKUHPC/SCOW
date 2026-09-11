package process

import (
	"errors"
	"scowd/global/parent"
	customError "scowd/pkg/error"

	"github.com/sirupsen/logrus"
)

func GetChildProcess(userID string) (*parent.ChildProcess, error) {
	childProcess, err := parent.GlobalChildProcessManager.GetOrCreateChildProcess(userID)
	if err != nil {
		logrus.Errorf("Start child process for user failed: %s", err)
		return nil, errors.New(customError.MainStartChildProcessError)
	}

	return childProcess, nil
}
