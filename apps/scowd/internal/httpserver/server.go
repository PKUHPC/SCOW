package httpserver

import (
	"fmt"
	"net"
	"net/http"
	"strconv"
	"time"

	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	apiApplicationRoutes "github.com/PKUHPC/private-scow/apps/scowd/internal/api/application/routes"
	apiStorageRoutes "github.com/PKUHPC/private-scow/apps/scowd/internal/api/storage/routes"
	servicesApplicationRoutes "github.com/PKUHPC/private-scow/apps/scowd/internal/application/service/routes"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/config"
	globalChild "github.com/PKUHPC/private-scow/apps/scowd/internal/process/childstate"
	"github.com/PKUHPC/private-scow/apps/scowd/internal/storage/filetransfer"
	servicesStorageRoutes "github.com/PKUHPC/private-scow/apps/scowd/internal/storage/service/routes"
)

func InitMainHttpService(scowdConfig *config.ScowdConfig, transferTaskManager *filetransfer.TaskManager) *http.Server {

	mux := http.NewServeMux()
	apiStorageRoutes.RegisterStorageRoutes(mux, transferTaskManager)
	apiApplicationRoutes.RegisterApplicationRoutes(mux)

	server := &http.Server{
		Addr:    fmt.Sprintf("%s:%s", scowdConfig.Server.Host, strconv.Itoa(scowdConfig.Server.Port)),
		Handler: h2c.NewHandler(mux, &http2.Server{}),
	}

	return server
}

func InitChildHttpService(port string) *http.Server {

	r := http.NewServeMux()
	servicesStorageRoutes.RegisterStorageRoutes(r)
	servicesApplicationRoutes.RegisterApplicationRoutes(r)

	// 初始化最新请求的时间
	globalChild.SetLastRequestTime(time.Now())

	server := &http.Server{
		Addr:    net.JoinHostPort("127.0.0.1", port),
		Handler: h2c.NewHandler(r, &http2.Server{}),
	}

	return server
}
