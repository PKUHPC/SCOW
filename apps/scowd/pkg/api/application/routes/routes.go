package routes

import (
	"net/http"
	commonMiddlewares "scowd/pkg/middlewares"

	"scowd/internal/dao"
	"scowd/internal/repository"
	"scowd/pkg/api/application/handlers"
	"scowd/protos/gen/api/application/apiv1connect"

	"connectrpc.com/connect"
)

func RegisterApplicationRoutes(r *http.ServeMux) {
	desktopServer := handlers.NewDesktopServer(repository.NewDesktopRepository(dao.NewDesktopDAO()))
	systemServer := &handlers.SystemServer{}
	appServer := &handlers.AppServer{}
	shellServer := &handlers.ShellServer{}
	imageServer := &handlers.ImageServer{}

	// 创建带有请求时间记录的拦截器
	interceptors := connect.WithInterceptors(commonMiddlewares.RequestTimeInterceptor("API"))
	desktopPath, desktopHandler := apiv1connect.NewDesktopServiceHandler(desktopServer, interceptors)
	r.Handle(desktopPath, desktopHandler)

	systemPath, systemHandler := apiv1connect.NewSystemServiceHandler(systemServer, interceptors)
	r.Handle(systemPath, systemHandler)

	appPath, appHandler := apiv1connect.NewAppServiceHandler(appServer, interceptors)
	r.Handle(appPath, appHandler)

	shellPath, shellHandler := apiv1connect.NewShellServiceHandler(shellServer, interceptors)
	r.Handle(shellPath, shellHandler)

	imagePath, imageHandler := apiv1connect.NewImageServiceHandler(imageServer, interceptors)
	r.Handle(imagePath, imageHandler)
}
