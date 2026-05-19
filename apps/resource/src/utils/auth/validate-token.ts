import { Logger } from "ts-log";

export interface SimpleUserInfo {
  identityId: string;
}

export async function validateToken(
  authUrl: string,
  token: string,
  logger?: Logger,
): Promise<SimpleUserInfo | undefined> {
  const resp = await fetch(authUrl + "/public/validateToken?token=" + token, {
    method: "GET",
  });

  const body = (await resp.json()) as SimpleUserInfo;

  if (resp.status !== 200) {
    logger?.warn("Validation token failed. Status code %s. body: %s", resp.status, body);
    return;
  }

  logger?.trace("Validate token successful. identityId %s", body.identityId);

  return body;
}
