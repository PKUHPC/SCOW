import { applicationJsonHeaders } from "./utils";

export async function deleteToken(token: string, authUrl: string) {
  return await fetch(authUrl + "/token?token=" + token, {
    method: "DELETE",
    headers: applicationJsonHeaders,
  });
}
