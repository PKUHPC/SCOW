package child

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	globalChild "scowd/global/child"
	"scowd/pkg/config"
	"scowd/pkg/httpserver"
	"scowd/pkg/libs/auth"
	"scowd/pkg/logger"
	"scowd/pkg/utils/security"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/sirupsen/logrus"
)

var (
	shutdownTimeout = 1 * time.Hour // 子进程关闭超时时间
	shutdownSignal  = make(chan struct{})
	wg              sync.WaitGroup
)

func RunAsChild() {
	if len(os.Args) != 3 {
		logrus.Error("Usage: <program> --child <user identityId> <port> <publicKey>")
		os.Exit(1)
	}

	userID, port, publicKeyString := os.Args[2], os.Getenv("PORT"), os.Getenv("PUBLIC_KEY")

	// 获取日志配置
	scowdConfig, err := config.GetScowdConfig()
	if err != nil {
		logrus.Errorf("Read SCOWD Config Failed: %s", err)
		// 使用默认配置初始化日志
		logger.InitLogger(userID, fmt.Sprintf("[CHILD:%s]", userID), nil)
	} else {
		// 使用配置文件中的配置初始化日志
		logger.InitLogger(userID, fmt.Sprintf("[CHILD:%s]", userID), &scowdConfig.Logger)
	}

	// 降权逻辑
	uid, gid, groups, err := auth.GetUserInfo(userID)
	if err != nil {
		logrus.Fatalf("Failed to get user ID for %s: %v", userID, err)
	}

	// 执行降权操作
	// 注意：必须先设置附加组，再设置主组，最后设置用户ID
	if len(groups) > 0 {
		if err := syscall.Setgroups(groups); err != nil {
			logrus.Fatalf("Failed to set groups %v: %v", groups, err)
		}
		logrus.Infof("Successfully set supplementary groups: %v", groups)
	}
	if err := syscall.Setgid(int(gid)); err != nil {
		logrus.Fatalf("Failed to set GID to %d: %v", gid, err)
	}
	if err := syscall.Setuid(int(uid)); err != nil {
		logrus.Fatalf("Failed to set UID to %d: %v", uid, err)
	}

	logrus.Infof("Successfully switched to user %s (UID: %d, GID: %d)", userID, uid, gid)

	// 将特殊标记替换回换行符和空格
	restoredPublicKey := strings.ReplaceAll(publicKeyString, "__NEWLINE__", "\n")
	restoredPublicKey = strings.ReplaceAll(restoredPublicKey, "__SPACE__", " ")
	// 反序列化 public key
	publicKey, err := security.DeserializePublicKey(restoredPublicKey)
	if err != nil {
		logrus.Fatalf("Public key %s deserialization failed, the public key is illegal", publicKeyString)
	}
	globalChild.PublicKey = publicKey

	// 使用 auth.LookupID 根据 UID 获取用户信息
	currentUser, err := auth.LookupID(strconv.Itoa(int(uid)))
	if err != nil {
		logrus.WithError(err).Error("Start Child Process Error: Can't get user info on system")
		os.Exit(1)
	}

	logrus.Infof(
		"The user who started the current process is %s, uid is %d, gid is %d, home dir is %s",
		currentUser.Username, uid, gid, currentUser.HomeDir)

	server := httpserver.InitChildHttpService(port)

	wg.Add(1)

	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				logrus.Errorf("Child process panic for user %s: %v", userID, r)
				// 获取堆栈信息
				buf := make([]byte, 4096)
				n := runtime.Stack(buf, false)
				logrus.Errorf("Stack trace for user %s: %s", userID, string(buf[:n]))
				// 发送退出信号
				shutdownSignal <- struct{}{}
			}
		}()
		logrus.Printf("User %s's child service serving on %s", userID, server.Addr)

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logrus.Errorf("Start user %s child process error: %v\nError type: %T\nError details: %+v", userID, err, err, err)
			// 对于严重错误，发送退出信号
			shutdownSignal <- struct{}{}
		}
	}()

	go shutdownIfIdle()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case <-quit:
		// 接收到操作系统或主进程的退出信号
	case <-shutdownSignal:
		// 服务空闲超时
	}

	logrus.Infof("Shutting down..., %s, %s", userID, port)
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		logrus.Infof("HTTP server shutdown error: %v\n", err)
	}
	wg.Wait()
	logrus.Infof("Server stopped. %s, %s", userID, port)
}

func shutdownIfIdle() {
	for {
		time.Sleep(30 * time.Second) // 每30秒检查一次
		if time.Since(*globalChild.GetLastRequestTime()) > shutdownTimeout {
			shutdownSignal <- struct{}{}
			return
		}
	}
}
