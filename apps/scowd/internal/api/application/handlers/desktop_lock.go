package handlers

import "sync"

// userDesktopLocks serializes the quota check and creation of desktops for a
// user. scowd runs as a single instance, so an in-process lock is sufficient
// and avoids allowing concurrent requests to pass the same quota check.
type userDesktopLocks struct {
	mu    sync.Mutex
	locks map[string]*sync.Mutex
}

func (l *userDesktopLocks) lock(userID string) func() {
	l.mu.Lock()
	if l.locks == nil {
		l.locks = make(map[string]*sync.Mutex)
	}
	lock, ok := l.locks[userID]
	if !ok {
		lock = &sync.Mutex{}
		l.locks[userID] = lock
	}
	l.mu.Unlock()

	lock.Lock()
	return lock.Unlock
}

var desktopCreateLocks userDesktopLocks
