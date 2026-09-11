package routes

import (
	"net/http"
	"scowd/internal/file_transfer"
	"scowd/pkg/api/storage/handlers"
	"scowd/pkg/config"
	commonMiddlewares "scowd/pkg/middlewares"
	"scowd/protos/gen/api/storage/apiv1connect"

	"connectrpc.com/connect"
	"github.com/sirupsen/logrus"
)

func RegisterStorageRoutes(r *http.ServeMux, manager *file_transfer.TaskManager) {
	// 读取主配置
	scowdConfig, err := config.GetScowdConfig()
	if err != nil {
		logrus.Warnf("Failed to load config, using default file server: %v", err)
		scowdConfig = &config.ScowdConfig{AI: config.AIConfig{Enabled: false}}
	}

	// 根据配置选择文件服务处理器
	var fileServicePattern string
	var fileServiceHandler http.Handler
	// 创建带有请求时间记录的拦截器
	handlerOptions := connect.WithHandlerOptions(
		connect.WithInterceptors(commonMiddlewares.RequestTimeInterceptor("API")),
		commonMiddlewares.PanicRecoveryHandlerOption(),
	)

	if scowdConfig.AI.Enabled {
		logrus.Info("Using K8s file service handler")
		k8sFileServer := handlers.NewK8sFileServer()
		fileServicePattern, fileServiceHandler = apiv1connect.NewFileServiceHandler(k8sFileServer, handlerOptions)
	} else {
		logrus.Info("Using traditional file service handler")
		fileServer := &handlers.FileServer{}
		fileServicePattern, fileServiceHandler = apiv1connect.NewFileServiceHandler(fileServer, handlerOptions)
	}

	storageQuotaServer := &handlers.StorageQuotaServer{}
	fileTransferServer := handlers.NewFileTransferServer(manager)

	r.Handle(fileServicePattern, fileServiceHandler)
	r.Handle(apiv1connect.NewStorageQuotaServiceHandler(storageQuotaServer, handlerOptions))
	r.Handle(apiv1connect.NewFileTransferServiceHandler(fileTransferServer, handlerOptions))
}
