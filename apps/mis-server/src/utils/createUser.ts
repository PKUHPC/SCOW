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

import { Logger } from "@ddadaal/tsgrpc-server";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { UniqueConstraintViolationException } from "@mikro-orm/core";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { ClusterConfigSchema, getLoginNode } from "@scow/config/build/cluster";
import { insertKeyAsUser } from "@scow/lib-ssh";
import { configClusters } from "src/config/clusters";
import { rootKeyPair } from "src/config/env";
import { StorageQuota } from "src/entities/StorageQuota";
import { Tenant } from "src/entities/Tenant";
import { User } from "src/entities/User";

export async function createUserInDatabase(
  userId: string,
  name: string,
  email: string,
  tenantName: string,
  logger: Logger,
  em: SqlEntityManager<MySqlDriver>,
  phone?: string,
  organization?: string,
  adminComment?: string,
) {
  // get default tenant
  const tenant = await em.findOne(Tenant, { name: tenantName });
  if (!tenant) {
    throw { code: Status.NOT_FOUND, message: `Tenant ${tenantName} is not found.` } as ServiceError;
  }

  // new the user
  const user = new User({
    email, name, tenant, userId, phone, organization, adminComment,
  });

  user.storageQuotas.add(Object.keys(configClusters).map((x) => new StorageQuota({
    cluster: x,
    storageQuota: 0,
    user: user,
  })));
  try {
    await em.persistAndFlush(user);
  } catch (e) {
    if (e instanceof UniqueConstraintViolationException) {
      throw {
        code: Status.ALREADY_EXISTS,
        message:`User with userId ${userId} already exists.`,
        details: "EXISTS_IN_SCOW",
      } as ServiceError;
    } else {
      throw e;
    }
  }
  return user;
}

export async function insertKeyToNewUser(
  userId: string,
  password: string,
  logger: Logger,
  currentClusters: Record<string, ClusterConfigSchema>,
) {
  // Making an ssh Request to the login node as the user created.
  if (process.env.NODE_ENV === "production") {

    await Promise.all(Object.values(currentClusters).map(async ({ displayName, loginNodes }) => {
      const node = getLoginNode(loginNodes[0]);
      logger.info("Checking if user can login to %s by login node %s", displayName, node.name);

      const error = await insertKeyAsUser(node.address, userId, password, rootKeyPair, logger).catch((e) => e);
      if (error) {
        logger
          .info("user %s cannot login to %s by login node %s. err: %o", userId, displayName, node.name, error);
        throw error;
      } else {
        logger.info("user %s login to %s by login node %s", userId, displayName, node.name);
      }
    }));
  }
}
