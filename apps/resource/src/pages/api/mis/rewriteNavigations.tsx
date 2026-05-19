import { TRPCError } from "@trpc/server";
import { NextApiRequest, NextApiResponse } from "next";
import { applyMiddleware } from "src/applyMiddleware";
import { PlatformRole, TenantRole } from "src/models/user";
import { validateToken } from "src/server/auth/token";

interface NavItem {
  path: string;
  text: string;
  clickToPath?: string | undefined;
  clickable?: boolean | undefined;
  icon?: {
    src: string;
    alt?: string;
  };
  svgIcon?: string; // 使用被插入系统的svg icon，icon可以随菜单变色
  openInNewPage?: boolean | undefined;
  children?: NavItem[] | undefined;
}

interface Request {
  navs: NavItem[];
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const body = req.body as Request;

  const scowLangId = req.query.scowLangId as string;
  const scowUserToken = req.query.scowUserToken as string;

  const isChinese = scowLangId === "zh_cn";

  const userInfo = await validateToken(scowUserToken);

  if (userInfo?.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
    // 将租户授权分区页面插入到 平台管理-租户管理-三级导航的末端
    const adminTargetNav = body.navs
      .find((nav) => nav.path === "/admin")
      ?.children?.find((child) => child.path === "/admin/permissionManagement");
    if (!adminTargetNav?.children) {
      throw new TRPCError({
        message:
          "The navigation Platform/Tenants can not be found." +
          " Please confirm your navigation path name and try again.",
        code: "NOT_FOUND",
      });
    }

    adminTargetNav.children?.push({
      path: "/tenantPartitions",
      clickToPath: undefined,
      text: isChinese ? "授权集群分区" : "Assign Cluster Partition",
      svgIcon: "AccountPartitionsIcon",
    });
  }

  if (userInfo?.tenantRoles.includes(TenantRole.TENANT_ADMIN)) {
    // 将账户默认授权分区页面插入到 租户管理-账户管理-三级导航的末端
    // 将账户授权分区页面插入到账户默认授权分区页面后
    const tenantTargetNav = body.navs
      .find((nav) => nav.path === "/tenant")
      ?.children?.find((child) => child.path === "/tenant/permissionManagement");

    if (!tenantTargetNav?.children) {
      throw new TRPCError({
        message:
          "The navigation Tenant/Accounts can not be found." +
          " Please confirm your navigation path name and try again.",
        code: "NOT_FOUND",
      });
    }

    tenantTargetNav.children?.push(
      {
        path: "/accountDefaultClusters",
        clickToPath: undefined,
        text: isChinese ? "默认授权集群" : "Default Assigned Clusters",
        svgIcon: "DefaultClustersIcon",
      },
      {
        path: "/accountDefaultPartitions",
        clickToPath: undefined,
        text: isChinese ? "默认授权分区" : "Default Assigned Partitions",
        svgIcon: "DefaultPartitionsIcon",
      },
      {
        path: "/accountPartitions",
        clickToPath: undefined,
        text: isChinese ? "授权集群分区" : "Assign Cluster Partitions",
        svgIcon: "AccountPartitionsIcon",
      },
    );
  }

  return res.status(200).json({
    navs: body.navs,
  });
};

export default applyMiddleware(handler);
