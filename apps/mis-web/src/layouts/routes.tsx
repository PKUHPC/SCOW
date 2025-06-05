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

import {
  AccountBookOutlined, AlertOutlined, BookOutlined, CloudServerOutlined,
  ClusterOutlined,
  ControlOutlined,
  DashboardOutlined,
  InfoOutlined, LineChartOutlined, LinkOutlined, LockOutlined, MoneyCollectOutlined, MonitorOutlined, PartitionOutlined,
  PlusOutlined, PlusSquareOutlined, ProfileOutlined,
  StarOutlined, ToolOutlined, UnlockOutlined,UserAddOutlined,
  UserOutlined } from "@ant-design/icons";
import { NavItemProps } from "@scow/lib-web/build/layouts/base/types";
import { NavIcon } from "@scow/lib-web/build/layouts/icon";
import { AccountAffiliation } from "@scow/protos/build/server/user";
import { join } from "path";
import { Lang } from "react-typed-i18n";
import { prefix } from "src/i18n";
import en from "src/i18n/en";
import { AccountState, PlatformRole, TenantRole, UserRole } from "src/models/User";
import { User } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";
import { createUserParams, useBuiltinCreateUser } from "src/utils/createUser";

type TransType = (id: Lang<typeof en>, args?: React.ReactNode[]) => string;
const pPlatform = prefix("layouts.route.platformManagement.");
const pTenant = prefix("layouts.route.tenantManagement.");
const pUserSpace = prefix("layouts.route.user.");
const pAccount = prefix("layouts.route.accountManagement.");

export const platformAdminRoutes: (platformRoles: PlatformRole[], t: TransType) => NavItemProps[]
= (platformRoles, t) => [
  {
    Icon: UserOutlined,
    text: t("layouts.route.platformManagement.fistNav"),
    path: "/admin",
    clickToPath: "/admin/info",
    children: [
      {
        Icon: InfoOutlined,
        text: t(pPlatform("info")),
        path: "/admin/info",
      },

      ...(platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ? [
        {
          Icon: MoneyCollectOutlined,
          text: t(pPlatform("jobBillingTable")),
          path: "/admin/jobBilling",
        },
        ...((publicConfig.AUTH_PPOLICY_CONFIG?.defaultOlcPPolicyDn &&
          publicConfig.AUTH_PPOLICY_CONFIG?.pwdMaxFailures) ?
          [{
            Icon: UnlockOutlined,
            text: t(pPlatform("userUnlock")),
            path: "/admin/lockedUsers",
          }] : []),
        {
          Icon: CloudServerOutlined,
          text: t(pPlatform("tenantsManagement")),
          path: "/admin/tenants",
          clickToPath: "/admin/tenants/list",
          children: [
            {
              Icon: UserOutlined,
              text: t(pPlatform("tenantsList")),
              path: "/admin/tenants/list",
            },
            {
              Icon: PlusOutlined,
              text: t(pPlatform("createTenant")),
              path: "/admin/tenants/create",
            },
          ],
        },
        {
          Icon: UserOutlined,
          text: t(pPlatform("usersList")),
          path: "/admin/users",
        },
        {
          Icon: AccountBookOutlined,
          text: t(pPlatform("accountList")),
          path: "/admin/accounts",
        },
      ] : []),
      {
        Icon: MoneyCollectOutlined,
        text: t(pPlatform("financeManagement")),
        path: "/admin/finance",
        clickable: false,
        children: [
          {
            Icon: PlusSquareOutlined,
            text: t(pPlatform("tenantPay")),
            path: "/admin/finance/pay",
          },
          {
            Icon: BookOutlined,
            text: t(pPlatform("payments")),
            path: "/admin/finance/payments",
          },
          {
            Icon: BookOutlined,
            text: t(pPlatform("accountChargeRecords")),
            path: "/admin/finance/accountChargeRecords",
          },
          ...(publicConfig.BILL_ENABLED
            ? [{
              Icon: AccountBookOutlined,
              text: t(pPlatform("accountBills")),
              path: "/admin/finance/bills",
            }] : []),
        ],
      },
      {
        Icon: ToolOutlined,
        text: t(pPlatform("systemDebug")),
        path: "/admin/systemDebug",
        clickable: false,
        children: [
          ...(platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ?
            [{
              Icon: UserOutlined,
              text: t(pPlatform("importUsers")),
              path: "/admin/importUsers",
            }] : []),
          {
            Icon: LockOutlined,
            text: t(pPlatform("statusSynchronization")),
            path: "/admin/systemDebug/slurmBlockStatus",
          },
          {
            Icon: BookOutlined,
            text: t(pPlatform("jobSynchronization")),
            path: "/admin/systemDebug/fetchJobs",
          },
        ],
      },
      ...(platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ? [{
        Icon: ControlOutlined,
        text: t(pPlatform("resourceManagement")),
        path: "/admin/resource",
        clickable: false,
        children: [
          {
            Icon: ClusterOutlined,
            text: t("layouts.route.platformManagement.clusterManagement"),
            path: "/admin/resource/clusterManagement",
          },
        ],
      }] : []),
      ...(platformRoles.includes(PlatformRole.PLATFORM_ADMIN) && publicConfig.CLUSTER_MONITOR.resourceStatus.enabled ?
        [{
          Icon: MonitorOutlined,
          text: t(pPlatform("clusterMonitor")),
          path: "/admin/monitor",
        }] : []),
      ...(platformRoles.includes(PlatformRole.PLATFORM_ADMIN) && publicConfig.CLUSTER_MONITOR.alarmLogs.enabled ?
        [{
          Icon: AlertOutlined,
          text: t(pPlatform("alarmLog")),
          path: "/admin/alarmLog",
        }] : []),
      ...(publicConfig.AUDIT_DEPLOYED && platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ?
        [{
          Icon: BookOutlined,
          text: t("layouts.route.common.operationLog"),
          path: "/admin/operationLogs",
        }] : []),
      ...(platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ?
        [{
          Icon: LineChartOutlined,
          text: t("layouts.route.common.statistic"),
          path: "/admin/statistic",
        }] : []),
    ],
  },
];

export const tenantRoutes: (tenantRoles: TenantRole[], token: string, t: TransType) => NavItemProps[]
= (tenantRoles, token, t) => [
  {
    Icon: CloudServerOutlined,
    text: t(pTenant("firstNav")),
    path: "/tenant",
    clickToPath: tenantRoles.includes(TenantRole.TENANT_ADMIN) ? "/tenant/info" : "/tenant/finance/payAccount",
    children: [
      ...(tenantRoles.includes(TenantRole.TENANT_ADMIN) ? [
        {
          Icon: InfoOutlined,
          text: t(pTenant("info")),
          path: "/tenant/info",
        },
        {
          Icon: MoneyCollectOutlined,
          text: t(pTenant("manageJobPrice")),
          path: "/tenant/jobBillingTable",
        },
        {
          Icon: BookOutlined,
          text: t(pTenant("runningJobs")),
          path: "/tenant/runningJobs",
        },
        {
          Icon: BookOutlined,
          text: t(pTenant("finishedJobs")),
          path: "/tenant/historyJobs",
        },
        {
          Icon: UserOutlined,
          text: t(pTenant("userManagement")),
          path: "/tenant/users",
          clickToPath: "/tenant/users/list",
          children: [
            ...(useBuiltinCreateUser() ? [{
              Icon: UserAddOutlined,
              text: t(pTenant("createUser")),
              path: "/tenant/users/create",
            }] : []),
            ...((
              publicConfig.CREATE_USER_CONFIG.misConfig.enabled &&
              publicConfig.CREATE_USER_CONFIG.misConfig.type === "external"
            ) ? [{
                Icon: UserAddOutlined,
                text: t(pTenant("createUser")),
                path: publicConfig.CREATE_USER_CONFIG.misConfig.external!.url + "?" + createUserParams(token),
                openInNewPage: true,
              }] : []),
            {
              Icon: UserOutlined,
              text: t(pTenant("userList")),
              path: "/tenant/users/list",
            },
          ],
        },
        // {
        //   Icon: ClockCircleOutlined,
        //   text: t(pTenant("jobTimeLimit")),
        //   path: "/tenant/jobTimeLimit",
        // },
        // {
        //   Icon: CloudOutlined,
        //   text: t(pTenant("storage")),
        //   path: "/tenant/storage",
        // },
        {
          Icon: AccountBookOutlined,
          text: t(pTenant("accountManagement")),
          path: "/tenant/accounts",
          clickToPath: "/tenant/accounts/list",
          children: [
            {
              Icon: PlusOutlined,
              text: t(pTenant("createAccount")),
              path: "/tenant/accounts/create",
            },
            {
              Icon: AccountBookOutlined,
              text: t(pTenant("accountList")),
              path: "/tenant/accounts/list",
            },
            {
              Icon: StarOutlined,
              text: t(pTenant("whitelist")),
              path: "/tenant/accounts/whitelist",
            },
          ],
        },
      ] : []),
      ...(tenantRoles.includes(TenantRole.TENANT_FINANCE) ||
          tenantRoles.includes(TenantRole.TENANT_ADMIN) ? [
          {
            Icon: MoneyCollectOutlined,
            text: t(pTenant("financeManagement")),
            path: "/tenant/finance",
            clickable: false,
            children: [
              {
                Icon: PlusSquareOutlined,
                text: t(pTenant("accountPay")),
                path: "/tenant/finance/payAccount",
              },
              {
                Icon: ProfileOutlined,
                text: t(pTenant("accountPayments")),
                path: "/tenant/finance/accountPayments",
              },
              {
                Icon: BookOutlined,
                text: t(pTenant("financePayments")),
                path: "/tenant/finance/payments",
              },
              {
                Icon: BookOutlined,
                text: t(pTenant("accountChargeRecords")),
                path: "/tenant/finance/accountChargeRecords",
              },
              ...(publicConfig.BILL_ENABLED ? [
                {
                  Icon: AccountBookOutlined,
                  text: t(pTenant("accountBills")),
                  path: "/tenant/finance/bills",
                },
              ] : []),
            ],
          },
        ] : []),
      ...(publicConfig.AUDIT_DEPLOYED && tenantRoles.includes(TenantRole.TENANT_ADMIN) ? [
        {
          Icon: BookOutlined,
          text: t("layouts.route.common.operationLog"),
          path: "/tenant/operationLogs",
        },
      ] : []),
    ],
  },
];

export const userRoutes: (accounts: AccountAffiliation[], t: TransType) => NavItemProps[] = (accounts, t) => [
  {
    Icon: DashboardOutlined,
    text: t("layouts.route.dashboard"),
    path: "/dashboard",
  },
  {
    Icon: BookOutlined,
    text: t(pUserSpace("firstNav")),
    path: "/user",
    clickToPath: accounts.length > 0 ? "/user/runningJobs" : "/user/partitions",
    children: [
      ...(accounts.length > 0 ? [
        {
          Icon: BookOutlined,
          text: t(pUserSpace("runningJobs")),
          path: "/user/runningJobs",
        },
        {
          Icon: BookOutlined,
          text: t(pUserSpace("finishedJobs")),
          path: "/user/historyJobs",
        },
      ] : []),
      {
        Icon: PartitionOutlined,
        text: t(pUserSpace("clusterPartitions")),
        path: "/user/partitions",
      },
      ...(publicConfig.AUDIT_DEPLOYED
        ? [{
          Icon: BookOutlined,
          text: t("layouts.route.common.operationLog"),
          path: "/user/operationLogs",
        }]
        : []),
    ],

  },
];

export const accountAdminRoutes: (adminAccounts: AccountAffiliation[], t: TransType) => NavItemProps[]
= (accounts, t) => [
  {
    Icon: UserOutlined,
    text: t(pAccount("firstNav")),
    path: "/accounts",
    children: accounts.filter((x) => x.accountState !== AccountState.DELETED).map((x) => ({
      Icon: AccountBookOutlined,
      text: `${x.accountName}`,
      path: `/accounts/${x.accountName}`,
      clickable: false,
      children: [
        {
          Icon: InfoOutlined,
          text: t(pAccount("info")),
          path: `/accounts/${x.accountName}/info`,
        },
        {
          Icon: BookOutlined,
          text: t(pAccount("runningJobs")),
          path: `/accounts/${x.accountName}/runningJobs`,
        },
        {
          Icon: BookOutlined,
          text: t(pAccount("finishedJobs")),
          path: `/accounts/${x.accountName}/historyJobs`,
        },
        {
          Icon: UserOutlined,
          text: t(pAccount("userManagement")),
          path: `/accounts/${x.accountName}/users`,
        },
        {
          Icon: BookOutlined,
          text: t(pAccount("pay")),
          path: `/accounts/${x.accountName}/payments`,
        },
        {
          Icon: BookOutlined,
          text: t(pAccount("cost")),
          path: `/accounts/${x.accountName}/charges`,
        },
        ...(publicConfig.BILL_ENABLED
          ? [{
            Icon: AccountBookOutlined,
            text: t(pAccount("bill")),
            path: `/accounts/${x.accountName}/bills`,
          }] : []),
        ...(publicConfig.AUDIT_DEPLOYED
          ? [{
            Icon: BookOutlined,
            text: t("layouts.route.common.operationLog"),
            path: `/accounts/${x.accountName}/operationLogs`,
          }]
          : []),
      ],

    })),
  },

];

export const customNavLinkRoutes = (navLinkItems: NavItemProps[]): NavItemProps[] => {
  return navLinkItems;
};

export const getAvailableRoutes = (user: User | undefined, t: TransType): NavItemProps[] => {

  if (!user) { return []; }

  const routes = [] as NavItemProps[];

  routes.push(...userRoutes(user.accountAffiliations, t));

  const adminAccounts = user.accountAffiliations.filter((x) => x.role !== UserRole.USER
  && x.accountState !== AccountState.DELETED);

  if (adminAccounts.length > 0) {
    routes.push(...accountAdminRoutes(adminAccounts, t));
  }

  if (user.tenantRoles.length !== 0) {
    routes.push(...tenantRoutes(user.tenantRoles, user.token, t));
  }

  if (user.platformRoles.length !== 0) {
    routes.push(...platformAdminRoutes(user.platformRoles, t));
  }

  // 获取当前用户角色
  const userCurrentRoles = getCurrentUserRoles(user);

  // 根据配置文件判断是否增加导航链接
  if (publicConfig.NAV_LINKS && publicConfig.NAV_LINKS.length > 0) {

    const mappedNavLinkItems = publicConfig.NAV_LINKS
      .filter((link) => !link.allowedRoles
        || (link.allowedRoles.length && link.allowedRoles.some((role) => userCurrentRoles[role])))
      .map((link) => {
        const childrenLinks = link.children?.filter((childLink) => !childLink.allowedRoles
          || (childLink.allowedRoles.length &&
            childLink.allowedRoles.some((role) => userCurrentRoles[role])))
          .map((childLink) => ({
            Icon: !childLink.iconPath ? LinkOutlined : (
              <NavIcon
                src={join(publicConfig.PUBLIC_PATH, childLink.iconPath)}
              />
            ),
            text: childLink.text,
            path: `${childLink.url}?token=${user.token}`,
            clickToPath: `${childLink.url}?token=${user.token}`,
            openInNewPage: childLink.openInNewPage,
          }) as NavItemProps);

        const parentNavPath = link.url ? `${link.url}?token=${user.token}`
          : (childrenLinks && childrenLinks.length > 0 ? childrenLinks[0].path : "");

        return {
          Icon: !link.iconPath ? LinkOutlined : (
            <NavIcon
              src={join(publicConfig.PUBLIC_PATH, link.iconPath)}
            />
          ),
          text: link.text,
          path: parentNavPath,
          clickToPath: parentNavPath,
          openInNewPage: link.openInNewPage,
          clickable: link.clickable,
          children: childrenLinks,
        };
      }) as NavItemProps[];


    routes.push(...customNavLinkRoutes(mappedNavLinkItems));
  }

  return routes;
};

const getCurrentUserRoles = (user: User) => {
  return {
    user: user.accountAffiliations.length === 0,
    accountUser: user.accountAffiliations.length > 0
      && user.accountAffiliations.every((affiliation) => affiliation.role === UserRole.USER &&
      affiliation.accountState !== AccountState.DELETED),
    accountAdmin: user.accountAffiliations.some((affiliation) => affiliation.role === UserRole.ADMIN &&
    affiliation.accountState !== AccountState.DELETED),
    accountOwner: user.accountAffiliations.some((affiliation) => affiliation.role === UserRole.OWNER &&
    affiliation.accountState !== AccountState.DELETED),
    platformAdmin: user.platformRoles.includes(PlatformRole.PLATFORM_ADMIN),
    platformFinance: user.platformRoles.includes(PlatformRole.PLATFORM_FINANCE),
    tenantAdmin: user.tenantRoles.includes(TenantRole.TENANT_ADMIN),
    tenantFinance: user.tenantRoles.includes(TenantRole.TENANT_FINANCE),
  };

};
