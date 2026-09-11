package httpserver

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	globalChild "scowd/global/child"
	"scowd/internal/file_transfer"
	apiApplicationRoutes "scowd/pkg/api/application/routes"
	apiStorageRoutes "scowd/pkg/api/storage/routes"
	"scowd/pkg/config"
	servicesApplicationRoutes "scowd/pkg/services/application/routes"
	servicesStorageRoutes "scowd/pkg/services/storage/routes"
)

func InitMainHttpService(scowdConfig *config.ScowdConfig, transferTaskManager *file_transfer.TaskManager) *http.Server {

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
		Addr:    fmt.Sprintf("%s:%s", "", port),
		Handler: h2c.NewHandler(r, &http2.Server{}),
	}

	return server
}
