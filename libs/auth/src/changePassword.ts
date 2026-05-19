import { Logger } from "ts-log";

import { applicationJsonHeaders, logHttpErrorAndThrow } from "./utils";

export async function changePassword(
  authUrl: string,
  params: { identityId: string; newPassword: string },
  logger?: Logger,
) {
  const resp = await fetch(authUrl + "/password", {
    method: "PATCH",
    body: JSON.stringify(params),
    headers: applicationJsonHeaders,
  });

  if (resp.status !== 204) {
    logHttpErrorAndThrow(resp, logger);
  }
}
