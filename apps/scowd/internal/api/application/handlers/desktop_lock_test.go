package handlers

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestUserDesktopLocksSerializesSameUser(t *testing.T) {
	var locks userDesktopLocks
	var active int32
	var maxActive int32
	var wg sync.WaitGroup

	for i := 0; i < 16; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			unlock := locks.lock("alice")
			defer unlock()

			current := atomic.AddInt32(&active, 1)
			for {
				previous := atomic.LoadInt32(&maxActive)
				if current <= previous || atomic.CompareAndSwapInt32(&maxActive, previous, current) {
					break
				}
			}
			atomic.AddInt32(&active, -1)
		}()
	}

	wg.Wait()
	if got := atomic.LoadInt32(&maxActive); got != 1 {
		t.Fatalf("same user entered critical section %d times concurrently, want 1", got)
	}
}

func TestUserDesktopLocksAllowDifferentUsersConcurrently(t *testing.T) {
	var locks userDesktopLocks
	firstEntered := make(chan struct{})
	secondEntered := make(chan struct{})
	release := make(chan struct{})

	go func() {
		unlock := locks.lock("alice")
		defer unlock()
		close(firstEntered)
		<-release
	}()
	<-firstEntered

	go func() {
		unlock := locks.lock("bob")
		defer unlock()
		close(secondEntered)
	}()

	select {
	case <-secondEntered:
	case <-time.After(time.Second):
		t.Fatal("different user was blocked by another user's lock")
	}
	close(release)
}
