package adapter_storage_routes

import (
	"net/http"

	commonMiddlewares "github.com/PKUHPC/private-scow/apps/scowd/internal/api/middlewares"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/process/middlewares"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/storage/service/handlers"
	"github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/storage/apiv1connect"

	"connectrpc.com/connect"
)

func RegisterStorageRoutes(r *http.ServeMux) {
	fileServer := &handlers.FileServer{}
	fileTransferServer := &handlers.FileTransferServer{}

	interceptors := connect.WithInterceptors(
		middlewares.AuthInterceptor(),
		middlewares.UpdateRequestTimeInterceptor(),
		commonMiddlewares.RequestTimeInterceptor("Service"),
	)

	filePath, fileHandler := apiv1connect.NewFileServiceHandler(fileServer, interceptors)
	r.Handle(filePath, fileHandler)

	transferPath, transferHandler := apiv1connect.NewFileTransferServiceHandler(fileTransferServer, interceptors)
	r.Handle(transferPath, transferHandler)

	// 添加更多用户相关的路由...
}
