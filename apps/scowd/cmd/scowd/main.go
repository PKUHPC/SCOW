package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/PKUHPC/private-scow/apps/scowd/internal/config"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/database"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/desktop/dao"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/httpserver"
	logger "github.com/PKUHPC/private-scow/apps/scowd/internal/logger"
	childProcess "github.com/PKUHPC/private-scow/apps/scowd/internal/process/child"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/process/common"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/process/parent"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/proxy"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/storage/filetransfer"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/tls"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/utils/binary"

	"github.com/sirupsen/logrus"
)

func initDBSchemas() error {
	conn, err := db.Get()
	if err != nil {
		return err
	}
	return dao.NewDesktopDAO().CreateDesktopsTable(conn)
}

func main() {
	// 处理命令行参数
	if len(os.Args) > 1 {
		// 处理版本号查询
		if os.Args[1] == "--version" || os.Args[1] == "-v" {
			fmt.Printf("scowd version %s\n", common.Version)
			return
		}

		// 处理 init 命令
		if os.Args[1] == "init" {
			if err := initConfigs(); err != nil {
				logrus.Fatalf("Failed to initialize configs: %v", err)
			}
			return
		}

		// 处理子进程模式
		if os.Args[1] == "--child" {
			childProcess.RunAsChild()
			return
		}
	}

	// 检查过期时间
	if err := binary.CheckExpireTime(); err != nil {
		logrus.Fatalf("Binary expiration check failed: %v", err)
	}

	// 启动过期检查协程
	stopExpirationCheck := make(chan struct{})
	expired := binary.StartExpirationCheck(stopExpirationCheck)

	scowdConfig, err := config.GetScowdConfig()
	if err != nil {
		logrus.Fatalf("Failed to read SCOWD configuration: %s", err)
	}
	logrus.Info("SCOWD configuration loaded successfully")

	// init log
	logger.InitLogger("", "", &scowdConfig.Logger)

	logrus.Info("Initializing shell file...")
	err = initShellFile()
	if err != nil {
		logrus.Fatalf("Failed to initialize shell file: %v", err)
	}
	logrus.Info("Shell file initialized successfully")

	if err := initDBSchemas(); err != nil {
		logrus.Fatalf("Init db schemas failed: %v", err)
	}

	// 创建一个上下文用于管理适配器和交互式应用代理服务器的生命周期
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel() // 确保上下文在退出时会被取消

	// init adapter proxy
	if scowdConfig.Proxy.AdapaterProxy.Enabled {
		logrus.Info("Initializing adapter proxy service...")
		proxy.InitAdapterProxy(ctx)
		logrus.Info("Adapter proxy service initialized successfully")
	}

	// init app proxy
	if scowdConfig.Proxy.AppProxy.Enabled {
		logrus.Info("Initializing application proxy service...")
		proxy.InitAppProxy(ctx)
		logrus.Info("Application proxy service initialized successfully")
	}

	// 启动跨集群文件传输
	logrus.Info("Initializing file transfer service...")
	fileTransferManager, err := filetransfer.NewTaskManager(10, scowdConfig.ServerTLS)
	if err != nil {
		logrus.Fatalf("Failed to initialize file transfer service: %v", err)
	}

	if err := fileTransferManager.Start(); err != nil {
		logrus.Fatalf("Failed to start file transfer service: %v", err)
	}
	logrus.Info("File transfer service started successfully")

	// init server
	server := httpserver.InitMainHttpService(scowdConfig, fileTransferManager)

	// 启动子进程管理
	logrus.Info("Starting child process manager...")
	go parent.GlobalChildProcessManager.ManageChildProcesses()
	logrus.Info("Child process manager started successfully")

	// 创建一个通道来接收操作系统信号
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// 启动监听退出信号的 goroutine
	go func() {
		select {
		case <-sigChan:
			logrus.Println("Received shutdown signal. Initiating graceful shutdown...")
		case <-expired:
			logrus.Println("Received expiration shutdown signal. Initiating graceful shutdown...")
		}

		// 停止检查与过期通知使用独立通道，各自只有一个关闭方。
		close(stopExpirationCheck)

		// 取消上下文，通知所有相关的服务关闭
		logrus.Info("Canceling context to notify all services...")
		cancel()

		// 停止文件传输
		logrus.Info("Stopping file transfer service...")
		fileTransferManager.Stop()
		logrus.Info("File transfer service stopped successfully")

		// 关闭子进程
		logrus.Info("Shutting down all child processes...")
		parent.GlobalChildProcessManager.ShutdownAllChildProcesses()
		logrus.Info("All child processes shut down successfully")

		// 优雅地关闭 HTTP 服务
		logrus.Info("Initiating HTTP server shutdown...")
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			logrus.Errorf("Error during server shutdown: %v", err)
		} else {
			logrus.Info("HTTP server shut down gracefully")
		}

		logrus.Info("Graceful shutdown complete")
	}()

	if scowdConfig.ServerTLS.Enabled {
		logrus.Info("Configuring TLS for server...")
		tlsConfig := tls.GetServerTLSConfig(&scowdConfig.ServerTLS)
		server.TLSConfig = tlsConfig
		logrus.Info("TLS configuration completed successfully")

		logrus.Infof("Starting HTTPS server on %s", server.Addr)
		logrus.Fatal(server.ListenAndServeTLS("", "")) // 使用 TLSConfig 中的证书
	} else {
		logrus.Infof("Starting HTTP server on %s", server.Addr)
		logrus.Fatal(server.ListenAndServe())
	}
}
