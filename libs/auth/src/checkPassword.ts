import { join } from "path";
import { applicationJsonHeaders, logHttpErrorAndThrow } from "src/utils";
import { Logger } from "ts-log";

/**
 * Check the password is correct
 * @param authUrl the url for auth service
 * @param params the API parameters
 * @returns { success: boolean }
 */
export async function checkPassword(
  authUrl: string,
  params: { identityId: string; password: string },
  logger?: Logger,
): Promise<{ success: boolean } | undefined> {
  const query = new URLSearchParams([
    ["identityId", params.identityId],
    ["password", params.password],
  ]);
  const url = join(authUrl, "/checkPassword") + "?" + query.toString();

  const resp = await fetch(url, {
    method: "GET",
    headers: applicationJsonHeaders,
  });

  if (resp.status === 200) {
    return { success: (await resp.json()).success };
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
