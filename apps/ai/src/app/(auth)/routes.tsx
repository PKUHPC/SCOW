"use client";

import { DefaultNavLinkIcon } from "@scow/lib-web/build/layouts/base/header/icons";
import { NavItemProps } from "@scow/lib-web/build/layouts/base/types";
import { NavIcon } from "@scow/lib-web/build/layouts/icon";
import { join } from "path";
import { TransType } from "src/i18n";
import {
  AlgorithmIcon, AppIcon, DashBoardIcon,
  DataAssetIcon, DatasetIcon, DevelopAndTrainIcon, FileIcon,
  ImageIcon, InferIcon, jobIcon, ModelIcon, TrainJobIcon, ViewDevHostIcon,
} from "src/icons/menuIcons";
import { ClientUserInfo } from "src/server/trpc/route/auth";
import { Cluster, NavLink, PublicConfig } from "src/server/trpc/route/config";

import { ScowClusterConfigs } from "./context";

export const userRoutes: (
  user: ClientUserInfo | undefined,
  publicConfig: PublicConfig,
  clusterConfigs: ScowClusterConfigs,
  currentClusters: Cluster[],
  t: TransType,
) => NavItemProps[] = (
  user,
  publicConfig,
  clusterConfigs,
  currentClusters,
  t,
) => {

    if (!user) { return []; }
    const devHostEnabled = currentClusters.some((c) => clusterConfigs[c.id]?.ai.devHost.enabled);

    return [
      {
        Icon: DashBoardIcon,
        text: t("routes.dashboard"),
        path: "/dashboard",
        clickToPath: "/dashboard",
      },
      {
        Icon: DataAssetIcon,
        text: t("routes.asset"),
        path: "/asset",
        clickToPath: "/asset/dataset",
        children: [
          {
            Icon: DatasetIcon,
            text: t("routes.data.title"),
            path: "/asset/dataset",
          },
          {
            Icon: ImageIcon,
            text: t("routes.image.title"),
            path: "/asset/image",
          },
          {
            Icon: AlgorithmIcon,
            text: t("routes.algorithm.title"),
            path: "/asset/algorithm",
          },
          {
            Icon: ModelIcon,
            text: t("routes.model.title"),
            path: "/asset/model",
          },
        ],
      },
      // 无可用集群时不显示该层级路由
      ...(currentClusters.length > 0 ? [{
        Icon: DevelopAndTrainIcon,
        text: t("routes.developTrain"),
        path: "/jobs",
        clickToPath: "/jobs/createApp",
        children: [
          {
            Icon: AppIcon,
            text: t("routes.job.createApp"),
            path: "/jobs/createApp",
          },
          {
            Icon: TrainJobIcon,
            text: t("routes.job.trainJob"),
            path: "/jobs/createTrain",
          },
          ...(publicConfig.INFER_ENABLED ? [{
            Icon: InferIcon,
            text: t("routes.job.infer"),
            path: "/jobs/createInfer",
          }] : []),
          ...devHostEnabled ? [{
            Icon: ViewDevHostIcon,
            text: t("routes.job.devHost"),
            path: "/jobs/devList",
          }] : [],
          {
            Icon: jobIcon,
            text: t("routes.job.title"),
            path: "/jobs/jobList",
          },
        ],
      }] : []),
      ...(currentClusters.length > 0 ? [
        {
          Icon: FileIcon,
          text: t("routes.file"),
          path: "/files",
          clickToPath: "/files/~",
          children: [
            {
              Icon: FileIcon,
              text: t("routes.file"),
              path: "/files/~",
              match: (spec: string, path: string) => {
                return /(^|\/)files(\/|$)/.test(path);
              },
            },
          ],
        },
      ] : []),
      ...(publicConfig.NAV_LINKS && publicConfig.NAV_LINKS.length > 0
        ? publicConfig.NAV_LINKS.map((link) => {

          const parentNavPath = link.url ? `${link.url}?token=${user.token}`
            : link.children?.length && link.children?.length > 0
              ? `${link.children[0].url}?token=${user.token}` : "";

          return {
            Icon: !link.iconPath ? DefaultNavLinkIcon : (
              <NavIcon
                src={join(publicConfig.PUBLIC_PATH, link.iconPath)}
              />
            ),
            text: link.text,
            path: parentNavPath,
            clickToPath: parentNavPath,
            clickable: true,
            openInNewPage: link.openInNewPage,
            children: link.children?.length ? link.children?.map((childLink: Omit<NavLink, "children" | "url"> & {
              url: string;
            }) => ({
              Icon: !childLink.iconPath ? DefaultNavLinkIcon : (
                <NavIcon
                  src={join(publicConfig.PUBLIC_PATH, childLink.iconPath)}
                />
              ),
              text: childLink.text,
              path: `${childLink.url}?token=${user.token}`,
              clickToPath: `${childLink.url}?token=${user.token}`,
              clickable: true,
              openInNewPage: childLink.openInNewPage,
            } as NavItemProps)) : [],
          } as NavItemProps;
        }) : []),
    ];
  };
