import { nextJsApiRouter } from "@connectrpc/connect-next";
import { applyMiddleware } from "src/applyMiddleware";
import { loggerInterceptor } from "src/server/connectrpc/interceptor/loggerInterceptor";
import routes from "src/server/connectrpc/route/clusterPartitions";

const { handler, config } = nextJsApiRouter({ routes, interceptors: [loggerInterceptor]});
const newHandler = applyMiddleware(handler);
export { config, newHandler as default };
