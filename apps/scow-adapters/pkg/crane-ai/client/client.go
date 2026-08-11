package client

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"google.golang.org/grpc"
	"google.golang.org/grpc/backoff"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
	"gopkg.in/yaml.v2"

	craneProtos "scow-adapters/gen/crane-ai"
)

var (
	CraneCtld     craneProtos.CraneCtldClient
	CConfig       *CraneConfig
	MongoDBClient *mongo.Client
	MongoDBConfig *DatabaseConfig

	DefaultConfigPath  = "/etc/crane/config.yaml"
	DefaultMongoDBPath = "/etc/crane/database.yaml"

	clientKeepAliveParams = keepalive.ClientParameters{
		Time:                20 * time.Second,
		Timeout:             10 * time.Second,
		PermitWithoutStream: true,
	}
	clientConnectParams = grpc.ConnectParams{
		Backoff: backoff.Config{BaseDelay: time.Second, MaxDelay: 30 * time.Second},
	}
)

type CraneConfig struct {
	ClusterName         string `yaml:"ClusterName"`
	ControlMachine      string `yaml:"ControlMachine"`
	CraneCtldListenPort string `yaml:"CraneCtldListenPort"`

	TLS        TLSConfig   `yaml:"TLS"`
	Partitions []Partition `yaml:"Partitions"`
}

type TLSConfig struct {
	Enabled              bool   `yaml:"Enabled"`
	InternalKeyFilePath  string `yaml:"InternalKeyFilePath"`
	InternalCertFilePath string `yaml:"InternalCertFilePath"`
	ExternalKeyFilePath  string `yaml:"ExternalKeyFilePath"`
	ExternalCertFilePath string `yaml:"ExternalCertFilePath"`
	CaFilePath           string `yaml:"CaFilePath"`
	AllowedNodes         string `yaml:"AllowedNodes"`
	DomainSuffix         string `yaml:"DomainSuffix"`
	UserTlsCertPath      string `yaml:"UserTlsCertPath"`
}

type Partition struct {
	Name  string `yaml:"name"`
	Nodes string `yaml:"nodes"`
}

// DatabaseConfig MongoDB 配置结构体
type DatabaseConfig struct {
	CraneEmbeddedDbBackend string `yaml:"CraneEmbeddedDbBackend"`
	CraneCtldDbPath        string `yaml:"CraneCtldDbPath"`
	DbUser                 string `yaml:"DbUser"`
	DbPassword             string `yaml:"DbPassword"`
	DbHost                 string `yaml:"DbHost"`
	DbPort                 int    `yaml:"DbPort"`
	DbReplSetName          string `yaml:"DbReplSetName"`
	DbName                 string `yaml:"DbName"`
}

// InitClient 为初始化CraneCtld客户端及MongoDB客户端
func InitClient() {
	CConfig = parseConfig(DefaultConfigPath)
	serverAddr := fmt.Sprintf("%s:%s", CConfig.ControlMachine, CConfig.CraneCtldListenPort)
	var conn *grpc.ClientConn
	var err error
	if CConfig.TLS.Enabled {
		serverAddr = fmt.Sprintf("%s.%s:%s", CConfig.ControlMachine,
			CConfig.TLS.DomainSuffix, CConfig.CraneCtldListenPort)
		if CConfig.TLS.UserTlsCertPath == "" {
			home, homeErr := os.UserHomeDir()
			if homeErr != nil {
				log.Fatal(homeErr)
			}
			CConfig.TLS.UserTlsCertPath = filepath.Join(home, ".config/crane")
		}
		tlsConfig, tlsErr := readTLSConfig(CConfig)
		if tlsErr != nil {
			log.Fatalf("Failed to load user certificate: %v", tlsErr)
		}
		conn, err = grpc.NewClient(serverAddr,
			grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig)),
			grpc.WithKeepaliveParams(clientKeepAliveParams),
			grpc.WithConnectParams(clientConnectParams),
			grpc.WithIdleTimeout(time.Duration(math.MaxInt64)),
		)
	} else {
		conn, err = grpc.NewClient(serverAddr,
			grpc.WithTransportCredentials(insecure.NewCredentials()),
			grpc.WithKeepaliveParams(clientKeepAliveParams),
			grpc.WithConnectParams(clientConnectParams),
			grpc.WithIdleTimeout(time.Duration(math.MaxInt64)),
		)
	}
	if err != nil {
		log.Fatal("Cannot connect to CraneCtld: " + err.Error())
	}
	CraneCtld = craneProtos.NewCraneCtldClient(conn)

	// 加载配置
	MongoDBConfig, err = loadDBConfig(DefaultMongoDBPath)
	if err != nil {
		log.Fatalf("Loading configuration failed: %v", err)
	}

	// 创建 MongoDB 客户端
	client, err := createMongoClient(MongoDBConfig)
	if err != nil {
		log.Fatalf("Failed to create MongoDB client: %v", err)
	}

	MongoDBClient = client
}

func readTLSConfig(config *CraneConfig) (*tls.Config, error) {
	userKeyPath := filepath.Join(config.TLS.UserTlsCertPath, "user.key")
	userCertPath := filepath.Join(config.TLS.UserTlsCertPath, "user.pem")
	if !fileExists(userKeyPath) || !fileExists(userCertPath) || !fileExists(config.TLS.ExternalCertFilePath) {
		return nil, fmt.Errorf("Crane TLS certificate files not found")
	}
	cert, err := tls.LoadX509KeyPair(userCertPath, userKeyPath)
	if err != nil {
		return nil, fmt.Errorf("load Crane TLS client certificate: %w", err)
	}
	caPEM, err := os.ReadFile(config.TLS.ExternalCertFilePath)
	if err != nil {
		return nil, err
	}
	caPool := x509.NewCertPool()
	if !caPool.AppendCertsFromPEM(caPEM) {
		return nil, fmt.Errorf("parse Crane TLS external certificate")
	}
	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		RootCAs:      caPool,
		MinVersion:   tls.VersionTLS13,
	}, nil
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// 创建 MongoDB 客户端
func createMongoClient(config *DatabaseConfig) (*mongo.Client, error) {
	// 构建连接字符串
	uri := fmt.Sprintf("mongodb://%s:%s@%s:%d",
		config.DbUser,
		config.DbPassword,
		config.DbHost,
		config.DbPort)

	// 设置客户端选项
	clientOptions := options.Client().ApplyURI(uri)

	// 如果配置了副本集名称
	if config.DbReplSetName != "" {
		clientOptions.SetReplicaSet(config.DbReplSetName)
	}

	// 连接到 MongoDB
	client, err := mongo.Connect(context.TODO(), clientOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %v", err)
	}

	// 检查连接
	err = client.Ping(context.TODO(), nil)
	if err != nil {
		return nil, fmt.Errorf("MongoDB connection test failed: %v", err)
	}

	return client, nil
}

// 读取MongoDB配置文件
func loadDBConfig(configPath string) (*DatabaseConfig, error) {
	// 获取绝对路径
	absPath, err := filepath.Abs(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to obtain absolute path: %v", err)
	}

	// 检查文件是否存在
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("the configuration file does not exist: %v", absPath)
	}

	// 读取文件内容
	data, err := os.ReadFile(absPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read configuration file: %v", err)
	}

	// 解析 YAML
	config := &DatabaseConfig{}
	if err := yaml.Unmarshal(data, config); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %v", err)
	}

	return config, nil
}

// 解析crane配置文件
func parseConfig(configFilePath string) *CraneConfig {
	confFile, err := os.ReadFile(configFilePath)
	if err != nil {
		log.Fatal(err)
	}
	config := &CraneConfig{}
	err = yaml.Unmarshal(confFile, config)
	if err != nil {
		log.Fatal(err)
	}
	return config
}
