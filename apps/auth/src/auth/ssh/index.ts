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

import { getLoginNode } from "@scow/config/build/cluster";
import { loggedExec, sshConnect } from "@scow/lib-ssh";
import { FastifyInstance } from "fastify";
import { AuthProvider } from "src/auth/AuthProvider";
import { serveLoginHtml } from "src/auth/loginHtml";
import { registerPostHandler } from "src/auth/ssh/postHandler";
import { authConfig, SshConfigSchema } from "src/config/auth";
import { clusters } from "src/config/clusters";
import { rootKeyPair } from "src/config/env";
import { ensureNotUndefined } from "src/utils/validations";

function checkLoginNode(sshConfig: SshConfigSchema) {

  let loginNode = sshConfig.baseNode;

  if (!loginNode) {
    if (Object.keys(clusters).length === 0) {
      throw new Error("No cluster has been set in clusters config");
    }
    const clusterId = Object.keys(clusters)[0];
    const clusterConfig = clusters[clusterId];

    loginNode = getLoginNode(clusterConfig.loginNodes[0]).address;

    if (!loginNode) {
      throw new Error(`Cluster ${clusterId} has no login node.`);
    }
  }

  return loginNode;
}

export const createSshAuthProvider = async (f: FastifyInstance) => {

  const { ssh } = ensureNotUndefined(authConfig, ["ssh"]);

  const loginNode = checkLoginNode(ssh);

  f.log.info("Determined login node %s", loginNode);

  registerPostHandler(f, loginNode);

  return {
    serveLoginHtml: (callbackUrl, req, rep) => serveLoginHtml({ err: false }, callbackUrl, req, rep),
    fetchAuthTokenInfo: async () => undefined,
    getUser: async (identityId, req) => {
      return await sshConnect(loginNode, "root", rootKeyPair, req.log, async (ssh) => {

        const resp = await loggedExec(ssh, req.log, false, "getent", ["passwd", identityId]);

        if (resp.code !== 0) { return undefined; }

        // https://en.wikipedia.org/wiki/Gecos_field
        // ddadaal:x:1000:1000::/home/ddadaal:/bin/zsh
        const gecosField = resp.stdout.split(":")[4];
        const fullName = gecosField.split(",")[0];

        return {
          identityId,
          name: fullName,
        };
      });
    },
    createUser: undefined,
    changePassword: undefined,
    checkPassword: undefined,
    changeEmail: undefined,
    deleteUser: undefined,
    unlockUser: undefined,
    getLockedUsers: undefined,
    updatePasswordResetFlag: undefined,
  } satisfies AuthProvider;

};
