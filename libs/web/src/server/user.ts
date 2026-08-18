import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import {
  ChangeEmailResponse,
  GetUsersByIdsResponse,
  QueryIsUserEnabledRootShellResponse,
  UserServiceClient,
} from "@scow/protos/build/server/user";
import { getClientFn } from "src/utils/api";

export const libWebChangeEmail = async (
  userId: string,
  newEmail: string,
  misServerUrl: string,
  scowApiAuthToken?: string,
): Promise<ChangeEmailResponse | undefined> => {
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

export const libQueryIsUserEnabledRootShell = async (
  userId: string,
  misServerUrl: string,
  scowApiAuthToken?: string,
): Promise<QueryIsUserEnabledRootShellResponse> => {
  const config = {
    SERVER_URL: misServerUrl,
    SCOW_API_AUTH_TOKEN: scowApiAuthToken,
  };
  const getMisClient = getClientFn(config);
  const client = getMisClient(UserServiceClient);

  try {
    return await asyncClientCall(client, "queryIsUserEnabledRootShell", { userId });
  } catch (e: any) {
    console.error(`Error querying root shell enabled? for User ID ${userId}:`, e.details || e.message);
    return { result: false };
  }
};

export const libWebGetUsersByIds = async (
  userIds: string[],
  misServerUrl: string,
  scowApiAuthToken?: string,
): Promise<GetUsersByIdsResponse | undefined> => {
  const config = {
    SERVER_URL: misServerUrl,
    SCOW_API_AUTH_TOKEN: scowApiAuthToken,
  };
  const getMisClient = getClientFn(config);
  const client = getMisClient(UserServiceClient);

  if (!userIds || userIds.length === 0) {
    return { users: [] };
  }

  try {
    return asyncClientCall(client, "getUsersByIds", { userIds });
  } catch (e: any) {
    console.error("Failed to call getUsersByIds:", e instanceof Error ? e.message : e);
    return undefined;
  }
};
