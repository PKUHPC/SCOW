import { DefaultNavLinkIcon } from "@scow/lib-web/build/layouts/base/header/icons";
import { NavItemProps } from "@scow/lib-web/build/layouts/base/types";
import { NavIcon } from "@scow/lib-web/build/layouts/icon";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { join } from "path";
import { useI18n, useI18nTranslateToString } from "src/i18n";
import { AllJobsIcon, ApplicationIcon, AppSessionsIcon, ClusterFileManagerIcon
  , CreateAppIcon, DashBoardIcon, FileManagerIcon,
  FileTransferIcon, FileTransferInfoIcon,JobIcon, LoginClusterIcon,
  RunningJobsIcon, SubmitJobIcon, TemplateJobIcon } from "src/icons/headerIcons/headerIcons";
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
    ...((publicConfig.ENABLE_SHELL || enableLoginDesktop) && currentClusters.length > 0 ?
      [{
        Icon: LoginClusterIcon,
        text: t("routes.loginCluster"),
        path: "/loginCluster",
      } as NavItemProps] : []),
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
          Icon: !link.iconPath ? DefaultNavLinkIcon : (
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
