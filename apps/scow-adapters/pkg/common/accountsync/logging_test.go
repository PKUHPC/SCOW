package accountsync

import (
	"bytes"
	"context"
	"testing"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

func TestLoggingWrappersRespectLogLevelBeforeBuildingArguments(t *testing.T) {
	originalLevel := logrus.GetLevel()
	originalOutput := logrus.StandardLogger().Out
	t.Cleanup(func() {
		logrus.SetLevel(originalLevel)
		logrus.SetOutput(originalOutput)
	})

	var output bytes.Buffer
	logrus.SetOutput(&output)
	ctx := WithSyncID(context.Background(), "sync-1")

	logrus.SetLevel(logrus.InfoLevel)
	Tracef(ctx, "trace message")
	Debugf(ctx, "debug message")
	Errorf(ctx, "error message")
	assertLogOutput(t, output.String(), "trace message", false)
	assertLogOutput(t, output.String(), "debug message", false)
	assertLogOutput(t, output.String(), "error message", true)

	output.Reset()
	logrus.SetLevel(logrus.TraceLevel)
	Tracef(ctx, "trace message")
	require.Contains(t, output.String(), "trace message")
}

func assertLogOutput(t *testing.T, output, message string, expected bool) {
	t.Helper()
	if expected {
		require.Contains(t, output, message)
		return
	}
	require.NotContains(t, output, message)
}
