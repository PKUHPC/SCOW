import { BookOutlined, DashboardOutlined, ProductOutlined, QuestionOutlined } from "@ant-design/icons";
import { QuantumIcon } from "@scow/lib-web/build/layouts/base/header/icons";
import { NavItemProps } from "@scow/lib-web/build/layouts/base/types";
import { useI18nTranslateToString } from "src/i18n";
import { JupyterIcon } from "src/icons/headerIcons/headerIcons";

export const useRoutes = (basePath: string, portalUrl: string): NavItemProps[] => {

  const t = useI18nTranslateToString();

  return [
    {
      Icon: DashboardOutlined,
      path: "/dashboard",
      text: t("route.dashboard"),
    },
    {
      Icon: ProductOutlined,
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
          Icon: BookOutlined,
          text: t("route.jupyter.list"),
          path: "/jupyter/list",
        },
      ],
    },
    {
      Icon:QuantumIcon,
      path: "/quantum",
      text: t("route.quantum.root"),
      clickToPath: "/quantum/list",
      children: [
        {
          Icon: BookOutlined,
          text: t("route.quantum.list"),
          path: "/quantum/list",
        },
      ],
    },
    {
      Icon: QuestionOutlined,
      path: "/help",
      text: t("route.help.root"),
    },
  ];
};
