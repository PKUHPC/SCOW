import { plugin } from "@ddadaal/tsgrpc-server";
import { AppServiceServer, AppServiceService } from "@scow/scheduler-adapter-protos/build/app";

export const appServiceServer = plugin((server) => {
  server.addService<AppServiceServer>(AppServiceService, {
    getAppConnectionInfo: async () => {
      return [{}];
    },
  });
});
