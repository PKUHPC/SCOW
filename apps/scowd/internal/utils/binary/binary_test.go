package binary

import (
	"testing"
	"time"
)

func setExpireTime(t *testing.T, value string) {
	t.Helper()
	previous := ExpireTime
	ExpireTime = value
	t.Cleanup(func() { ExpireTime = previous })
}

func waitForExpirationCheck(t *testing.T, done <-chan struct{}) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("expiration checker did not exit")
	}
}

func TestExpirationCheckStopsWithoutTick(t *testing.T) {
	setExpireTime(t, time.Now().Add(-time.Hour).Format(time.RFC3339))
	stop := make(chan struct{})
	expired := make(chan struct{})
	done := make(chan struct{})
	go func() {
		defer close(done)
		checkExpiration(stop, make(chan time.Time), expired)
	}()

	close(stop)
	waitForExpirationCheck(t, done)
	select {
	case <-expired:
		t.Fatal("stopping the checker must not signal expiration")
	default:
	}
}

func TestExpirationCheckNotifiesWithoutReceiver(t *testing.T) {
	for _, value := range []string{time.Now().Add(-time.Hour).Format(time.RFC3339), "invalid"} {
		t.Run(value, func(t *testing.T) {
			setExpireTime(t, value)
			stop := make(chan struct{})
			expired := make(chan struct{})
			ticks := make(chan time.Time, 1)
			ticks <- time.Now()
			done := make(chan struct{})
			go func() {
				defer close(done)
				checkExpiration(stop, ticks, expired)
			}()

			// 不接收通知也必须退出，覆盖主进程已经选择 SIGTERM 分支的情况。
			waitForExpirationCheck(t, done)
			select {
			case <-expired:
			default:
				t.Fatal("expected expiration notification")
			}
			close(stop)
		})
	}
}

func TestExpirationCheckContinuesUntilStopped(t *testing.T) {
	for _, value := range []string{"", time.Now().Add(time.Hour).Format(time.RFC3339)} {
		t.Run(value, func(t *testing.T) {
			setExpireTime(t, value)
			stop := make(chan struct{})
			expired := make(chan struct{})
			ticks := make(chan time.Time)
			done := make(chan struct{})
			go func() {
				defer close(done)
				checkExpiration(stop, ticks, expired)
			}()

			for i := 0; i < 2; i++ {
				select {
				case ticks <- time.Now():
				case <-time.After(time.Second):
					t.Fatal("expiration checker stopped before shutdown")
				}
			}
			close(stop)
			waitForExpirationCheck(t, done)
			select {
			case <-expired:
				t.Fatal("unexpired binary must not signal expiration")
			default:
			}
		})
	}
}

func TestExpirationCheckConcurrentStopAndTick(t *testing.T) {
	setExpireTime(t, time.Now().Add(-time.Hour).Format(time.RFC3339))
	for i := 0; i < 100; i++ {
		stop := make(chan struct{})
		expired := make(chan struct{})
		ticks := make(chan time.Time, 1)
		done := make(chan struct{})
		go func() {
			defer close(done)
			checkExpiration(stop, ticks, expired)
		}()

		ticks <- time.Now()
		close(stop)
		// 两种事件同时发生时允许任一分支先执行，但不能 panic 或等待通知接收方。
		waitForExpirationCheck(t, done)
	}
}
