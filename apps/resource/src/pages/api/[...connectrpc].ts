import { nextJsApiRouter } from "@connectrpc/connect-next";
import { applyMiddleware } from "src/applyMiddleware";
import { loggerInterceptor } from "src/server/connectrpc/interceptor/loggerInterceptor";
import routes from "src/server/connectrpc/route/clusterPartitions";

const { handler, config: conf } = nextJsApiRouter({ routes, interceptors: [loggerInterceptor] });
const newHandler = applyMiddleware(handler);
const config = conf as any;
export { config, newHandler as default };
