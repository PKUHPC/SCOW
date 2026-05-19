import { join } from "path";
import { applicationJsonHeaders, logHttpErrorAndThrow } from "src/utils";
import { Logger } from "ts-log";

export interface AuthUserInfo {
  identityId: string;
  name?: string;
  mail?: string;
}

/**
 * Get lockedUser info
 * @param authUrl the url for auth service
 * @param params the API parameters
 * @returns the user info. undefined if user do not exist
 */
export async function getLockedUsers(
  authUrl: string,
  params: { identityId?: string; name?: string },
  logger?: Logger,
): Promise<AuthUserInfo[] | undefined> {
  const searchParams = new URLSearchParams();
  if (params.identityId) {
    searchParams.append("identityId", params.identityId);
  }
  if (params.name) {
    searchParams.append("name", params.name);
  }
  const url = searchParams.toString()
    ? `${join(authUrl, "/lockUser/getLockedUsers")}?${searchParams.toString()}`
    : join(authUrl, "/lockUser/getLockedUsers");

  const resp = await fetch(url, {
    headers: applicationJsonHeaders,
  });

  if (resp.status === 200) {
    return (await resp.json()).user as AuthUserInfo[];
  } else if (resp.status === 404) {
    const json = await resp.json().catch(() => undefined);

    if (json?.code === "USER_NOT_FOUND") {
      return undefined;
    } else {
      logHttpErrorAndThrow(resp, logger);
    }
  } else {
    logHttpErrorAndThrow(resp, logger);
  }
}
