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

import { AccountOfTenantTarget, AccountsOfAllTenantsTarget,
  AccountsOfTenantTarget, AllTenantsTarget,
  TenantTarget } from "@scow/protos/build/server/charging";
import { config } from "src/config/env";
import { misConfig } from "src/config/mis";

import { CHARGE_TYPE_OTHERS } from "./constants";

export type ChargeRecordsTarget =
  | { $case: "accountOfTenant"; accountOfTenant: AccountOfTenantTarget }
  | { $case: "accountsOfTenant"; accountsOfTenant: AccountsOfTenantTarget }
  | { $case: "accountsOfAllTenants"; accountsOfAllTenants: AccountsOfAllTenantsTarget }
  | { $case: "tenant"; tenant: TenantTarget }
  | { $case: "allTenants"; allTenants: AllTenantsTarget }
  | undefined;

/**
 * generate charge records' search param of target
 *
 * @param target
 * case tenant:返回这个租户（tenantName）的消费记录
 * case allTenants: 返回所有租户消费记录
 * case accountOfTenant: 返回这个租户（tenantName）下这个账户（accountName）的消费记录
 * case accountsOfTenant: 返回这个租户（tenantName）下任意多个账户的消费记录
 * case accountsOfAllTenants: 返回所有租户下多个账户的消费记录
 *
 */
export const getChargesTargetSearchParam = (
  target: ChargeRecordsTarget,
): { tenantName?: string | { $ne: null }, accountName?: string | { $ne: null } | { $in: string[] } } => {

  let searchParam: { tenantName?: string | { $ne: null },
    accountName?: string | { $ne: null } | { $in: string[] } } = {};
  switch (target?.$case)
  {
  // 当前租户的租户消费记录
    case "tenant":
      searchParam = { tenantName: target[target.$case].tenantName, accountName: undefined };
      break;
      // 所有租户的租户消费记录
    case "allTenants":
      searchParam = { accountName: undefined };
      break;
      // 当前租户下当前账户的消费记录
    case "accountOfTenant":
      searchParam = { tenantName: target[target.$case].tenantName, accountName: target[target.$case].accountName };
      break;
      // 当前租户下多个账户的消费记录
    case "accountsOfTenant":
      {
        const { accountNames } = target.accountsOfTenant;
        searchParam = { tenantName: target[target.$case].tenantName,
          accountName:accountNames.length ? { $in: accountNames } : { $ne:null } };
        break;
      } ;
      // 所有租户下多个账户的消费记录
    case "accountsOfAllTenants":
      {
        const { accountNames } = target.accountsOfAllTenants;
        searchParam = { accountName:accountNames.length ? { $in: accountNames } : { $ne:null } };
        break;
      };
    default:
      searchParam = {};
  }
  return searchParam;
};

export const getTenantAccountValidationInput = (
  target: ChargeRecordsTarget,
): { tenantName: string, accountNames: string[] } | undefined => {
  switch (target?.$case) {
    case "accountOfTenant":
      return { tenantName: target.accountOfTenant.tenantName, accountNames: [target.accountOfTenant.accountName]};
    case "accountsOfTenant":
      return { tenantName: target.accountsOfTenant.tenantName, accountNames: target.accountsOfTenant.accountNames };
    default:
      return undefined;
  }
};

// 有账户或者用户条件时可以省略租户
export const getChargesTargetSearchParamForQuery = (
  targetSearchParam: { tenantName?: string | { $ne: null }, accountName?: string | { $ne: null } | { $in: string[] } },
  hasUserFilter: boolean,
) => {
  if (targetSearchParam.accountName !== undefined) {
    return { accountName: targetSearchParam.accountName };
  }
  if (hasUserFilter) {
    return {};
  }
  return targetSearchParam;
};

// 获得搜索用的type数组
export const getTypesToSearch = () => {
  return [
    misConfig.jobChargeType,
    misConfig.changeJobPriceType,
    ...(config.QUANTUM_DEPLOYED ? [misConfig.quantumJobChargeType] : []),
    ...(misConfig.customChargeTypes || []),
  ];
};

/**
 * generate charge records' search type
 */
export const getChargesSearchType = (type: string | undefined) => {
  const typesToSearch = getTypesToSearch();

  let searchType = {};
  if (!type) {
    searchType = {};
  } else {
    if (type === CHARGE_TYPE_OTHERS) {
      searchType = { type: { $nin: typesToSearch } };
    } else {
      searchType = { type: type };
    }
  }

  return searchType;
};

export const getChargesSearchTypes = (types: string[] | undefined) => {
  // 排除不包含types或者空数组的情况
  if (!types?.length) {
    return {};
  }

  const typesToSearch = getTypesToSearch();

  const includeOthers = types.includes(CHARGE_TYPE_OTHERS);

  // 过滤掉 CHARGE_TYPE_OTHERS，保留需要 $in 查询的实际类型
  const actualTypes = types.filter((t) => t !== CHARGE_TYPE_OTHERS);

  // 如果不包含 CHARGE_TYPE_OTHERS , actualTypes 中有类型（已排除空数组）
  if (!includeOthers) {
    return { type: { $in: actualTypes } };
  }

  // 如果包含了CHARGE_TYPE_OTHERS
  const othersCondition = { type: { $nin: typesToSearch } };

  // 检查是否只有 CHARGE_TYPE_OTHERS
  if (actualTypes.length === 0) {
    return othersCondition;
  }

  // 既包含 OTHERS，又包含其他明确的类型，需要用 $or 组合
  const orConditions: any[] = [];

  orConditions.push({ type: { $in: actualTypes } });
  orConditions.push(othersCondition);

  // 返回 $or 组合查询
  return { $or: orConditions };
};

/**
 *
 * @param target
 * case tenant:返回这个租户（tenantName）的充值记录
 * case allTenants: 返回所有租户充值记录
 * case accountsOfTenant: 返回这个租户（tenantName）下多个账户的充值记录
 */

export const getPaymentsTargetSearchParam = (target:
| { $case: "accountOfTenant";accountOfTenant: AccountOfTenantTarget; }
| { $case: "accountsOfTenant"; accountsOfTenant: AccountsOfTenantTarget }
| { $case: "tenant"; tenant: TenantTarget }
| { $case: "allTenants"; allTenants: AllTenantsTarget }):
{ tenantName?: string | { $ne: null }, accountName?: { $in: string[] } | string | { $ne: null } } => {

  let searchParam: {
    tenantName?: string | { $ne: null },
    accountName?: { $in: string[] } | string | { $ne: null }
  } = {};

  const { accountNames, tenantName } = target[target.$case];
  switch (target?.$case)
  {
    case "tenant":
      searchParam = { tenantName, accountName:undefined };
      break;
    case "allTenants":
      searchParam = { accountName:undefined };
      break;
    case "accountsOfTenant": {
      const accountName = accountNames.length === 0 ? { $ne:null } : { $in:accountNames };
      searchParam = { tenantName, accountName };
      break;
    }
    default:
      break;
  }
  return searchParam;
};

/**
 * generate payment search type
 */
export const getPaymentsSearchType = (types: string[] | undefined) => {
  if (!types?.length) {
    return { type: { $ne: null } };
  }

  return { type:{ $in:types } };
};
