import { plugin } from "@ddadaal/tsgrpc-server";
import { VersionServiceServer, VersionServiceService } from "@scow/scheduler-adapter-protos/build/version";

export const versionServiceServer = plugin((server) => {
  server.addService<VersionServiceServer>(VersionServiceService, {
    getVersion: async () => {
      return [{ major: 1, minor: 7, patch: 0 }];
    },
  });
});
