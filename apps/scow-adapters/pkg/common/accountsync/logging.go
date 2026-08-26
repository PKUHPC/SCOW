package accountsync

import (
	"context"

	"github.com/sirupsen/logrus"
)

type syncIDContextKey struct{}

func WithSyncID(ctx context.Context, syncID string) context.Context {
	return context.WithValue(ctx, syncIDContextKey{}, syncID)
}

func syncIDFromContext(ctx context.Context) string {
	syncID, _ := ctx.Value(syncIDContextKey{}).(string)
	return syncID
}

func Tracef(ctx context.Context, format string, args ...interface{}) {
	if !logrus.IsLevelEnabled(logrus.TraceLevel) {
		return
	}
	args = append([]interface{}{syncIDFromContext(ctx)}, args...)
	logrus.Tracef("[SyncAccountUser syncId=%q] "+format, args...)
}

func Debugf(ctx context.Context, format string, args ...interface{}) {
	if !logrus.IsLevelEnabled(logrus.DebugLevel) {
		return
	}
	args = append([]interface{}{syncIDFromContext(ctx)}, args...)
	logrus.Debugf("[SyncAccountUser syncId=%q] "+format, args...)
}

func Errorf(ctx context.Context, format string, args ...interface{}) {
	if !logrus.IsLevelEnabled(logrus.ErrorLevel) {
		return
	}
	args = append([]interface{}{syncIDFromContext(ctx)}, args...)
	logrus.Errorf("[SyncAccountUser syncId=%q] "+format, args...)
}
