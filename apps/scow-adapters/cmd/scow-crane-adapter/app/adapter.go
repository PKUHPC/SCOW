package app

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"

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
		log.InitLogger(log.ParseLogLevel(viper.GetString("log-level")))
		if err := unmarshalWithYamlTag(viper.AllSettings(), &config.CraneConfigValue); err != nil {
			logrus.Fatalf("Error parsing config file: %s", err)
		}

		logrus.Debugf("Using config:\n%+v", config.CraneConfigValue)
	})

	rootCmd.SetVersionTemplate(utils.VersionTemplate())
	// Specify config file path
	rootCmd.PersistentFlags().StringVarP(&FlagConfigFilePath, "config", "c", "", "Path to configuration file")

	// Other flags
	rootCmd.PersistentFlags().IntP("bind-port", "p", 5000, "Binding address of adapter")
	viper.BindPFlag("bind-addr", rootCmd.PersistentFlags().Lookup("addr"))

	rootCmd.PersistentFlags().StringP("log-level", "l", "info", "Log level")
	viper.BindPFlag("log-level", rootCmd.PersistentFlags().Lookup("log-level"))

	return rootCmd
}

func Run() {
	// 初始化客户端
	client.InitClient()

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
