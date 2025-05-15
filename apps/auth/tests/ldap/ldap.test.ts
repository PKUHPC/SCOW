/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { FastifyInstance } from "fastify";
import { Client, createClient, NoSuchObjectError, SearchEntry } from "ldapjs";
import { buildApp } from "src/app";
import { saveCaptchaText } from "src/auth/captcha";
import { extractAttr, findUser, searchOne, takeOne } from "src/auth/ldap/helpers";
import { authConfig, NewUserGroupStrategy } from "src/config/auth";
import { ensureNotUndefined } from "src/utils/validations";
import { allowedCallbackUrl, createFormData } from "tests/utils";
import { promisify } from "util";

interface RequestHeaders {
  "Content-Type": string;
  [key: string]: string;
}

let server: FastifyInstance;

const callbackUrl = allowedCallbackUrl;

const { ldap } = ensureNotUndefined(authConfig, ["ldap"]);
let client: Client;

const user = {
  mail: "test@test.com",
  id: 10,
  identityId: "123",
  name: "name",
  password: "12#",
  captchaToken: "captchaToken",
  captchaCode: "captchaCode",
};

const savedUserMail = "mail is " + user.mail;

class ConfigNoAddUserError extends Error {}

if (!ldap.addUser) {
  throw new ConfigNoAddUserError();
}

const userDn = `${ldap.addUser.userIdDnKey}=${user.identityId},${ldap.addUser.userBase}`;
const groupDn =
  `${ldap.addUser.newGroupPerUser!.groupIdDnKey}=${user.identityId},`
  + `${ldap.addUser.newGroupPerUser!.groupBase}`;

beforeEach(async () => {
  server = await buildApp();

  await server.ready();

  client = createClient({ url: ldap.url, log: server.log });
  await promisify(client.bind.bind(client))(ldap.bindDN, ldap.bindPassword);
});

function extractOne(entry: SearchEntry, property: string) {
  return takeOne(extractAttr(entry, property));
}

async function removeEvenNotExist(client: Client, dn: string) {
  return new Promise<void>((res, rej) => {
    client.del(dn, (err) => {
      if (err) {
        if (err instanceof NoSuchObjectError) {
          console.log("No entity with dn " + dn);
        } else {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          rej(err);
        }
      }
      res();
    });
  });
}

async function performLogin(payload: string, headers: RequestHeaders) {
  await saveCaptchaText(server, user.captchaCode, user.captchaToken);
  return server.inject({
    method: "POST",
    url: "/public/auth",
    payload,
    headers,
  });
};

afterEach(async () => {
  await removeEvenNotExist(client, userDn);
  await removeEvenNotExist(client, groupDn);
  client.destroy();

  await server.close();
});

async function searchByDn(client: Client, dn: string) {
  return searchOne(server.log, client, dn, { scope: "base" }, (e) => e);
}

const createUser = async () => {
  const resp = await server.inject({
    method: "POST",
    url: "/user",
    payload: user,
  });

  expect(resp.statusCode).toBe(204);

};

it("locks and unlocks account after configured failed attempts", async () => {
  await createUser();

  // 执行n次错误登录
  for (let i = 0; i < (ldap.ppolicy?.pwdMaxFailures || 0); i++) {
    const { payload, headers } = createFormData({
      username: user.identityId,
      password: user.password + "0",
      callbackUrl,
      token: user.captchaToken,
      code: user.captchaCode,
    });
    const resp = await performLogin(payload, headers);
    expect(resp.statusCode).toBe(401);
  }

  const getUserResp = await server.inject({
    method: "GET",
    url: "/lockUser/getLockedUsers",
    query: { identityId: user.identityId },
  });
  expect(getUserResp.statusCode).toBe(200);

  expect(getUserResp.json()).toEqual({ user: [expect.objectContaining({
    identityId: user.identityId,
    name: user.name,
    mail: savedUserMail,
  })]});

  const unlockResp = await server.inject({
    method: "PATCH",
    url: "/lockUser/unlock",
    payload: { identityId: user.identityId },
  });
  expect(unlockResp.statusCode).toBe(204);

  const getUserAgainResp = await server.inject({
    method: "GET",
    url: "/lockUser/getLockedUsers",
    query: { identityId: user.identityId },
  });
  expect(getUserAgainResp.json()).toEqual({ user: []});
});

it("enforce password reset when pwdMustChangeAtFirstLoginOrResetByAdmin is active", async () => {
  await createUser();

  const lockResp = await server.inject({
    method: "PATCH",
    url: "/updatePasswordResetFlag",
    payload: { identityId:user.identityId, forceFlag: true },
  });
  expect(lockResp.statusCode).toBe(204);

  // login
  const { payload, headers } = createFormData({
    username: user.identityId,
    password: user.password,
    callbackUrl,
    token: user.captchaToken,
    code: user.captchaCode,
  });
  const loginResp = await performLogin(payload, headers);

  expect(loginResp.statusCode).toBe(200);
  expect(loginResp.headers.location).toBe(undefined);

  const unlockResp = await server.inject({
    method: "PATCH",
    url: "/updatePasswordResetFlag",
    payload: { identityId:user.identityId, forceFlag: false },
  });
  expect(unlockResp.statusCode).toBe(204);

  const loginAgainResp = await performLogin(payload, headers);
  expect(loginAgainResp.statusCode).toBe(302);
  expect(loginAgainResp.headers.location).toStartWith(callbackUrl + "?");
});

it("creates user and group if groupStrategy is newGroupPerUser", async () => {

  if (!ldap.addUser) {
    throw new ConfigNoAddUserError();
  }

  ldap.addUser.groupStrategy = NewUserGroupStrategy.newGroupPerUser;

  await createUser();

  const responseUser = await findUser(server.log, ldap, client, user.identityId);

  expect(responseUser).toEqual({
    dn: userDn,
    identityId: user.identityId,
    loginShell: "/bin/bash",
    mail: savedUserMail,
    name: user.name,
  });

  const ldapUser = await searchByDn(client, userDn);
  if (!ldapUser) { fail("response user is not defined"); }

  const uid = ldap.addUser.uidStart + user.id + "";

  expect(extractOne(ldapUser, "uidNumber")).toBe(uid);
  expect(extractOne(ldapUser, "gidNumber")).toBe(uid);
  expect(extractOne(ldapUser, "uid")).toBe(user.identityId);
  expect(extractOne(ldapUser, "cn")).toBe(user.name);
  expect(extractOne(ldapUser, "mail")).toBe(`mail is ${user.mail}`);

  const ldapGroup = await searchByDn(client, groupDn);
  if (!ldapGroup) { fail("response group is not defined"); }

  expect(ldapGroup.dn).toBe(groupDn);
  expect(extractOne(ldapGroup, "memberUid")).toBe(user.identityId);

});

it("creates only user if groupStrategy is oneGroupForAllUsers", async () => {

  if (!ldap.addUser) {
    throw new ConfigNoAddUserError();
  }

  ldap.addUser.groupStrategy = NewUserGroupStrategy.oneGroupForAllUsers;

  await createUser();

  const ldapUser = await searchByDn(client, userDn);
  if (!ldapUser) { fail("response user is not defined"); }

  const uid = ldap.addUser.uidStart + user.id + "";

  expect(extractOne(ldapUser, "uidNumber")).toBe(uid);
  expect(extractOne(ldapUser, "gidNumber")).toBe(1000 + "");

});

it("returns correct error if user already exists", async () => {
  await createUser();

  const resp = await server.inject({
    method: "POST",
    url: "/user",
    payload: user,
  });

  expect(resp.statusCode).toBe(409);

});

it("test to input a wrong verifyCaptcha", async () => {
  await createUser();

  // login
  const { payload, headers } = createFormData({
    username: user.identityId,
    password: user.password,
    callbackUrl,
    token: user.captchaToken,
    code: "wrongCaptcha",
  });
  const resp = await performLogin(payload, headers);
  expect(resp.statusCode).toBe(400);
});

it("should login with correct username and password", async () => {

  await createUser();


  // login
  const { payload, headers } = createFormData({
    username: user.identityId,
    password: user.password,
    callbackUrl,
    token: user.captchaToken,
    code: user.captchaCode,
  });
  const resp = await performLogin(payload, headers);


  expect(resp.statusCode).toBe(302);
  expect(resp.headers.location).toStartWith(callbackUrl + "?");
});

it("should not login with wrong password", async () => {

  await createUser();

  // login
  const { payload, headers } = createFormData({
    username: user.identityId,
    password: user.password + "0",
    callbackUrl,
    token: user.captchaToken,
    code: user.captchaCode,
  });
  const resp = await performLogin(payload, headers);

  expect(resp.statusCode).toBe(401);
});

it("gets user info", async () => {
  await createUser();

  const resp = await server.inject({
    method: "GET",
    url: "/user",
    query: { identityId: user.identityId },
  });

  expect(resp.statusCode).toBe(200);
  expect(resp.json()).toEqual({ user: {
    identityId: user.identityId,
    name: user.name,
    mail: savedUserMail,
  } });
});

it("returns 404 if user doesn't exist", async () => {
  const resp = await server.inject({
    method: "GET",
    url: "/user",
    query: { identityId: user.identityId },
  });

  expect(resp.statusCode).toBe(404);
  expect(resp.json()).toEqual({ code: "USER_NOT_FOUND" });
});

it("change user email", async () => {

  await createUser();

  const newEmail = "test@123.com";
  const changeEmaiResp = await server.inject({
    method: "PATCH",
    url: "/user/email",
    payload: { identityId:user.identityId, newEmail },
  });


  const getUserResp = await server.inject({
    method: "GET",
    url: "/user",
    query: { identityId: user.identityId },
  });

  expect(changeEmaiResp.statusCode).toBe(204);

  expect(getUserResp.statusCode).toBe(200);
  expect(getUserResp.json().user.mail).toEqual(newEmail);

});
it("check password", async () => {
  await createUser();

  const correctPassword = user.password;
  const wrongPassword = user.password + "123";
  const notExistedIdentityId = user.identityId + "123";

  // wrong password
  const wrongResp = await server.inject({
    method: "GET",
    url: "/checkPassword",
    query: { identityId: user.identityId, password: wrongPassword },
  });
  expect(wrongResp.statusCode).toBe(200);
  expect(wrongResp.json()).toEqual({ success: false });

  // correct password
  const correctResp = await server.inject({
    method: "GET",
    url: "/checkPassword",
    query: { identityId: user.identityId, password: correctPassword },
  });
  expect(correctResp.statusCode).toBe(200);
  expect(correctResp.json()).toEqual({ success: true });

  // not existed
  const notExistedResp = await server.inject({
    method: "GET",
    url: "/checkPassword",
    query: { identityId: notExistedIdentityId, password: correctPassword },
  });
  expect(notExistedResp.statusCode).toBe(404);
});

it("change password", async () => {
  await createUser();

  const oldPassword = user.password;
  const newPassword = user.password + "123";
  const notExistedIdentityId = user.identityId + "123";

  // change password
  const changePasswordResp = await server.inject({
    method: "PATCH",
    url: "password",
    body: { identityId: user.identityId, newPassword: newPassword },
  });
  expect(changePasswordResp.statusCode).toBe(204);

  // check password
  const oldPasswordResp = await server.inject({
    method: "GET",
    url: "/checkPassword",
    query: { identityId: user.identityId, password: oldPassword },
  });
  expect(oldPasswordResp.statusCode).toBe(200);
  expect(oldPasswordResp.json()).toEqual({ success: false });
  const newPasswordResp = await server.inject({
    method: "GET",
    url: "/checkPassword",
    query: { identityId: user.identityId, password: newPassword },
  });
  expect(newPasswordResp.statusCode).toBe(200);
  expect(newPasswordResp.json()).toEqual({ success: true });

  // not existed
  const notExistedResp = await server.inject({
    method: "PATCH",
    url: "password",
    body: { identityId: notExistedIdentityId, newPassword: newPassword },
  });
  expect(notExistedResp.statusCode).toBe(404);
  expect(notExistedResp.json()).toBe(null);
});

it("delete user", async () => {
  await createUser();

  const { payload, headers } = createFormData({
    username: user.identityId,
    password: user.password,
    callbackUrl,
    token: user.captchaToken,
    code: user.captchaCode,
  });

  const resp = await performLogin(payload, headers);

  expect(resp.statusCode).toBe(302);

  const deleteUserResp = await server.inject({
    method: "DELETE",
    url: "/user",
    query: { identityId: user.identityId },
  });

  expect(deleteUserResp.statusCode).toBe(204);

  const newResp = await server.inject({
    method: "POST",
    url: "/public/auth",
    payload,
    headers,
  });

  expect(newResp.statusCode).toBe(400);
  // 只是设置了loginshell，并没有在ldap中真正清除用户
  const userInfo = await server.inject({
    method: "GET",
    url: "/user",
    query: { identityId: user.identityId },
  });

  expect(userInfo.statusCode).toBe(200);
  expect(userInfo.json()).toEqual({ user: {
    identityId: user.identityId,
    name: user.name,
    mail: savedUserMail,
  } });
});
