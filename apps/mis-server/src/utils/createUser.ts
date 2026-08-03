import { Logger } from "@ddadaal/tsgrpc-server";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { UniqueConstraintViolationException } from "@mikro-orm/core";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
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
    email,
    name,
    tenant,
    userId,
    phone,
    organization,
    adminComment,
  });

  try {
    await em.persistAndFlush(user);
  } catch (e) {
    if (e instanceof UniqueConstraintViolationException) {
      throw {
        code: Status.ALREADY_EXISTS,
        message: `User with userId ${userId} already exists.`,
        details: "EXISTS_IN_SCOW",
      } as ServiceError;
    } else {
      throw e;
    }
  }
  return user;
}
