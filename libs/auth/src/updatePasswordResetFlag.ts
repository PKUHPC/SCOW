import { applicationJsonHeaders, logHttpErrorAndThrow } from "src/utils";
import { Logger } from "ts-log";

export async function updatePasswordResetFlag(
  authUrl: string,
  params: { identityId: string; forceFlag: boolean },
  logger?: Logger,
) {
  const resp = await fetch(authUrl + "/updatePasswordResetFlag", {
    method: "PATCH",
    body: JSON.stringify(params),
    headers: applicationJsonHeaders,
  });

  if (resp.status !== 204) {
    logHttpErrorAndThrow(resp, logger);
  }
}
