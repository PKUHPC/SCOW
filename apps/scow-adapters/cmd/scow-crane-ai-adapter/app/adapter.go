package app

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"time"

	"github.com/mitchellh/mapstructure"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"

	protos "scow-adapters/gen/go"
	cc "scow-adapters/pkg/common/config"
	"scow-adapters/pkg/common/log"
	"scow-adapters/pkg/common/monitor"
	ce "scow-adapters/pkg/common/utils"
	"scow-adapters/pkg/crane-ai/client"
	"scow-adapters/pkg/crane-ai/config"
	craneaimonitor "scow-adapters/pkg/crane-ai/monitor"
	"scow-adapters/pkg/crane-ai/services/account"
	"scow-adapters/pkg/crane-ai/services/app"
	cg "scow-adapters/pkg/crane-ai/services/config"
	"scow-adapters/pkg/crane-ai/services/job"
	"scow-adapters/pkg/crane-ai/services/user"
	"scow-adapters/pkg/crane-ai/services/version"
	"scow-adapters/pkg/crane-ai/utils"
)

var (
	FlagConfigFilePath string
	GConfig            config.CraneConfig
	defaultMonitorPort = 8973
)

func NewAdapterCommand() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:     "scow-crane-ai-adapters",
		Short:   "crane ai adapter for scow",
		Version: ce.GetVersion(),
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
		log.InitLogger(log.ParseLogLevel(viper.GetString("log-level")), viper.GetString("log-file"))
		if err := unmarshalWithYamlTag(viper.AllSettings(), &GConfig); err != nil {
			logrus.Fatalf("Error parsing config file: %s", err)
		}

		logrus.Debugf("Using config:\n%+v", GConfig)
	})

	rootCmd.SetVersionTemplate(ce.VersionTemplate())
	// Specify config file path
	rootCmd.PersistentFlags().StringVarP(&FlagConfigFilePath, "config", "c", "", "Path to configuration file")

	// Other flags
	rootCmd.PersistentFlags().IntP("bind-port", "p", 5000, "Binding port of adapter")
	viper.BindPFlag("bind-port", rootCmd.PersistentFlags().Lookup("bind-port"))

	rootCmd.PersistentFlags().StringP("log-level", "l", "info", "Log level")
	viper.BindPFlag("log-level", rootCmd.PersistentFlags().Lookup("log-level"))

	rootCmd.PersistentFlags().StringP("log-file", "", "", "Log file path (default: server.log in working directory)")
	viper.BindPFlag("log-file", rootCmd.PersistentFlags().Lookup("log-file"))

	return rootCmd
}

func Run() {
	// 初始化客户端
	client.InitClient()

	// 启动系统指标采集（进程级）
	monitor.StartSystemMetricsCollector()
	// 启动集群指标采集（节点/核心/加速卡/作业 + DB 指标）
	monitor.StartClusterMetricsCollector(craneaimonitor.NewCollector(client.CConfig.ClusterName))

	monitorPort := GConfig.Monitor.Port
	if monitorPort == 0 {
		monitorPort = defaultMonitorPort
	}
	monitorPortString := fmt.Sprintf(":%d", monitorPort)
	// 暴露Prometheus指标端点
	go func() {
		http.Handle("/metrics", monitor.MetricsHandlerWithMonitoring(promhttp.Handler()))
		http.ListenAndServe(monitorPortString, nil)
	}()

	jm, err := utils.NewJobManager(utils.JobsInfos)
	if err != nil {
		logrus.Fatalf("init job manager failed: %v", err)
	}

	// 1. 程序启动时先恢复代理服务
	if err := utils.GlobalProxyManager.RecoverProxies(); err != nil {
		logrus.Warnf("Failed to restore proxy service: %v", err)
	}

	// 2. 启动定时清理任务（每30分钟执行一次）
	utils.GlobalProxyManager.StartPeriodicClean(30 * time.Minute)
	defer utils.GlobalProxyManager.StopPeriodicClean()

	s := grpc.NewServer(
		grpc.MaxRecvMsgSize(1024*1024*1024), // 最大接受size 1GB
		grpc.MaxSendMsgSize(1024*1024*1024), // 最大发送size 1GB
		grpc.UnaryInterceptor(monitor.MetricsInterceptor()),
	)

	if GConfig.Ssl.Enabled {
		caCertPath, adapterCertPath, adapterPrivateKeyPath := cc.GetCertPath(GConfig.Ssl)
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

	// 注册服务
	protos.RegisterJobServiceServer(s, &job.ServerJob{JM: jm})
	protos.RegisterAccountServiceServer(s, &account.ServerAccount{})
	protos.RegisterConfigServiceServer(s, &cg.ServerConfig{})
	protos.RegisterUserServiceServer(s, &user.ServerUser{})
	protos.RegisterVersionServiceServer(s, &version.ServerVersion{})
	protos.RegisterAppServiceServer(s, &app.ServerApp{JM: jm})

	logrus.Infof("gRPC server listening on %d", GConfig.BindPort)
	portString := fmt.Sprintf(":%d", GConfig.BindPort)
	listener, err := net.Listen("tcp", portString)
	if err != nil {
		logrus.Fatalf("failed to listen: %s", err)
		return
	}

	if err := s.Serve(listener); err != nil {
		logrus.Fatalf("gRPC server quitting: %s", err)
	}
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
