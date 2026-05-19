import { applicationJsonHeaders, logHttpErrorAndThrow } from "src/utils";
import { Logger } from "ts-log";

export async function changeEmail(authUrl: string, params: { identityId: string; newEmail: string }, logger?: Logger) {
  const resp = await fetch(authUrl + "/user/email", {
    method: "PATCH",
    body: JSON.stringify(params),
    headers: applicationJsonHeaders,
  });

  if (resp.status !== 204) {
    logHttpErrorAndThrow(resp, logger);
  }
}
