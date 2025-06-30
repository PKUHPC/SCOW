import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ChangeEmailResponse, UserServiceClient } from "@scow/protos/build/server/user";
import { getClientFn } from "src/utils/api";

export const libWebChangeEmail = async (
  userId: string,
  newEmail: string,
  misServerUrl?: string,
  scowApiAuthToken?: string,
): Promise<ChangeEmailResponse | undefined> => {

  // if mis is Deployed
  if (!misServerUrl) {
    console.log("Mis is not deployed, can not get userInfo from mis.");
    return undefined;
  }

  const config = {
    SERVER_URL: misServerUrl,
    SCOW_API_AUTH_TOKEN: scowApiAuthToken,
  };
  const getMisClient = getClientFn(config);
  const client = getMisClient(UserServiceClient);

  try {
    return await asyncClientCall(client, "changeEmail", { userId, newEmail });
  } catch (e: any) {
    console.error(e.details);
    return undefined;
  }
};
