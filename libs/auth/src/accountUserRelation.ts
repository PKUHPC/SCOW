import { applicationJsonHeaders, logHttpErrorAndThrow } from "src/utils";
import { Logger } from "ts-log";

export async function createAccount(
  authUrl: string,
  params: { accountName: string; ownerUserId: string },
  logger?: Logger,
) {
  const resp = await fetch(authUrl + "/account", {
    method: "POST",
    body: JSON.stringify(params),
    headers: applicationJsonHeaders,
  });

  if (resp.status !== 204) {
    logHttpErrorAndThrow(resp, logger);
  }
}

export async function addUserToAccount(
  authUrl: string,
  params: { accountName: string; userId: string },
  logger?: Logger,
) {
  const resp = await fetch(authUrl + `/account/${params.accountName}/user`, {
    method: "POST",
    body: JSON.stringify({ userId: params.userId }),
    headers: applicationJsonHeaders,
  });

  if (resp.status !== 204) {
    logHttpErrorAndThrow(resp, logger);
  }
}

export async function removeUserFromAccount(
  authUrl: string,
  params: { accountName: string; userId: string },
  logger?: Logger,
) {
  const resp = await fetch(authUrl + `/account/${params.accountName}/user/${params.userId}`, {
    method: "DELETE",
    headers: applicationJsonHeaders,
  });

  if (resp.status !== 204) {
    logHttpErrorAndThrow(resp, logger);
  }
}

export async function setUserDefaultAccount(
  authUrl: string,
  params: { userId: string; defaultAccountName: string },
  logger?: Logger,
) {
  const resp = await fetch(authUrl + `/user/${params.userId}/defaultAccount`, {
    method: "PUT",
    body: JSON.stringify({ accountName: params.defaultAccountName }),
    headers: applicationJsonHeaders,
  });

  if (resp.status !== 204) {
    logHttpErrorAndThrow(resp, logger);
  }
}

export async function unsetUserDefaultAccount(authUrl: string, params: { userId: string }, logger?: Logger) {
  const resp = await fetch(authUrl + `/user/${params.userId}/defaultAccount`, {
    method: "DELELE",
    headers: applicationJsonHeaders,
  });

  if (resp.status !== 204) {
    logHttpErrorAndThrow(resp, logger);
  }
}

// export async function deleteAccount(
//   authUrl: string,
//   params: { accountName: string; comment: string },
//   logger?: Logger,
// ) {
//   const resp = await fetch(authUrl + `/account/${params.accountName}/comment/${params.comment}`, {
//     method: "DELETE",
//     headers: applicationJsonHeaders,
//   });

//   if (resp.status !== 204) {
//     logHttpErrorAndThrow(resp, logger);
//   }
// }
