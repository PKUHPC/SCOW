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

import { getConfig } from "@scow/lib-config/build/fileConfig";
import { Static, Type } from "@sinclair/typebox";
import { join } from "path";
import { logger } from "src/log";

export enum AuthCustomType {
  external = "external",
  image = "image",
}

export const InstallConfigSchema = Type.Object({
  port: Type.Integer({ description: "端口号", default: 80 }),
  basePath: Type.String({ description: "整个系统的部署路径", default: "/" }),
  image: Type.Optional(Type.String({ description: "镜像", default: "mirrors.pku.edu.cn/pkuhpc-icode/scow" })),
  imageTag: Type.String({ description: "镜像tag", default: "master" }),

  scowd: Type.Optional(Type.Object({
    ssl: Type.Optional(Type.Object({
      enabled: Type.Boolean({ description: "到 SCOWD 的连接是否启动SSL", default: false }),
      caCertPath: Type.String({ description: "SCOWD CA根证书路径, 相对 config 的默认目录", default: "./scowd/certs/ca.crt" }),
      scowCertPath: Type.String({
        description: "SCOWD CA签名的 SCOW 证书路径， 相对 config 的默认目录",
        default: "./scowd/certs/scow.crt",
      }),
      scowPrivateKeyPath: Type.String({
        description: "SCOWD CA签名的 SCOW 私钥路径， 相对 config 的默认目录",
        default: "./scowd/certs/scow.key",
      }),
    }, { description: "scowd  全局 ssl 相关配置" })),
  }, { description: "全局 scowd 相关配置" })),

  adapter: Type.Optional(Type.Object({
    ssl: Type.Optional(Type.Object({
      enabled: Type.Boolean({ description: "到适配器的连接是否启动SSL", default: false }),
      caCertPath: Type.String({ description: "适配器 CA根证书路径, 相对 config 的默认目录", default: "./adapter/certs/ca.crt" }),
      scowCertPath: Type.String({
        description: "适配器 CA签名的 SCOW 证书路径， 相对 config 的默认目录",
        default: "./adapter/certs/scow.crt",
      }),
      scowPrivateKeyPath: Type.String({
        description: "适配器 CA签名的 SCOW 私钥路径， 相对 config 的默认目录",
        default: "./adapter/certs/scow.key",
      }),
    }, { description: "适配器 ssl 相关配置" })),
  }, { description: "适配器相关配置" })),

  log: Type.Object({
    level: Type.String({ description: "日志级别", default: "info" }),
    pretty: Type.Boolean({ description: "日志格式", default: false }),
    fluentd: Type.Optional(Type.Object({
      image: Type.String({ description: "fluentd镜像", default: "fluentd:v1.14.0-1.0" }),
      logDir: Type.String({ description: "日志目录", default: "/var/log/fluentd" }),
    })),
  }, { default: {} }),

  gateway: Type.Object({
    protocol: Type.String({
      description: "scow 的访问协议，将影响 callbackUrl 的 protocol",
      default: "http",
    }),

    uploadFileSizeLimit: Type.String({
      description: "限制整个系统上传（请求）文件的大小，可接受的格式为nginx的client_max_body_size可接受的值",
      default: "1G",
    }),

    proxyReadTimeout: Type.String({
      description: "限制后端服务发出响应的超时时间，可接受的格式为nginx的proxy_read_timeout可接受的值",
      default: "60s",
    }),

    extra: Type.String({
      description: "更多nginx配置，可接受的格式为nginx的server可接受的属性配置，可增加在当前系统nginx端口（默认80）的服务等",
      default: "",
    }),

    allowedServerName: Type.String({
      description: "允许访问的域名或 IP",
      default: "_",
    }),
  }, { default: {} }),

  portal: Type.Optional(Type.Object({
    basePath: Type.String({ description: "门户系统的部署路径，相对于整个系统的basePath", default: "/" }),
    novncClientImage: Type.String({ description: "novnc客户端镜像", default: "ghcr.io/pkuhpc/novnc-client-docker:master" }),

    portMappings: Type.Optional(Type.Object({
      portalServer: Type.Optional(Type.Union([Type.String(), Type.Integer()], {
        description: "portal-server映射出来的端口",
      })),
    })),

  }, { description: "门户系统部署选项，如果不设置，则不部署门户系统" })),

  mis: Type.Optional(Type.Object({
    mysqlImage: Type.String({ description: "管理系统数据库镜像", default: "mysql:8" }),
    basePath: Type.String({ description: "管理系统的部署路径，相对于整个系统的", default: "/mis" }),
    dbPassword: Type.String({ description: "管理系统数据库密码", default: "must!chang3this" }),

    portMappings: Type.Optional(Type.Object({
      db: Type.Optional(Type.Union([Type.String(), Type.Integer()], { description: "数据库映射出来的端口" })),
      misServer: Type.Optional(Type.Union([Type.String(), Type.Integer()], {
        description: "mis-server映射出来的端口",
      })),
    })),
  })),

  auth: Type.Object({

    redisImage: Type.String({ description: "认证系统redis镜像", default: "redis:alpine" }),

    portMappings: Type.Optional(Type.Object({
      redis: Type.Optional(Type.Union([Type.String(), Type.Integer()], { description: "redis服务映射出来的端口" })),
      auth: Type.Optional(Type.Union([Type.String(), Type.Integer()], {
        description: "自带认证系统映射出来的端口，对自定义认证系统无效",
      })),
    })),

    custom: Type.Optional(Type.Object({
      type: Type.Optional(Type.Enum(AuthCustomType, { description: "自定义认证系统类型" })),
      external: Type.Optional(Type.Object({
        url: Type.String({ description: "认证系统的 URL" }),
      })),
      image: Type.Optional(Type.Union([
        Type.Object({
          imageName: Type.String({ description: "认证系统镜像名" }),
          ports: Type.Optional(Type.Array(Type.String(), { description: "端口映射" })),
          volumes: Type.Optional(Type.Array(Type.String(), {
            description: "更多挂载卷。默认添加/etc/hosts:/etc/hosts和./config:/etc/scow",
          })),
        }, { description: "认证系统镜像" }),
        Type.String({ description: "兼容旧版本认证系统镜像名配置" }),
      ], { description: "自定义认证系统镜像配置" })),
      ports: Type.Optional(Type.Array(Type.String(), { description: "兼容旧版本端口映射配置" })),
      volumes: Type.Optional(Type.Array(Type.String(), {
        description: "兼容旧版本，更多挂载卷。默认添加/etc/hosts:/etc/hosts和./config:/etc/scow",
      })),
      environment: Type.Optional(Type.Union([
        Type.Array(Type.String({ description: "格式：变量名=变量值" })),
        Type.Record(Type.String(), Type.String(), { description: "格式：字符串: 字符串" }),
      ], { description: "环境变量配置" })),
    }, { description: "自定义认证系统配置" })),
  }, { default: {} }),

  plugins: Type.Object({
    enabledPlugins: Type.Optional(Type.Array(Type.String(), { description: "启用的插件列表" })),
    pluginsDir: Type.String({ description: "插件目录", default: "./plugins" }),
  }, { default: {} }),

  audit: Type.Optional(Type.Object({
    mysqlImage: Type.String({ description: "审计系统数据库镜像", default: "mysql:8" }),
    dbPassword: Type.String({ description: "审计系统数据库密码", default: "must!chang3this" }),

    portMappings: Type.Optional(Type.Object({
      db: Type.Optional(Type.Union([Type.String(), Type.Integer()], { description: "数据库映射出来的端口" })),
      auditServer: Type.Optional(Type.Union([Type.String(), Type.Integer()], {
        description: "audit-server映射出来的端口",
      })),
    })),
  })),

  ai: Type.Optional(Type.Object({
    basePath: Type.String({ description: "AI系统的部署路径，相对于整个系统的basePath", default: "/ai" }),
    mysqlImage: Type.String({ description: "AI系统数据库镜像", default: "mysql:8" }),
    dbPassword: Type.String({ description: "AI系统数据库密码", default: "must!chang3this" }),

    portMappings: Type.Optional(Type.Object({
      db: Type.Optional(Type.Union([Type.String(), Type.Integer()], { description: "数据库映射出来的端口" })),
    })),
  })),

  quantum: Type.Optional(Type.Object({
    basePath: Type.String({ description: "量子计算系统的部署路径，相对于整个系统的basePath", default: "/quantum" }),
    qobody: Type.Object({
      image: Type.String({ description: "qobody镜像", default: "ccrepo.pku.edu.cn/scow/qobody" }),
      token: Type.String({ description: "云平台的token" }),
    }, { description: "量子计算系统的qobody配置" }),
  })),

  resource: Type.Optional(Type.Object({
    basePath: Type.String({ description: "资源管理系统的部署路径，相对于整个系统的basePath", default: "/resource" }),
  })),
  notification: Type.Optional(Type.Object({
    basePath: Type.String({ description: "消息系统的部署路径，相对于整个系统的basePath", default: "/notification" }),
  })),

  misc: Type.Optional(Type.Object({
    nodeOptions:  Type.Optional(Type.String({ description: "传递给node服务的参数" })),
  }, { description: "多个不好分类的配置参数参数" })),

}, { description: "审计系统部署选项，如果不设置，则不部署审计系统" });

export type InstallConfigSchema = Static<typeof InstallConfigSchema>;

export function getInstallConfig(filePath: string) {
  const fullPath = join(process.cwd(), filePath);

  logger.debug("Using install config %s", fullPath);

  return getConfig(InstallConfigSchema, fullPath);
}
