import { ServiceError, status } from "@grpc/grpc-js";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { Account } from "src/entities/Account";

import { ChargeRecordsTarget, getTenantAccountValidationInput } from "./chargesQuery";

export const ensureTargetAccountsBelongToTenant = async (
  em: SqlEntityManager<MySqlDriver>,
  target: ChargeRecordsTarget,
) => {
  const validationInput = getTenantAccountValidationInput(target);
  if (!validationInput) {
    return;
  }

  const uniqueAccountNames = Array.from(new Set(validationInput.accountNames.filter((x) => x)));
  if (uniqueAccountNames.length === 0) {
    return;
  }

  const matchedCount = await em.count(Account, {
    tenant: { name: validationInput.tenantName },
    accountName: { $in: uniqueAccountNames },
  });

  if (matchedCount !== uniqueAccountNames.length) {
    throw {
      code: status.PERMISSION_DENIED,
      message: "Invalid account scope for current tenant query.",
    } as ServiceError;
  }
};
