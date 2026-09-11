package http

import "net/http"

// Middleware 定义中间件类型
type Middleware func(http.Handler) http.Handler

// applyMiddlewares 应用中间件到一个 http.Handler
func ApplyMiddlewares(h http.Handler, middlewares ...Middleware) http.Handler {
	for _, middleware := range middlewares {
		h = middleware(h)
	}
	return h
}
