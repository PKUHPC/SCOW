package app

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/keepalive"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/kubernetes"
	volcanoclientset "volcano.sh/apis/pkg/client/clientset/versioned"

	pb "scow-adapters/gen/go"
	aiclient "scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/config"
	"scow-adapters/pkg/ai/controller"
	"scow-adapters/pkg/ai/informer"
	aimonitor "scow-adapters/pkg/ai/monitor"
	"scow-adapters/pkg/ai/services/account"
	"scow-adapters/pkg/ai/services/app"
	sc "scow-adapters/pkg/ai/services/config"
	"scow-adapters/pkg/ai/services/job"
	"scow-adapters/pkg/ai/services/node"
	"scow-adapters/pkg/ai/services/user"
	"scow-adapters/pkg/ai/services/version"
	"scow-adapters/pkg/ai/timer"
	"scow-adapters/pkg/ai/utils"
	"scow-adapters/pkg/common/binary"
	cc "scow-adapters/pkg/common/config"
	"scow-adapters/pkg/common/log"
	"scow-adapters/pkg/common/monitor"
)

var (
	defaultMonitorPort = 8973
)

func runApp() {
	fmt.Printf("config: %v\n", config.Value)
	// 初始化 日志及数据库
	aiclient.InitDB()
	log.InitLogger(log.ParseLogLevel(config.Value.LogConfig.Level))
	// 创建一个通道用于程序退出信号
	shutdown := make(chan struct{})

	// 检查过期时间
	if err := binary.CheckExpireTime(); err != nil {
		logrus.Fatalf("Binary expiration check failed: %v", err)
	}

	// 启动过期检查协程
	binary.StartExpirationCheck(shutdown)

	// 启动系统指标采集（进程级）
	monitor.StartSystemMetricsCollector()

	monitorPort := config.Value.Monitor.Port
	if monitorPort == 0 {
		monitorPort = defaultMonitorPort
	}
	monitorPortString := fmt.Sprintf(":%d", monitorPort)
	// 暴露Prometheus指标端点
	go func() {
		http.Handle("/metrics", monitor.MetricsHandlerWithMonitoring(promhttp.Handler()))
		http.ListenAndServe(monitorPortString, nil)
	}()

	s := grpc.NewServer(
		grpc.KeepaliveParams(keepalive.ServerParameters{
			MaxConnectionIdle: 30 * time.Second, // 30s空闲断开
			Time:              10 * time.Second, // 10s发送一次ping
			Timeout:           5 * time.Second,  // ping超时时间
		}),
		grpc.MaxRecvMsgSize(1024*1024*1024), // 最大接受size 1GB
		grpc.MaxSendMsgSize(1024*1024*1024), // 最大发送size 1GB
		grpc.UnaryInterceptor(monitor.MetricsInterceptor()),
	)

	kubeConfig := config.Value.KubeConfig
	cfg, err := utils.GetKubeConfig(kubeConfig)
	if err != nil {
		logrus.Errorf("failed to build config: %v", err)
		os.Exit(1)
	}
	client, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		logrus.Errorf("failed to build kubernetes client: %v", err)
		os.Exit(1)
	}
	volcanoClient, err := volcanoclientset.NewForConfig(cfg)
	if err != nil {
		logrus.Errorf("failed to build volcano client: %v", err)
		os.Exit(1)
	}
	tm := timer.NewTimerManager(client, volcanoClient)
	defer tm.Stop()

	// 启动集群指标采集（节点/核心/加速卡/作业 + DB 指标）
	monitor.StartClusterMetricsCollector(aimonitor.NewCollector(
		client, config.Value.ClusterName,
	))

	if config.Value.Ssl.Enabled {
		caCertPath, adapterCertPath, adapterPrivateKeyPath := cc.GetCertPath(config.Value.Ssl)
		logrus.Tracef("caCertPath, adapterCertPath, adapterPrivateKeyPath: %s, %s, %s", caCertPath, adapterCertPath, adapterPrivateKeyPath)
		pair, err := tls.LoadX509KeyPair(adapterCertPath, adapterPrivateKeyPath)
		if err != nil {
			fmt.Println("LoadX509KeyPair error", err)
			return
		}
		// 创建一组根证书
		certPool := x509.NewCertPool()
		ca, err := os.ReadFile(caCertPath)
		if err != nil {
			fmt.Println("read ca pem error ", err)
			return
		}
		// 解析证书
		if ok := certPool.AppendCertsFromPEM(ca); !ok {
			fmt.Println("AppendCertsFromPEM error ")
			return
		}
		cred := credentials.NewTLS(&tls.Config{
			Certificates: []tls.Certificate{pair},
			ClientAuth:   tls.RequireAndVerifyClientCert,
			ClientCAs:    certPool,
		})

		s = grpc.NewServer(
			grpc.KeepaliveParams(keepalive.ServerParameters{
				MaxConnectionIdle: 30 * time.Second, // 30s空闲断开
				Time:              10 * time.Second, // 10s发送一次ping
				Timeout:           5 * time.Second,  // ping超时时间
			}),
			grpc.MaxRecvMsgSize(1024*1024*1024), // 最大接受size 1GB
			grpc.MaxSendMsgSize(1024*1024*1024), // 最大发送size 1GB
			grpc.UnaryInterceptor(monitor.MetricsInterceptor()),
			grpc.Creds(cred),
		)
	}

	pb.RegisterVersionServiceServer(s, &version.ServerVersion{}) // 注册服务
	pb.RegisterJobServiceServer(s, &job.ServerJob{Timer: tm})
	pb.RegisterAccountServiceServer(s, &account.ServerAccount{})
	pb.RegisterUserServiceServer(s, &user.ServerUser{})
	pb.RegisterConfigServiceServer(s, &sc.ServerConfig{})
	pb.RegisterAppServiceServer(s, &app.ServerApp{})
	pb.RegisterNodeServiceServer(s, &node.ServerNode{K8sClient: client})

	queueAndLabelController := controller.NewQueueAndLabelController(client, volcanoClient)
	go queueAndLabelController.Start()
	defer queueAndLabelController.Stop()

	// 检查devhost 的configmap
	go wait.Until(func() { controller.CheckDevHostConfigMap(client, volcanoClient) }, time.Minute*30, shutdown)

	go informer.Run(tm, client, volcanoClient)

	// 初始化priorityClass
	utils.InitPriorityClass()

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, syscall.SIGINT, syscall.SIGTERM)

	adapterServicePort := config.Value.AdapterPort
	adapterServicePortString := fmt.Sprintf(":%d", adapterServicePort)
	lis, err := net.Listen("tcp", adapterServicePortString)
	if err != nil {
		logrus.Errorf("failed to listen: %v", adapterServicePortString)
		os.Exit(1)
	}

	// 启动服务（非阻塞模式）
	go func() {
		if err = s.Serve(lis); err != nil && !errors.Is(grpc.ErrServerStopped, err) {
			logrus.Fatalf("Failed to serve: %v", err)
		}
	}()

	// 等待关闭信号
	select {
	case <-stopChan:
		logrus.Info("Received shutdown signal. Initiating graceful shutdown...")
	case <-shutdown:
		logrus.Info("Received expiration shutdown signal. Initiating graceful shutdown...")
	}

	// 关闭服务器和监听器
	s.GracefulStop() // 优雅关闭gRPC服务
	lis.Close()      // 关闭网络监听

	logrus.Info("gRPC server shutdown completed")
}
