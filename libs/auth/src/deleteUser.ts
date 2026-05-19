import { applicationJsonHeaders, logHttpErrorAndThrow } from "src/utils";
import { Logger } from "ts-log";

export async function deleteUser(authUrl: string, identityId: string, logger?: Logger) {
  const resp = await fetch(authUrl + "/user?identityId=" + identityId, {
    method: "DELETE",
    headers: applicationJsonHeaders,
  });

  if (resp.status !== 204) {
    logHttpErrorAndThrow(resp, logger);
  }
}
