import {
  AppstoreOutlined,
  CloudServerOutlined,
  ExperimentOutlined,
} from "@ant-design/icons";
import type { ModuleDefinition } from "src/shared/module";

export const sidebarModuleDefinitions: ModuleDefinition[] = [
  {
    id: "portal",
    path: "/portal",
    title: (translate) => translate("portal:baseLayout.linkTextHpc", "超算平台"),
    icon: <CloudServerOutlined />,
    children: [
      { path: "jobs", title: (translate) => translate("portal:routes.job.title", "作业") },
      { path: "apps", title: (translate) => translate("portal:routes.apps.title", "应用") },
    ],
  },
  {
    id: "ai",
    path: "/ai",
    title: (translate) => translate("ai:baseLayout.linkTextAi", "智算平台"),
    icon: <AppstoreOutlined />,
    children: [
      { path: "jobs", title: (translate) => translate("ai:routes.job.title", "作业") },
      { path: "assets", title: (translate) => translate("ai:routes.asset", "数据资产") },
    ],
  },
  {
    id: "quantum",
    path: "/quantum",
    title: (translate) => translate("quantum:route.linkTextQuantum", "量子云"),
    icon: <ExperimentOutlined />,
    children: [
      { path: "dashboard", title: (translate) => translate("quantum:route.dashboard", "仪表盘") },
      { path: "jobs", title: (translate) => translate("quantum:route.quantum.root", "量子作业") },
      { path: "devices", title: (translate) => translate("quantum:route.devices", "运行设备") },
    ],
  },
];

export const notificationModuleDefinition: ModuleDefinition = {
  id: "notification",
  path: "/notification",
  title: (translate) => translate("notification:api.notification", "通知"),
  icon: null,
  children: [
    { path: "messages", title: (translate) => translate("notification:api.myMsgs", "我的消息") },
    { path: "subscriptions", title: (translate) => translate("notification:api.msgSub", "消息接收设置") },
    { path: "admin", title: (translate) => translate("notification:api.msgConfig", "消息发送设置") },
  ],
};

export const routeModuleDefinitions = sidebarModuleDefinitions;
