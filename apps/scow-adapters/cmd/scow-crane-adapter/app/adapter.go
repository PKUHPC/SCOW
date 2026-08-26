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

	"github.com/mitchellh/mapstructure"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"

	protos "scow-adapters/gen/go"
	"scow-adapters/pkg/common/binary"
	cc "scow-adapters/pkg/common/config"
	"scow-adapters/pkg/common/log"
	"scow-adapters/pkg/common/monitor"
	"scow-adapters/pkg/common/utils"
	"scow-adapters/pkg/crane/client"
	"scow-adapters/pkg/crane/config"
	cranemonitor "scow-adapters/pkg/crane/monitor"
	"scow-adapters/pkg/crane/services/account"
	"scow-adapters/pkg/crane/services/app"
	cg "scow-adapters/pkg/crane/services/config"
	"scow-adapters/pkg/crane/services/job"
	"scow-adapters/pkg/crane/services/user"
	"scow-adapters/pkg/crane/services/version"
)

var (
	FlagConfigFilePath string
	defaultMonitorPort = 8973
)

func NewAdapterCommand() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:     "scow-adapters",
		Short:   "crane adapter for scow",
		Version: utils.GetVersion(),
		Run: func(cmd *cobra.Command, args []string) {
			Run()
		},
	}

	// Initialize config
	cobra.OnInitialize(func() {
		// Use config file from the flag or search in the default paths
		if FlagConfigFilePath != "" {
			viper.SetConfigFile(FlagConfigFilePath)
		} else {
			viper.AddConfigPath(".")
			viper.AddConfigPath("/etc/scow-adapters/")
			viper.SetConfigType("yaml")
			viper.SetConfigName("config")
		}

		// Read and parse config file
		viper.ReadInConfig()
		// Initialize logger
		log.InitLogger(log.ParseLogLevel(viper.GetString("log-level")), viper.GetString("log-file"), viper.GetBool("log-stdout"))
		if err := unmarshalWithYamlTag(viper.AllSettings(), &config.CraneConfigValue); err != nil {
			logrus.Fatalf("Error parsing config file: %s", err)
		}

		logrus.Infof("Crane adapter configuration loaded: bind_port=%d, monitor_port=%d, tls_enabled=%t, log_level=%s",
			config.CraneConfigValue.BindPort, config.CraneConfigValue.Monitor.Port, config.CraneConfigValue.Ssl.Enabled,
			config.CraneConfigValue.LogLevel)
	})

	rootCmd.SetVersionTemplate(utils.VersionTemplate())
	// Specify config file path
	rootCmd.PersistentFlags().StringVarP(&FlagConfigFilePath, "config", "c", "", "Path to configuration file")

	// Other flags
	rootCmd.PersistentFlags().IntP("bind-port", "p", 5000, "Binding address of adapter")
	viper.BindPFlag("bind-addr", rootCmd.PersistentFlags().Lookup("addr"))

	rootCmd.PersistentFlags().StringP("log-level", "l", "info", "Log level")
	viper.BindPFlag("log-level", rootCmd.PersistentFlags().Lookup("log-level"))

	rootCmd.PersistentFlags().StringP("log-file", "", "", "Log file path (default: logs/server.log in working directory)")
	viper.BindPFlag("log-file", rootCmd.PersistentFlags().Lookup("log-file"))

	rootCmd.PersistentFlags().Bool("log-stdout", true, "Also write logs to stdout")
	viper.BindPFlag("log-stdout", rootCmd.PersistentFlags().Lookup("log-stdout"))

	return rootCmd
}

func Run() {
	// 初始化客户端
	client.InitClient()
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
	monitor.StartClusterMetricsCollector(cranemonitor.NewCollector(client.CConfig.ClusterName))

	monitorPort := config.CraneConfigValue.Monitor.Port
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
		grpc.MaxRecvMsgSize(1024*1024*1024), // 最大接受size 1GB
		grpc.MaxSendMsgSize(1024*1024*1024), // 最大发送size 1GB
		grpc.UnaryInterceptor(monitor.MetricsInterceptor()),
	)

	if config.CraneConfigValue.Ssl.Enabled {
		caCertPath, adapterCertPath, adapterPrivateKeyPath := cc.GetCertPath(config.CraneConfigValue.Ssl)
		logrus.Tracef("caCertPath, adapterCertPath, adapterPrivateKeyPath: %s, %s, %s", caCertPath, adapterCertPath, adapterPrivateKeyPath)
		pair, err := tls.LoadX509KeyPair(adapterCertPath, adapterPrivateKeyPath)
		if err != nil {
			logrus.Errorf("LoadX509KeyPair failed: %v", err)
			return
		}
		// 创建一组根证书
		certPool := x509.NewCertPool()
		ca, err := ioutil.ReadFile(caCertPath)
		if err != nil {
			logrus.Errorf("Read CA PEM failed: %v", err)
			return
		}
		// 解析证书
		if ok := certPool.AppendCertsFromPEM(ca); !ok {
			logrus.Error("AppendCertsFromPEM failed")
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

	// 注册服务
	protos.RegisterJobServiceServer(s, &job.ServerJob{})
	protos.RegisterAccountServiceServer(s, &account.ServerAccount{})
	protos.RegisterConfigServiceServer(s, &cg.ServerConfig{})
	protos.RegisterUserServiceServer(s, &user.ServerUser{})
	protos.RegisterVersionServiceServer(s, &version.ServerVersion{})
	protos.RegisterAppServiceServer(s, &app.ServerApp{})

	logrus.Infof("gRPC server listening on %d", config.CraneConfigValue.BindPort)
	portString := fmt.Sprintf(":%d", config.CraneConfigValue.BindPort)
	listener, err := net.Listen("tcp", portString)
	if err != nil {
		logrus.Fatalf("failed to listen: %s", err)
		return
	}

	// 启动服务（非阻塞模式）
	go func() {
		if err := s.Serve(listener); err != nil && !errors.Is(err, grpc.ErrServerStopped) {
			logrus.Fatalf("gRPC server quitting: %s", err)
		}
	}()

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, syscall.SIGINT, syscall.SIGTERM)

	// 等待关闭信号
	select {
	case <-stopChan:
		logrus.Info("Received shutdown signal. Initiating graceful shutdown...")
	case <-shutdown:
		logrus.Info("Received expiration shutdown signal. Initiating graceful shutdown...")
	}

	// 关闭服务器和监听器
	s.GracefulStop()
	listener.Close()

	logrus.Info("gRPC server shutdown completed")
}

// 自定义 Unmarshal 函数，强制使用 yaml 标签
func unmarshalWithYamlTag(source interface{}, target interface{}) error {
	// 创建 mapstructure 解析配置
	config := &mapstructure.DecoderConfig{
		Metadata: nil,
		Result:   target,
		TagName:  "yaml", // 指定使用 yaml 标签而非默认的 mapstructure
		// 保留 viper 默认的其他配置（比如自动转换类型）
		WeaklyTypedInput: true,
	}

	// 创建解析器
	decoder, err := mapstructure.NewDecoder(config)
	if err != nil {
		return err
	}

	// 执行解析
	return decoder.Decode(source)
}
