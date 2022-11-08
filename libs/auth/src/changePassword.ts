import { Logger } from "ts-log";

interface ResponseStatusSchema {
  status: number;
}

export async function changePassword(
  authUrl: string, identityId: string, oldPassword: string, newPassword: string, logger?: Logger)
  : Promise<ResponseStatusSchema | undefined> {
  const resp = await fetch(authUrl + "/password", {
    method: "PATCH",
    body: JSON.stringify({
      identityId,
      newPassword,
      oldPassword,
    }),
  });

  if (resp.status !== 204) {
    logger?.warn("Change password failed. Status code %s", resp.status);
    return;
  }
  logger?.trace("Change password successful");

  return { status: resp.status };
}