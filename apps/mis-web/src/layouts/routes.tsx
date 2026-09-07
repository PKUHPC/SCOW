import { DefaultNavLinkIcon } from "@scow/lib-web/build/layouts/base/header/icons";
import { NavItemProps } from "@scow/lib-web/build/layouts/base/types";
import { NavIcon } from "@scow/lib-web/build/layouts/icon";
import { AccountAffiliation } from "@scow/protos/build/server/user";
import { join } from "path";
import { Lang } from "react-typed-i18n";
import {
  AccountAdminIcon,
  AccountChargeRecordsIcon,
  AccountCostIcon,
  AccountInfoIcon,
  AccountListIcon,
  AccountPayIcon,
  AccountPaymentsIcon,
  AccountWhitelistIcon,
  AdminInfoIcon,
  AdminManageIcon,
  AlarmLogIcon,
  AuthorizeAppIcon,
  ClusterManagementIcon,
  CreateAccountIcon,
  CreateUserIcon,
  CreatTenantIcon,
  DashBoardIcon,
  DefaultAuthorizedAppIcon,
  FetchJobsIcon,
  FinanceManagementIcon,
  FinancePayIcon,
  HistoryJobsIcon,
  ImportUsersIcon,
  JobBillingIcon,
  ManageJobPriceIcon,
  MessageConfigIcon,
  MonitorIcon,
  NodeMigrationIcon,
  PartitionsIcon,
  PayAccountIcon,
  PaymentsIcon,
  PermissionManagementIcon,
  PlatformDebugIcon,
  ResourceManageIcon,
  RunningJobsIcon,
  ShellIcon,
  SlurmBlockStatusIcon,
  StatisticIcon,
  TenantBillsIcon,
  TenantInfoIcon,
  TenantManageIcon,
  TenantPaymentsIcon,
  TenantsListIcon,
  TenantStorageQuotaIcon,
  UnlockLoginIcon,
  UserListIcon,
  UserManagementIcon,
  UserSpaceIcon,
} from "src/assets/headerIcons";
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

export const platformAdminRoutes: (platformRoles: PlatformRole[], t: TransType) => NavItemProps[] = (
  platformRoles,
  t,
) => [
  {
    Icon: AdminManageIcon,
    text: t("layouts.route.platformManagement.fistNav"),
    path: "/admin",
    clickToPath: "/admin/info",
    children: [
      {
        Icon: AdminInfoIcon,
        text: t(pPlatform("info")),
        path: "/admin/info",
      },

      ...(platformRoles.includes(PlatformRole.PLATFORM_ADMIN)
        ? [
            {
              Icon: JobBillingIcon,
              text: t(pPlatform("jobBillingTable")),
              path: "/admin/jobBilling",
            },
            {
              Icon: RunningJobsIcon,
              text: t(pPlatform("runningJobs")),
              path: "/admin/runningJobs",
            },
            {
              Icon: HistoryJobsIcon,
              text: t(pPlatform("finishedJobs")),
              path: "/admin/historyJobs",
            },
            ...(publicConfig.AUTH_PPOLICY_CONFIG?.defaultOlcPPolicyDn &&
            publicConfig.AUTH_PPOLICY_CONFIG?.pwdMaxFailures
              ? [
                  {
                    Icon: UnlockLoginIcon,
                    text: t(pPlatform("userUnlock")),
                    path: "/admin/lockedUsers",
                  },
                ]
              : []),
            {
              Icon: TenantManageIcon,
              text: t(pPlatform("tenantsManagement")),
              path: "/admin/tenants",
              clickToPath: "/admin/tenants/list",
              children: [
                {
                  Icon: TenantsListIcon,
                  text: t(pPlatform("tenantsList")),
                  path: "/admin/tenants/list",
                },
                {
                  Icon: CreatTenantIcon,
                  text: t(pPlatform("createTenant")),
                  path: "/admin/tenants/create",
                },
              ],
            },
            {
              Icon: UserListIcon,
              text: t(pPlatform("usersList")),
              path: "/admin/users",
            },
            {
              Icon: AccountListIcon,
              text: t(pPlatform("accountList")),
              path: "/admin/accounts",
            },
          ]
        : []),
      {
        Icon: FinanceManagementIcon,
        text: t(pPlatform("financeManagement")),
        path: "/admin/finance",
        clickable: false,
        children: [
          {
            Icon: FinancePayIcon,
            text: t(pPlatform("tenantPay")),
            path: "/admin/finance/pay",
          },
          {
            Icon: PaymentsIcon,
            text: t(pPlatform("payments")),
            path: "/admin/finance/payments",
          },
          {
            Icon: AccountChargeRecordsIcon,
            text: t(pPlatform("accountChargeRecords")),
            path: "/admin/finance/accountChargeRecords",
          },
          ...(publicConfig.BILL_ENABLED
            ? [
                {
                  Icon: TenantBillsIcon,
                  text: t(pPlatform("accountBills")),
                  path: "/admin/finance/bills",
                },
              ]
            : []),
        ],
      },
      // 资源管理始终可用，平台管理员始终展示权限管理导航
      ...(platformRoles.includes(PlatformRole.PLATFORM_ADMIN)
        ? [
            {
              Icon: PermissionManagementIcon,
              text: t(pPlatform("permissionManagement")),
              path: "/admin/permissionManagement",
              clickable: false,
              children: [
                {
                  Icon: AuthorizeAppIcon,
                  text: t(pPlatform("appAuthorization")),
                  path: "/admin/permissionManagement/appAuthorization",
                },
                // 如果UI EXtension 添加了资源管理，展示在此处
              ],
            },
          ]
        : []),
      {
        Icon: PlatformDebugIcon,
        text: t(pPlatform("systemDebug")),
        path: "/admin/systemDebug",
        clickable: false,
        children: [
          ...(platformRoles.includes(PlatformRole.PLATFORM_ADMIN)
            ? [
                {
                  Icon: ImportUsersIcon,
                  text: t(pPlatform("importUsers")),
                  path: "/admin/importUsers",
                },
              ]
            : []),
          {
            Icon: SlurmBlockStatusIcon,
            text: t(pPlatform("statusSynchronization")),
            path: "/admin/systemDebug/slurmBlockStatus",
          },
          {
            Icon: FetchJobsIcon,
            text: t(pPlatform("jobSynchronization")),
            path: "/admin/systemDebug/fetchJobs",
          },
          ...(platformRoles.includes(PlatformRole.PLATFORM_ADMIN) && publicConfig.ROOT_SHELL_ENABLED
            ? [
                {
                  Icon: ShellIcon,
                  text: t(pPlatform("shell")),
                  path: "/admin/shell",
                },
              ]
            : []),
        ],
      },
      ...(platformRoles.includes(PlatformRole.PLATFORM_ADMIN)
        ? [
            {
              Icon: ResourceManageIcon,
              text: t(pPlatform("resourceManagement")),
              path: "/admin/resource",
              clickable: false,
              children: [
                {
                  Icon: ClusterManagementIcon,
                  text: t("layouts.route.platformManagement.clusterManagement"),
                  path: "/admin/resource/clusterManagement",
                },
                ...(publicConfig.NODE_MIGRATION?.enabled
                  ? [
                      {
                        Icon: NodeMigrationIcon,
                        text: t("layouts.route.platformManagement.nodeMigration"),
                        path: "/admin/resource/nodeMigration",
                      },
                    ]
                  : []),
              ],
            },
          ]
        : []),
      ...(platformRoles.includes(PlatformRole.PLATFORM_ADMIN) && publicConfig.CLUSTER_MONITOR.resourceStatus.enabled
        ? [
            {
              Icon: MonitorIcon,
              text: t(pPlatform("clusterMonitor")),
              path: "/admin/monitor",
            },
          ]
        : []),
      ...(platformRoles.includes(PlatformRole.PLATFORM_ADMIN) && publicConfig.CLUSTER_MONITOR.alarmLogs.enabled
        ? [
            {
              Icon: AlarmLogIcon,
              text: t(pPlatform("alarmLog")),
              path: "/admin/alarmLog",
            },
          ]
        : []),
      ...(platformRoles.includes(PlatformRole.PLATFORM_ADMIN)
        ? [
            {
              Icon: StatisticIcon,
              text: t("layouts.route.common.statistic"),
              path: "/admin/statistic",
            },
          ]
        : []),
      ...(platformRoles.includes(PlatformRole.PLATFORM_ADMIN)
        ? [
            {
              Icon: MessageConfigIcon,
              text: t("layouts.route.platformManagement.notification"),
              path: "/admin/notification",
              children: [],
            },
          ]
        : []),
    ],
  },
];

export const tenantRoutes: (
  tenantRoles: TenantRole[],
  storageEnabled: boolean,
  token: string,
  t: TransType,
) => NavItemProps[] = (tenantRoles, storageEnabled, token, t) => [
  {
    Icon: TenantManageIcon,
    text: t(pTenant("firstNav")),
    path: "/tenant",
    clickToPath: tenantRoles.includes(TenantRole.TENANT_ADMIN) ? "/tenant/info" : "/tenant/finance/payAccount",
    children: [
      ...(tenantRoles.includes(TenantRole.TENANT_ADMIN)
        ? [
            {
              Icon: TenantInfoIcon,
              text: t(pTenant("info")),
              path: "/tenant/info",
            },
            {
              Icon: ManageJobPriceIcon,
              text: t(pTenant("manageJobPrice")),
              path: "/tenant/jobBillingTable",
            },
            {
              Icon: RunningJobsIcon,
              text: t(pTenant("runningJobs")),
              path: "/tenant/runningJobs",
            },
            {
              Icon: HistoryJobsIcon,
              text: t(pTenant("finishedJobs")),
              path: "/tenant/historyJobs",
            },
            {
              Icon: UserManagementIcon,
              text: t(pTenant("userManagement")),
              path: "/tenant/users",
              clickToPath: "/tenant/users/list",
              children: [
                ...(useBuiltinCreateUser()
                  ? [
                      {
                        Icon: CreateUserIcon,
                        text: t(pTenant("createUser")),
                        path: "/tenant/users/create",
                      },
                    ]
                  : []),
                ...(publicConfig.CREATE_USER_CONFIG.misConfig.enabled &&
                publicConfig.CREATE_USER_CONFIG.misConfig.type === "external"
                  ? [
                      {
                        Icon: CreateUserIcon,
                        text: t(pTenant("createUser")),
                        path: publicConfig.CREATE_USER_CONFIG.misConfig.external!.url + "?" + createUserParams(token),
                        openInNewPage: true,
                      },
                    ]
                  : []),
                {
                  Icon: UserListIcon,
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
              Icon: AccountAdminIcon,
              text: t(pTenant("accountManagement")),
              path: "/tenant/accounts",
              clickToPath: "/tenant/accounts/list",
              children: [
                {
                  Icon: CreateAccountIcon,
                  text: t(pTenant("createAccount")),
                  path: "/tenant/accounts/create",
                },
                {
                  Icon: AccountListIcon,
                  text: t(pTenant("accountList")),
                  path: "/tenant/accounts/list",
                },
                {
                  Icon: AccountWhitelistIcon,
                  text: t(pTenant("whitelist")),
                  path: "/tenant/accounts/whitelist",
                },
              ],
            },
            // 资源管理始终可用，租户管理员始终展示权限管理导航
            ...(tenantRoles.includes(TenantRole.TENANT_ADMIN)
              ? [
                  {
                    Icon: PermissionManagementIcon,
                    text: t(pTenant("permissionManagement")),
                    path: "/tenant/permissionManagement",
                    clickable: false,
                    children: [
                      {
                        Icon: DefaultAuthorizedAppIcon,
                        text: t(pTenant("defaultAuthorizedApp")),
                        path: "/tenant/permissionManagement/defaultApps",
                      },
                      {
                        Icon: AuthorizeAppIcon,
                        text: t(pTenant("appAuthorization")),
                        path: "/tenant/permissionManagement/appAuthorization",
                      },
                      // 如果UI EXtension 添加了资源管理，展示在此处
                    ],
                  },
                ]
              : []),
          ]
        : []),
      ...(tenantRoles.includes(TenantRole.TENANT_FINANCE) || tenantRoles.includes(TenantRole.TENANT_ADMIN)
        ? [
            {
              Icon: FinanceManagementIcon,
              text: t(pTenant("financeManagement")),
              path: "/tenant/finance",
              clickable: false,
              children: [
                {
                  Icon: PayAccountIcon,
                  text: t(pTenant("accountPay")),
                  path: "/tenant/finance/payAccount",
                },
                {
                  Icon: AccountPaymentsIcon,
                  text: t(pTenant("accountPayments")),
                  path: "/tenant/finance/accountPayments",
                },
                {
                  Icon: TenantPaymentsIcon,
                  text: t(pTenant("financePayments")),
                  path: "/tenant/finance/payments",
                },
                {
                  Icon: AccountChargeRecordsIcon,
                  text: t(pTenant("accountChargeRecords")),
                  path: "/tenant/finance/accountChargeRecords",
                },
                ...(publicConfig.BILL_ENABLED
                  ? [
                      {
                        Icon: TenantBillsIcon,
                        text: t(pTenant("accountBills")),
                        path: "/tenant/finance/bills",
                      },
                    ]
                  : []),
              ],
            },
          ]
        : []),
      ...(storageEnabled && tenantRoles.includes(TenantRole.TENANT_ADMIN)
        ? [
            {
              Icon: TenantStorageQuotaIcon,
              text: t(pTenant("storageManager")),
              path: "/tenant/storageManager",
            },
          ]
        : []),
    ],
  },
];

export const userRoutes: (accounts: AccountAffiliation[], t: TransType) => NavItemProps[] = (accounts, t) => [
  {
    Icon: DashBoardIcon,
    text: t("layouts.route.dashboard"),
    path: "/dashboard",
  },
  {
    Icon: UserSpaceIcon,
    text: t(pUserSpace("firstNav")),
    path: "/user",
    clickToPath: accounts.length > 0 ? "/user/runningJobs" : "/user/partitions",
    children: [
      ...(accounts.length > 0
        ? [
            {
              Icon: RunningJobsIcon,
              text: t(pUserSpace("runningJobs")),
              path: "/user/runningJobs",
            },
            {
              Icon: HistoryJobsIcon,
              text: t(pUserSpace("finishedJobs")),
              path: "/user/historyJobs",
            },
          ]
        : []),
      {
        Icon: PartitionsIcon,
        text: t(pUserSpace("clusterPartitions")),
        path: "/user/partitions",
      },
    ],
  },
];

export const accountAdminRoutes: (adminAccounts: AccountAffiliation[], t: TransType) => NavItemProps[] = (
  accounts,
  t,
) => [
  {
    Icon: AccountAdminIcon,
    text: t(pAccount("firstNav")),
    path: "/accounts",
    children: accounts
      .filter((x) => x.accountState !== AccountState.DELETED)
      .map((x) => ({
        Icon: AccountAdminIcon,
        text: `${x.accountName}`,
        path: `/accounts/${x.accountName}`,
        clickable: false,
        children: [
          {
            Icon: AccountInfoIcon,
            text: t(pAccount("info")),
            path: `/accounts/${x.accountName}/info`,
          },
          {
            Icon: RunningJobsIcon,
            text: t(pAccount("runningJobs")),
            path: `/accounts/${x.accountName}/runningJobs`,
          },
          {
            Icon: HistoryJobsIcon,
            text: t(pAccount("finishedJobs")),
            path: `/accounts/${x.accountName}/historyJobs`,
          },
          {
            Icon: UserManagementIcon,
            text: t(pAccount("userManagement")),
            path: `/accounts/${x.accountName}/users`,
          },
          {
            Icon: AccountPayIcon,
            text: t(pAccount("pay")),
            path: `/accounts/${x.accountName}/payments`,
          },
          {
            Icon: AccountCostIcon,
            text: t(pAccount("cost")),
            path: `/accounts/${x.accountName}/charges`,
          },
          ...(publicConfig.BILL_ENABLED
            ? [
                {
                  Icon: TenantBillsIcon,
                  text: t(pAccount("bill")),
                  path: `/accounts/${x.accountName}/bills`,
                },
              ]
            : []),
        ],
      })),
  },
];

export const customNavLinkRoutes = (navLinkItems: NavItemProps[]): NavItemProps[] => {
  return navLinkItems;
};

export const getAvailableRoutes = (user: User | undefined, storageEnabled: boolean, t: TransType): NavItemProps[] => {
  if (!user) {
    return [];
  }

  const routes = [] as NavItemProps[];

  routes.push(...userRoutes(user.accountAffiliations, t));

  const adminAccounts = user.accountAffiliations.filter(
    (x) => x.role !== UserRole.USER && x.accountState !== AccountState.DELETED,
  );

  if (adminAccounts.length > 0) {
    routes.push(...accountAdminRoutes(adminAccounts, t));
  }

  if (user.tenantRoles.length !== 0) {
    routes.push(...tenantRoutes(user.tenantRoles, storageEnabled, user.token, t));
  }

  if (user.platformRoles.length !== 0) {
    routes.push(...platformAdminRoutes(user.platformRoles, t));
  }

  // 获取当前用户角色
  const userCurrentRoles = getCurrentUserRoles(user);

  // 根据配置文件判断是否增加导航链接
  if (publicConfig.NAV_LINKS && publicConfig.NAV_LINKS.length > 0) {
    const mappedNavLinkItems = publicConfig.NAV_LINKS.filter(
      (link) =>
        !link.allowedRoles || (link.allowedRoles.length && link.allowedRoles.some((role) => userCurrentRoles[role])),
    ).map((link) => {
      const childrenLinks = link.children
        ?.filter(
          (childLink) =>
            !childLink.allowedRoles ||
            (childLink.allowedRoles.length && childLink.allowedRoles.some((role) => userCurrentRoles[role])),
        )
        .map(
          (childLink) =>
            ({
              Icon: !childLink.iconPath ? (
                DefaultNavLinkIcon
              ) : (
                <NavIcon src={join(publicConfig.PUBLIC_PATH, childLink.iconPath)} />
              ),
              text: childLink.text,
              path: childLink.url,
              clickToPath: childLink.url,
              openInNewPage: childLink.openInNewPage,
            }) as NavItemProps,
        );

      const parentNavPath = link.url
        ? link.url
        : childrenLinks && childrenLinks.length > 0
          ? childrenLinks[0].path
          : "";

      return {
        Icon: !link.iconPath ? DefaultNavLinkIcon : <NavIcon src={join(publicConfig.PUBLIC_PATH, link.iconPath)} />,
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
    accountUser:
      user.accountAffiliations.length > 0 &&
      user.accountAffiliations.every(
        (affiliation) => affiliation.role === UserRole.USER && affiliation.accountState !== AccountState.DELETED,
      ),
    accountAdmin: user.accountAffiliations.some(
      (affiliation) => affiliation.role === UserRole.ADMIN && affiliation.accountState !== AccountState.DELETED,
    ),
    accountOwner: user.accountAffiliations.some(
      (affiliation) => affiliation.role === UserRole.OWNER && affiliation.accountState !== AccountState.DELETED,
    ),
    platformAdmin: user.platformRoles.includes(PlatformRole.PLATFORM_ADMIN),
    platformFinance: user.platformRoles.includes(PlatformRole.PLATFORM_FINANCE),
    tenantAdmin: user.tenantRoles.includes(TenantRole.TENANT_ADMIN),
    tenantFinance: user.tenantRoles.includes(TenantRole.TENANT_FINANCE),
  };
};
