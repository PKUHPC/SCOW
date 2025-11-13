import { NavItemProps } from "@scow/lib-web/build/layouts/base/types";
import { useI18nTranslateToString } from "src/i18n";
import { DashboardIcon, DeviceIcon, HelpIcon, JupyterIcon, QuantumJobIcon } from "src/icons/headerIcons/headerIcons";

export const useRoutes = (): NavItemProps[] => {

  const t = useI18nTranslateToString();

  return [
    {
      Icon: DashboardIcon,
      path: "/dashboard",
      text: t("route.dashboard"),
    },
    {
      Icon: DeviceIcon,
      path: "/devices",
      text: t("route.devices"),
    },
    {
      Icon: JupyterIcon,
      path: "/jupyter",
      text: t("route.jupyter.root"),
      clickToPath: "/jupyter/list",
      children: [
        // {
        //   Icon: PlusOutlined,
        //   path: "/jupyter/create",
        //   text: t("route.jupyter.create"),
        // },
        {
          Icon: JupyterIcon,
          text: t("route.jupyter.list"),
          path: "/jupyter/list",
        },
      ],
    },
    {
      Icon: QuantumJobIcon,
      path: "/quantum",
      text: t("route.quantum.root"),
      clickToPath: "/quantum/list",
      children: [
        {
          Icon: QuantumJobIcon,
          text: t("route.quantum.list"),
          path: "/quantum/list",
        },
      ],
    },
    {
      Icon: HelpIcon,
      path: "/help",
      text: t("route.help.root"),
    },
  ];
};
