package parent

import (
	"os/exec"
	"sync"
	"testing"
	"time"
)

func TestSameUserCredentials(t *testing.T) {
	tests := []struct {
		name string
		a    userCredentials
		b    userCredentials
		want bool
	}{
		{
			name: "same credentials with reordered groups",
			a:    userCredentials{uid: 1000, gid: 100, groups: []int{100, 200, 300}},
			b:    userCredentials{uid: 1000, gid: 100, groups: []int{300, 100, 200}},
			want: true,
		},
		{
			name: "different primary group",
			a:    userCredentials{uid: 1000, gid: 100, groups: []int{100, 200}},
			b:    userCredentials{uid: 1000, gid: 300, groups: []int{100, 200}},
			want: false,
		},
		{
			name: "different supplementary group",
			a:    userCredentials{uid: 1000, gid: 100, groups: []int{100, 200}},
			b:    userCredentials{uid: 1000, gid: 100, groups: []int{100, 300}},
			want: false,
		},
		{
			name: "different uid",
			a:    userCredentials{uid: 1000, gid: 100, groups: []int{100, 200}},
			b:    userCredentials{uid: 1001, gid: 100, groups: []int{100, 200}},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := sameUserCredentials(tt.a, tt.b); got != tt.want {
				t.Fatalf("sameUserCredentials() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestChildProcessStopIsIdempotent(t *testing.T) {
	cmd := exec.Command("sleep", "30")
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	cp := &ChildProcess{cmd: cmd, userID: "test-user", port: "test-port", done: make(chan struct{})}
	go cp.monitorProcess()

	// 第一个 Stop 执行信号和等待，第二个 Stop 必须复用同一停止流程。
	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs <- cp.Stop()
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatalf("Stop() returned error: %v", err)
		}
	}
}

func TestChildProcessRejectsRequestsAfterStopBegins(t *testing.T) {
	cp := &ChildProcess{port: "unused", lastCheckTime: time.Now()}
	cp.Mu.Lock()
	cp.stopping = true
	cp.Mu.Unlock()
	if cp.CheckAndStartUsing() {
		t.Fatal("CheckAndStartUsing() accepted a request after stopping began")
	}
}

func TestWaitForRequestsTimesOut(t *testing.T) {
	cp := &ChildProcess{}
	cp.wg.Add(1)
	start := time.Now()
	if cp.waitForRequests(10 * time.Millisecond) {
		t.Fatal("waitForRequests() reported completion for a blocked request")
	}
	if elapsed := time.Since(start); elapsed < 10*time.Millisecond {
		t.Fatalf("waitForRequests() returned too early: %v", elapsed)
	}
	cp.wg.Done()
}

func TestReleasePortDoesNotReleaseReplacementChildPort(t *testing.T) {
	old := &ChildProcess{userID: "replacement-test", port: "41001", sessionID: "old-session"}
	newChild := &ChildProcess{userID: "replacement-test", port: "41001", sessionID: "new-session"}
	manager := GlobalChildProcessManager
	manager.mu.Lock()
	previous := manager.childProcesses[old.userID]
	manager.childProcesses[old.userID] = newChild
	manager.mu.Unlock()
	manager.portMu.Lock()
	manager.portPool[old.port] = newChild.sessionID
	manager.portMu.Unlock()
	t.Cleanup(func() {
		manager.mu.Lock()
		if previous == nil {
			delete(manager.childProcesses, old.userID)
		} else {
			manager.childProcesses[old.userID] = previous
		}
		manager.mu.Unlock()
		manager.portMu.Lock()
		delete(manager.portPool, old.port)
		manager.portMu.Unlock()
	})

	old.releasePortOnce()
	manager.portMu.Lock()
	stillOwned := manager.portPool[old.port] != ""
	manager.portMu.Unlock()
	if !stillOwned {
		t.Fatal("old child released a port owned by the replacement child")
	}
}

func TestProcessDoneIncludesManagerCleanup(t *testing.T) {
	cmd := exec.Command("sleep", "30")
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	cp := &ChildProcess{cmd: cmd, userID: "cleanup-test", port: "41002", sessionID: "cleanup-session", done: make(chan struct{})}
	manager := GlobalChildProcessManager
	manager.mu.Lock()
	manager.childProcesses[cp.userID] = cp
	manager.mu.Unlock()
	manager.portMu.Lock()
	manager.portPool[cp.port] = cp.sessionID
	manager.portMu.Unlock()
	go cp.monitorProcess()
	if err := cmd.Process.Kill(); err != nil {
		t.Fatal(err)
	}
	select {
	case <-cp.done:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for process cleanup")
	}
	manager.mu.RLock()
	_, mapped := manager.childProcesses[cp.userID]
	manager.mu.RUnlock()
	if mapped {
		t.Fatal("child mapping still exists after done notification")
	}
	manager.portMu.Lock()
	_, reserved := manager.portPool[cp.port]
	manager.portMu.Unlock()
	if reserved {
		t.Fatal("port still reserved after done notification")
	}
}
