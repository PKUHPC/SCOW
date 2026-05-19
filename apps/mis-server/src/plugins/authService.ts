import { plugin } from "@ddadaal/tsgrpc-server";
import { getCapabilities } from "@scow/lib-auth";
import { authUrl } from "src/config";

export const authServicePlugin = plugin(async (f) => {
  const capabilities = await getCapabilities(authUrl);

  f.addExtension("capabilities", capabilities);
});
