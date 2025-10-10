"use client";

import { LinkOutlined } from "@ant-design/icons";
import { NavIcon } from "@scow/lib-web/build/layouts/icon";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { join } from "path";
import { useI18n, useI18nTranslateToString } from "src/i18n";
import { AlgorithmIcon, ClusterIcon, CreateAppIcon, CreateDevHostIcon, DashBoardIcon,
  DatasetIcon, DevHostIcon, fileIcon, HistoryJobsIcon, ImageIcon, InferIcon, ModelIcon,
  PrivateAlgorithmIcon, PrivateDatasetIcon, PrivateImageIcon, PrivateModelIcon,
  PublicAlgorithmIcon, PublicDatasetIcon, PublicImageIcon, PublicModelIcon,
  RunningJobsIcon, TrainJobIcon, ViewDevHostIcon } from "src/icons/menuIcons";
import { NavItemProps } from "src/layouts/base/NavItemProps";
import { ClientUserInfo } from "src/server/trpc/route/auth";
import { Cluster, NavLink, PublicConfig } from "src/server/trpc/route/config";

import { ScowClusterConfigs } from "./context";

export const userRoutes: (
  user: ClientUserInfo | undefined,
  publicConfig: PublicConfig,
  clusterConfigs: ScowClusterConfigs,
  currentClusters: Cluster[],
  setDefaultCluster: (cluster: Cluster | undefined) => void,
  defaultCluster: Cluster | undefined,
) => NavItemProps[] = (user, publicConfig, clusterConfigs, currentClusters, setDefaultCluster, defaultCluster) => {

  if (!user) { return []; }

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;

  const devHostEnabled = Object.values(clusterConfigs).some((c) => c.ai.devHost.enabled);

  return [
    {
      Icon: DashBoardIcon,
      text: t("routes.dashboard"),
      path: "/dashboard",
      clickToPath: "/dashboard",
    },
    {
      Icon: DatasetIcon,
      text: t("routes.data.title"),
      path: "/dataset",
      clickToPath: "/dataset/private",
      children: [
        {
          Icon: PrivateDatasetIcon,
          text: t("routes.data.private"),
          path: "/dataset/private",
        },
        {
          Icon: PublicDatasetIcon,
          text: t("routes.data.public"),
          path: "/dataset/public",
        },
      ],
    },
    {
      Icon: ImageIcon,
      text: t("routes.image.title"),
      path: "/image",
      clickToPath: "/image/private",
      children: [
        {
          Icon: PrivateImageIcon,
          text: t("routes.image.private"),
          path: "/image/private",
        },
        {
          Icon: PublicImageIcon,
          text: t("routes.image.public"),
          path: "/image/public",
        },
      ],
    },
    // 无可用集群时不显示该层级路由
    ...(currentClusters.length > 0 ? [ {
      Icon: ClusterIcon,
      text: t("routes.job.title"),
      path: "/jobs",
      clickToPath: `/jobs/${defaultCluster?.id ?? currentClusters[0].id}/createApps`,
      children: [
        ...currentClusters.map((cluster) => ({
          Icon: ClusterIcon,
          text: getI18nConfigCurrentText(cluster.name, languageId),
          path: `/jobs/${cluster.id}`,
          clickable: false,
          children:[
            {
              Icon: CreateAppIcon,
              text: t("routes.job.createApp"),
              path: `/jobs/${cluster.id}/createApps`,
            },
            {
              Icon: TrainJobIcon,
              text: t("routes.job.trainJob"),
              path: `/jobs/${cluster.id}/trainJobs`,
            },
            ...(publicConfig.INFER_ENABLED ? [{
              Icon: InferIcon,
              text: t("routes.job.infer"),
              path: `/jobs/${cluster.id}/inference`,
            }] : []),
            {
              Icon: RunningJobsIcon,
              text: t("routes.job.unfinishedJobs"),
              path: `/jobs/${cluster.id}/runningJobs`,
            },
            {
              Icon: HistoryJobsIcon,
              text: t("routes.job.historyJobs"),
              path: `/jobs/${cluster.id}/historyJobs`,
            },
          ],
        })),
      ],
    },
    ] : []),
    {
      Icon: AlgorithmIcon,
      text: t("routes.algorithm.title"),
      path: "/algorithm",
      clickToPath: "/algorithm/private",
      children: [
        {
          Icon: PrivateAlgorithmIcon,
          text: t("routes.algorithm.private"),
          path: "/algorithm/private",
        },
        {
          Icon: PublicAlgorithmIcon,
          text: t("routes.algorithm.public"),
          path: "/algorithm/public",
        },
      ],
    },
    {
      Icon: ModelIcon,
      text: t("routes.model.title"),
      path: "/model",
      clickToPath: "/model/private",
      children: [
        {
          Icon: PrivateModelIcon,
          text: t("routes.model.private"),
          path: "/model/private",
        },
        {
          Icon: PublicModelIcon,
          text: t("routes.model.public"),
          path: "/model/public",
        },
      ],
    },
    ...(currentClusters.length > 0 ? [
      {
        Icon: fileIcon,
        text: t("routes.file"),
        path: "/files",
        clickToPath: `/files/${defaultCluster?.id ?? currentClusters[0].id}/~`,
        children: currentClusters.map((cluster) => ({
          Icon: fileIcon,
          text: getI18nConfigCurrentText(cluster.name, languageId),
          path: `/files/${cluster.id}`,
          clickToPath: `/files/${cluster.id}/~`,
          handleClick: () => { setDefaultCluster(cluster); },
        } as NavItemProps)),
      },
    ] : []),
    // 开发机路由
    ...(currentClusters.length > 0 && devHostEnabled ? [ {
      Icon: DevHostIcon,
      text: t("routes.devHost.title"),
      path: "/devHost",
      clickToPath: "/devHost/create",
      children:[
        {
          Icon: CreateDevHostIcon,
          text: t("routes.devHost.create"),
          path: "/devHost/create",
        },
        {
          Icon: ViewDevHostIcon,
          text: t("routes.devHost.list"),
          path: "/devHost/list",
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
          Icon: !link.iconPath ? LinkOutlined : (
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
            Icon: !childLink.iconPath ? LinkOutlined : (
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
