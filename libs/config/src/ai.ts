import { GetConfigFn, getConfigFromFile } from "@scow/lib-config";
import { Static, Type } from "@sinclair/typebox";
import { DEFAULT_CONFIG_BASE_PATH } from "src/constants";

export const AiConfigSchema = Type.Object({
  db: Type.Object({
    host: Type.String({ description: "数据库地址" }),
    port: Type.Integer({ description: "数据库端口" }),
    user: Type.String({ description: "数据库用户名" }),
    password: Type.Optional(Type.String({ description: "数据库密码" })),
    dbName: Type.String({ description: "数据库数据库名" }),
    debug: Type.Boolean({ description: "打开ORM的debug模式", default: false }),
  }),
  appJobsDir: Type.String({
    description: "将交互式任务的信息保存到什么位置。相对于用户的家目录",
    default: "scow/ai/appData",
  }),

  asset: Type.Optional(
    Type.Object(
      {
        userShare: Type.Optional(
          Type.Object(
            {
              enabled: Type.Boolean({ description: "是否开启用户分享数据资产功能", default: false }),
            },
            { default: {}, description: "用户分享数据资产功能配置" },
          ),
        ),
      },
      { default: {}, description: "数据资产相关配置" },
    ),
  ),

  navLinks: Type.Optional(
    Type.Array(
      Type.Object({
        text: Type.String({ description: "一级导航名称" }),
        url: Type.Optional(Type.String({ description: "一级导航链接" })),
        openInNewPage: Type.Optional(Type.Boolean({ description: "一级导航是否默认在新页面打开", default: false })),
        iconPath: Type.Optional(Type.String({ description: "一级导航链接显示图标路径" })),
        children: Type.Optional(
          Type.Array(
            Type.Object({
              text: Type.String({ description: "二级导航名称" }),
              url: Type.String({ description: "二级导航链接" }),
              openInNewPage: Type.Optional(
                Type.Boolean({ description: "二级导航是否默认在新页面打开", default: false }),
              ),
              iconPath: Type.Optional(Type.String({ description: "二级导航链接显示图标路径" })),
            }),
          ),
        ),
      }),
    ),
  ),

  harborConfig: Type.Object({
    url: Type.String({ description: "镜像存储用的Harbor仓库地址" }),
    project: Type.String({ description: "镜像存储用的Harbor仓库地址下项目名,会作为镜像存储的上级路径" }),
    user: Type.String({ description: "Harbor仓库地址登录时使用的用户名" }),
    password: Type.String({ description: "Harbor仓库地址登录时使用的登录密码" }),
    protocol: Type.String({ description: "Harbor API 的访问协议", default: "http" }),
  }),

  publicMountPoints: Type.Optional(
    Type.Array(Type.String({ description: "公共挂载点" }), {
      description: "公共挂载点数组，全部会被挂载进AI应用和训练",
    }),
  ),

  file: Type.Optional(
    Type.Object(
      {
        preview: Type.Object(
          {
            limitSize: Type.String({ description: "文件预览大小限制", default: "50m" }),
          },
          { description: "文件预览功能", default: {} },
        ),
        edit: Type.Object(
          {
            limitSize: Type.String({ description: "文件编辑大小限制", default: "1m" }),
            nonEditableFilenamePostfixes: Type.Optional(
              Type.Array(Type.String({ description: "不可编辑文件后缀" }), { default: [] }),
            ),
          },
          { description: "文件编辑功能", default: {} },
        ),
      },
      { description: "文件管理" },
    ),
  ),

  uiExtension: Type.Optional(
    Type.Union([
      Type.Object({ url: Type.String({ description: "扩展的URL" }) }),
      Type.Array(
        Type.Object({
          name: Type.String({ description: "UI扩展名" }),
          url: Type.String({ description: "扩展的URL" }),
        }),
      ),
    ]),
  ),

  inferConfig: Type.Optional(
    Type.Object({
      enabled: Type.Boolean({ description: "AI是否开启推理模块", default: true }),
      proxyHost: Type.Optional(Type.String({ description: "推理服务代理地址，可选配置，不配置时用scow节点地址转发" })),
    }),
  ),

  imageCleanup: Type.Optional(
    Type.Object({
      enabled: Type.Boolean({ description: "是否开启定期清理定期删除harbor里不存在的镜像", default: true }),
      // 周期：默认每1小时（每小时0点）
      cron: Type.String({ description: "删除消息的周期的cron表达式", default: "0 * * * *" }),
    }),
  ),
});

const AT_CONFIG_NAME = "ai/config";

export type AiConfigSchema = Static<typeof AiConfigSchema>;

export type HarborConfig = AiConfigSchema["harborConfig"];

export const getAiConfig: GetConfigFn<AiConfigSchema> = (baseConfigPath) => {
  const config = getConfigFromFile(AiConfigSchema, AT_CONFIG_NAME, baseConfigPath ?? DEFAULT_CONFIG_BASE_PATH);

  return config;
};
