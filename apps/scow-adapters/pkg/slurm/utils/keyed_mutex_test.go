package utils

import (
	"context"
	"testing"
	"time"
)

func TestKeyedMutexSerializesSameKey(t *testing.T) {
	var mutex KeyedMutex
	unlock := mutex.Lock("accountA")
	attempted := make(chan struct{})
	acquired := make(chan struct{})

	go func() {
		close(attempted)
		defer mutex.Lock("accountA")()
		close(acquired)
	}()
	<-attempted

	select {
	case <-acquired:
		t.Fatal("same key acquired before the first lock was released")
	case <-time.After(20 * time.Millisecond):
	}

	unlock()
	select {
	case <-acquired:
	case <-time.After(time.Second):
		t.Fatal("same key was not acquired after release")
	}
}

func TestAccountAssociationMutationLockSerializesSameAccount(t *testing.T) {
	unlock, err := LockAccountAssociationMutation(context.Background(), "accountA")
	if err != nil {
		t.Fatalf("lock account association mutation: %v", err)
	}
	attempted := make(chan struct{})
	acquired := make(chan struct{})

	go func() {
		close(attempted)
		unlock, err := LockAccountAssociationMutation(context.Background(), "accountA")
		if err != nil {
			return
		}
		defer unlock()
		close(acquired)
	}()
	<-attempted

	select {
	case <-acquired:
		t.Fatal("same account mutation started before the first mutation finished")
	case <-time.After(20 * time.Millisecond):
	}

	unlock()
	select {
	case <-acquired:
	case <-time.After(time.Second):
		t.Fatal("same account mutation did not start after release")
	}
}

func TestAllAssociationMutationLockWaitsForAccountMutation(t *testing.T) {
	unlockAccount, err := LockAccountAssociationMutation(context.Background(), "accountA")
	if err != nil {
		t.Fatalf("lock account association mutation: %v", err)
	}
	attempted := make(chan struct{})
	acquired := make(chan struct{})

	go func() {
		close(attempted)
		unlock, err := LockAllAssociationMutations(context.Background())
		if err != nil {
			return
		}
		defer unlock()
		close(acquired)
	}()
	<-attempted

	select {
	case <-acquired:
		t.Fatal("global mutation started while an account mutation was running")
	case <-time.After(20 * time.Millisecond):
	}

	unlockAccount()
	select {
	case <-acquired:
	case <-time.After(time.Second):
		t.Fatal("global mutation did not start after account mutation release")
	}
}

func TestAssociationMutationLockStopsWaitingWhenContextIsCanceled(t *testing.T) {
	unlock, err := LockAccountAssociationMutation(context.Background(), "accountA")
	if err != nil {
		t.Fatalf("lock account association mutation: %v", err)
	}
	defer unlock()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = LockAccountAssociationMutation(ctx, "accountA")
	if err == nil {
		t.Fatal("expected canceled lock acquisition to fail")
	}
	if err != context.Canceled {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
}

func TestAllAssociationMutationLockStopsWaitingWhenContextExpires(t *testing.T) {
	unlock, err := LockAccountAssociationMutation(context.Background(), "accountA")
	if err != nil {
		t.Fatalf("lock account association mutation: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	started := time.Now()
	_, err = LockAllAssociationMutations(ctx)
	if err != context.DeadlineExceeded {
		t.Fatalf("expected context.DeadlineExceeded, got %v", err)
	}
	if elapsed := time.Since(started); elapsed > time.Second {
		t.Fatalf("global lock did not stop waiting promptly: %v", elapsed)
	}

	// 已取消的全局等待必须从信号量队列移除，不能继续阻止后续账户操作。
	unlock()
	nextCtx, nextCancel := context.WithTimeout(context.Background(), time.Second)
	defer nextCancel()
	nextUnlock, err := LockAccountAssociationMutation(nextCtx, "accountB")
	if err != nil {
		t.Fatalf("account mutation remained blocked after global wait cancellation: %v", err)
	}
	nextUnlock()
}
