package routes

import (
	commonMiddlewares "github.com/PKUHPC/private-scow/apps/scowd/internal/api/middlewares"
	"net/http"

	"github.com/PKUHPC/private-scow/apps/scowd/internal/application/service/handlers"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/process/middlewares"
	"github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/application/apiv1connect"

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
