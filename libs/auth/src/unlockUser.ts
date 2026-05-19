import { applicationJsonHeaders, logHttpErrorAndThrow } from "src/utils";
import { Logger } from "ts-log";

export async function unlockUser(authUrl: string, params: { identityId: string }, logger?: Logger) {
  const resp = await fetch(authUrl + "/lockUser/unlock", {
    method: "PATCH",
    body: JSON.stringify(params),
    headers: applicationJsonHeaders,
  });

  if (resp.status !== 204) {
    logHttpErrorAndThrow(resp, logger);
  }
}
