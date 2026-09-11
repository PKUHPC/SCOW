package routes

import (
	"net/http"
	commonMiddlewares "scowd/internal/api/middlewares"

	"scowd/internal/application/service/handlers"
	"scowd/internal/process/middlewares"
	"scowd/protos/gen/api/application/apiv1connect"

	"connectrpc.com/connect"
)

func RegisterApplicationRoutes(r *http.ServeMux) {
	desktopServer := &handlers.DesktopServer{}
	appServer := &handlers.AppServer{}
	shellServer := &handlers.ShellServer{}

	interceptors := connect.WithInterceptors(
		middlewares.AuthInterceptor(),
		middlewares.UpdateRequestTimeInterceptor(),
		commonMiddlewares.RequestTimeInterceptor("Service"),
	)
	desktopPath, desktopHandler := apiv1connect.NewDesktopServiceHandler(desktopServer, interceptors)
	r.Handle(desktopPath, desktopHandler)

	appPath, appHandler := apiv1connect.NewAppServiceHandler(appServer, interceptors)
	r.Handle(appPath, appHandler)

	shellPath, shellHandler := apiv1connect.NewShellServiceHandler(shellServer, interceptors)
	r.Handle(shellPath, shellHandler)
}
