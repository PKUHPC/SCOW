import { applicationJsonHeaders, logHttpErrorAndThrow } from "src/utils";
import { Logger } from "ts-log";

export async function createUser(
  authUrl: string,
  params: { identityId: string; id: number; mail: string; name: string; password: string },
  logger?: Logger,
) {
  const resp = await fetch(authUrl + "/user", {
    method: "POST",
    body: JSON.stringify(params),
    headers: applicationJsonHeaders,
  });

  if (resp.status !== 204) {
    logHttpErrorAndThrow(resp, logger);
  }
}
