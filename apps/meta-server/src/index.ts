import { readVersionFile } from "@scow/utils/build/version";

import { config } from "./env";
import { createMetaServer } from "./server";

console.log("@scow/meta-server: ", readVersionFile());

const server = createMetaServer(config.INSTALL_CONFIG_PATH);

void server.listen({ port: config.PORT, host: "0.0.0.0" }).then(() => {
  console.log("meta-server listening on port %d", config.PORT);
});
