package app

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/common/binary"
	cc "scow-adapters/pkg/common/config"
	"scow-adapters/pkg/common/log"
	"scow-adapters/pkg/common/monitor"
	"scow-adapters/pkg/slurm/client"
	"scow-adapters/pkg/slurm/config"
	slurmmonitor "scow-adapters/pkg/slurm/monitor"
	"scow-adapters/pkg/slurm/services/account"
	"scow-adapters/pkg/slurm/services/app"
	sc "scow-adapters/pkg/slurm/services/config"
	"scow-adapters/pkg/slurm/services/job"
	"scow-adapters/pkg/slurm/services/node"
	"scow-adapters/pkg/slurm/services/user"
	"scow-adapters/pkg/slurm/services/version"
	"scow-adapters/pkg/slurm/slurm_config_cache"
)

var (
	defaultMonitorPort = 8973
)

func run() {
	fmt.Printf("config: %v\n", config.SlurmValue)
	// 初始化 日志及数据库和slurm命令
	log.InitLogger(log.ParseLogLevel(config.SlurmValue.LogConfig.Level))
	client.InitSlurmClient()
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
	// 启动集群指标采集（节点/核心/加速卡/作业 + DB 指标）
	monitor.StartClusterMetricsCollector(slurmmonitor.NewCollector(
		client.SINFO,
		client.SQUEUE,
		client.SlurmDB,
		config.SlurmValue.MySQLConfig.ClusterName,
	))

	monitorPort := config.SlurmValue.Monitor.Port
	if monitorPort == 0 {
		monitorPort = defaultMonitorPort
	}
	monitorPortString := fmt.Sprintf(":%d", monitorPort)
	// 暴露Prometheus指标端点
	go func() {
		http.Handle("/metrics", monitor.MetricsHandlerWithMonitoring(promhttp.Handler()))
		http.ListenAndServe(monitorPortString, nil)
	}()

	instance, err := slurm_config_cache.NewSystem()
	if err != nil {
		logrus.Fatalf("failed to initialize cache system instance, %v", err)
	}
	go instance.Start()
	defer instance.Stop()

	os.Setenv("SLURM_TIME_FORMAT", "standard") // 新加slurm环境变量

	s := grpc.NewServer(
		grpc.MaxRecvMsgSize(1024*1024*1024), // 最大接受size 1GB
		grpc.MaxSendMsgSize(1024*1024*1024), // 最大发送size 1GB
		grpc.UnaryInterceptor(monitor.MetricsInterceptor()),
	)

	if config.SlurmValue.Ssl.Enabled {
		caCertPath, adapterCertPath, adapterPrivateKeyPath := cc.GetCertPath(config.SlurmValue.Ssl)
		logrus.Tracef("caCertPath, adapterCertPath, adapterPrivateKeyPath: %s, %s, %s", caCertPath, adapterCertPath, adapterPrivateKeyPath)
		pair, err := tls.LoadX509KeyPair(adapterCertPath, adapterPrivateKeyPath)
		if err != nil {
			fmt.Println("LoadX509KeyPair error", err)
			return
		}
		// 创建一组根证书
		certPool := x509.NewCertPool()
		ca, err := ioutil.ReadFile(caCertPath)
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
			grpc.MaxRecvMsgSize(1024*1024*1024), // 最大接受size 1GB
			grpc.MaxSendMsgSize(1024*1024*1024), // 最大发送size 1GB
			grpc.UnaryInterceptor(monitor.MetricsInterceptor()),
			grpc.Creds(cred),
		)
	}
	// 创建gRPC服务器
	pb.RegisterUserServiceServer(s, &user.ServerUser{})
	pb.RegisterAccountServiceServer(s, &account.ServerAccount{})
	pb.RegisterConfigServiceServer(s, &sc.ServerConfig{SlurmConfCache: instance})
	pb.RegisterJobServiceServer(s, &job.ServerJob{})
	pb.RegisterVersionServiceServer(s, &version.ServerVersion{})
	pb.RegisterAppServiceServer(s, &app.ServerAppServer{})
	pb.RegisterNodeServiceServer(s, &node.ServerNode{})

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, syscall.SIGINT, syscall.SIGTERM)

	// 启动服务
	lis, err := net.Listen("tcp", config.SlurmValue.Service.Addr)
	if err != nil {
		logrus.Errorf("failed to listen: %v", err)
		return
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
