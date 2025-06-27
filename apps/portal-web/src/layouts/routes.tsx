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

import { LinkOutlined } from "@ant-design/icons";
import { NavItemProps } from "@scow/lib-web/build/layouts/base/types";
import { NavIcon } from "@scow/lib-web/build/layouts/icon";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { join } from "path";
import { useI18n, useI18nTranslateToString } from "src/i18n";
import { AllJobsIcon, ApplicationIcon
  , AppSessionsIcon, ClusterFileManagerIcon
  , CreateAppIcon, DashBoardIcon, DesktopIcon
  , FileManagerIcon, FileTransferIcon, FileTransferInfoIcon,JobIcon, RunningJobsIcon
  , ShellClusterIcon, ShellIcon, ShellLoginIcon,
  SubmitJobIcon, TemplateJobIcon } from "src/icons/headerIcons/headerIcons";
import { User } from "src/stores/UserStore";
import { Cluster, LoginNode } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";

export const userRoutes: (
  user: User | undefined,
  currentClusters: Cluster[],
  defaultCluster: Cluster | undefined,
  loginNodes: Record<string, LoginNode[]>,
  enableLoginDesktop: boolean,
  crossClusterFileTransferEnabled: boolean,
  setDefaultCluster: (cluster: Cluster | undefined) => void,
) => NavItemProps[] = (
  user, currentClusters, defaultCluster, loginNodes,
  enableLoginDesktop, crossClusterFileTransfer, setDefaultCluster) => {

  if (!user) { return []; }
  const t = useI18nTranslateToString();

  const languageId = useI18n().currentLanguage.id;

  return [
    {
      Icon: DashBoardIcon,
      text: t("routes.dashboard"),
      path: "/dashboard",
    },
    ...(publicConfig.ENABLE_JOB_MANAGEMENT ? [{
      Icon: JobIcon,
      text: t("routes.job.title"),
      path: "/jobs",
      clickToPath: "/jobs/runningJobs",
      children: [
        {
          Icon: RunningJobsIcon,
          text: t("routes.job.runningJobs"),
          path: "/jobs/runningJobs",
        },
        {
          Icon: AllJobsIcon,
          text: t("routes.job.allJobs"),
          path: "/jobs/allJobs",
        },
        {
          Icon: SubmitJobIcon,
          text: t("routes.job.submitJob"),
          path: "/jobs/submit",
        },
        {
          Icon: TemplateJobIcon,
          text: t("routes.job.jobTemplates"),
          path: "/jobs/savedJobs",
        },
      ],
    }] : []),
    ...(publicConfig.ENABLE_SHELL && currentClusters.length > 0 ?
      [{
        Icon: ShellIcon,
        text: "Shell",
        path: "/shell",
        clickToPath:
        join(publicConfig.BASE_PATH,
          "shell",
          defaultCluster?.id ?? currentClusters[0].id,
          loginNodes[defaultCluster?.id ?? currentClusters[0].id]?.[0]?.address),
        openInNewPage: true,
        clickable: true,
        children: currentClusters.map(({ name, id }) => ({
          openInNewPage: true,
          Icon: ShellClusterIcon,
          text: getI18nConfigCurrentText(name, languageId),
          path: `/shell/${id}`,
          clickToPath: join(publicConfig.BASE_PATH, "shell", id, loginNodes[id]?.[0]?.address),
          handleClick: () => { setDefaultCluster({ name, id }); },
          children: loginNodes[id]?.map((loginNode) => ({
            openInNewPage: true,
            Icon: ShellLoginIcon,
            text: loginNode.name,
            path: `/shell/${id}/${loginNode.address}`,
            handleClick: () => { setDefaultCluster({ name, id }); },
          })),
        } as NavItemProps)),
      } as NavItemProps] : []),
    ...(enableLoginDesktop && currentClusters.length > 0 ? [{
      Icon: DesktopIcon,
      text: t("routes.desktop"),
      path: "/desktop",
    }] : []),
    ...(publicConfig.ENABLE_APPS && currentClusters.length > 0 ? [{
      Icon: ApplicationIcon,
      text: t("routes.apps.title"),
      path: "/apps",
      clickToPath: `/apps/${defaultCluster?.id ?? currentClusters[0].id}/sessions`,
      clickable: true,
      children: currentClusters.map((cluster) => ({
        Icon: ApplicationIcon,
        text: getI18nConfigCurrentText(cluster.name, languageId),
        path: `/apps/${cluster.id}`,
        clickToPath: `/apps/${cluster.id}/sessions`,
        handleClick: () => { setDefaultCluster(cluster); },
        children: [
          {
            Icon: AppSessionsIcon,
            text: t("routes.apps.appSessions"),
            path: `/apps/${cluster.id}/sessions`,
            handleClick: () => { setDefaultCluster(cluster); },
          },
          {
            Icon: CreateAppIcon,
            text: t("routes.apps.createApp"),
            clickable: false,
            path: `/apps/${cluster.id}/createApps`,
            handleClick: () => { setDefaultCluster(cluster); },
          },
        ],
      } as NavItemProps)),
    } as NavItemProps] : []),
    ...(currentClusters.length > 0 ? [{
      Icon: FileManagerIcon,
      text: t("routes.file.fileManager"),
      path: "/files",
      clickToPath: `/files/${defaultCluster?.id ?? currentClusters[0].id}/~`,
      clickable: true,
      children: [
        {
          Icon: ClusterFileManagerIcon,
          text: t("routes.file.fileManager"),
          path: "/files/",
          clickToPath: `/files/${defaultCluster?.id ?? currentClusters[0].id}/~`,
        },
        ...(crossClusterFileTransfer ? [
          {
            Icon: FileTransferIcon,
            text: t("routes.file.crossClusterFileTransfer"),
            path: "/files/fileTransfer",
          },
          {
            Icon: FileTransferInfoIcon,
            text: t("routes.file.transferProgress"),
            path: "/files/currentTransferInfo",
          },
        ] : []),
      ]},
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
          clickable: link.clickable,
          openInNewPage: link.openInNewPage,
          children: link.children?.length ? link.children?.map((childLink) => ({
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

