package utils

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/sirupsen/logrus"
)

type SafeChannel[T any] struct {
	dataCh    chan T
	closed    int32
	closeOnce sync.Once
	mu        sync.Mutex
	cond      *sync.Cond
}

func NewSafeChannel[T any](bufferSize int) *SafeChannel[T] {
	sc := &SafeChannel[T]{
		dataCh: make(chan T, bufferSize),
	}
	sc.cond = sync.NewCond(&sc.mu)
	go sc.monitor() // 启动监控协程
	return sc
}

func (sc *SafeChannel[T]) Send(value T) error {
	if atomic.LoadInt32(&sc.closed) != 0 {
		return fmt.Errorf("channel closed")
	}

	sc.mu.Lock()
	defer sc.mu.Unlock()

	for len(sc.dataCh) == cap(sc.dataCh) {
		if atomic.LoadInt32(&sc.closed) != 0 {
			logrus.Errorf("channel closed")
			return fmt.Errorf("channel closed")
		}
		sc.cond.Wait() // 等待通道有空位
	}

	select {
	case sc.dataCh <- value:
		sc.cond.Broadcast() // 通知接收方
		return nil
	default:
		return fmt.Errorf("channel closed")
	}
}

func (sc *SafeChannel[T]) monitor() {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		sc.cond.Broadcast()
	}
}

func (sc *SafeChannel[T]) Close() {
	sc.closeOnce.Do(func() {
		sc.mu.Lock()
		defer sc.mu.Unlock()
		atomic.StoreInt32(&sc.closed, 1)
		close(sc.dataCh)
		sc.cond.Broadcast()
	})
}

// Receive 接收数据
func (sc *SafeChannel[T]) Receive() <-chan T {
	return sc.dataCh
}
