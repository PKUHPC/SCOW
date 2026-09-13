package process

import (
	"errors"
	customError "github.com/PKUHPC/private-scow/apps/scowd/internal/api/rpcerror"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/process/parent"

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
