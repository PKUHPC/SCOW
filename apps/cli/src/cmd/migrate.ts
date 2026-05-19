import { spawnSync } from "child_process";
import { writeFileSync } from "fs";
import { dump } from "js-yaml";
import { dirname } from "path";
import { InstallConfigSchema } from "src/config/install";
import { logger } from "src/log";

interface Props {
  configPyPath: string;
}

function executePython(pythonScript: string, cwd: string) {
  const rep = spawnSync("python3", ["-c", pythonScript], { encoding: "utf-8", cwd });
  if (rep.error) {
    throw rep.error;
  }
  return rep.stdout;
}

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export const migrateFromScowDeployment = (options: Props) => {
  const cwd = dirname(options.configPyPath);

  // 1. get config keys
  const keysOutput = executePython("import config, json; print(json.dumps(dir(config)))", cwd);
  const keys = (JSON.parse(keysOutput) as string[]).filter((x) => !x.startsWith("__"));

  function getSectionContent(key: string) {
    if (!keys.includes(key)) {
      return undefined;
    }
    return JSON.parse(executePython(`import config, json; print(json.dumps(config.${key}))`, cwd));
  }

  // 2. parse each section
  const common = getSectionContent("COMMON");
  const log = getSectionContent("LOG");
  const fluentd = getSectionContent("FLUENTD");
  const portal = getSectionContent("PORTAL");
  const mis = getSectionContent("MIS");
  const auth = getSectionContent("AUTH");
  const debug = getSectionContent("DEBUG");
  const gateway = getSectionContent("GATEWAY");
  const ai = getSectionContent("AI");

  const config: DeepPartial<InstallConfigSchema> = {
    port: common.PORT,
    basePath: common.BASE_PATH,
    imageTag: common.IMAGE_TAG,

    gateway: gateway
      ? {
          uploadFileSizeLimit: gateway.UPLOAD_FILE_SIZE_LIMIT,
        }
      : undefined,

    portal: portal
      ? {
          basePath: portal.BASE_PATH,
          novncClientImage: portal.NOVNC_IMAGE,
          portMappings: {
            ...(debug?.OPEN_PORTS?.PORTAL_SERVER ? { portalServer: debug.OPEN_PORTS.PORTAL_SERVER } : {}),
          },
        }
      : undefined,

    mis: mis
      ? {
          basePath: mis.BASE_PATH,
          dbPassword: mis.DB_PASSWORD,
          portMappings: {
            ...(debug?.OPEN_PORTS?.MIS_SERVER ? { misServer: debug.OPEN_PORTS.MIS_SERVER } : {}),
            ...(debug?.OPEN_PORTS?.DB ? { db: debug.OPEN_PORTS.DB } : {}),
          },
        }
      : undefined,

    log:
      log || fluentd
        ? {
            level: log?.LEVEL,
            pretty: log?.PRETTY,
            fluentd: fluentd
              ? {
                  logDir: fluentd.LOG_DIR,
                }
              : undefined,
          }
        : undefined,

    auth: {
      portMappings: {
        ...(debug?.OPEN_PORTS?.REDIS ? { redis: debug.OPEN_PORTS.REDIS } : {}),
        ...(debug?.OPEN_PORTS?.AUTH ? { auth: debug.OPEN_PORTS.AUTH } : {}),
      },
      ...(auth
        ? {
            custom: {
              image: auth.IMAGE,
              ports: auth.PORTS,
              volumes: auth.VOLUMES,
              environment: auth.ENV,
            },
          }
        : {}),
    },

    ai: ai
      ? {
          basePath: ai.BASE_PATH,
          dbPassword: ai.DB_PASSWORD,
          portMappings: {
            ...(debug?.OPEN_PORTS?.AI ? { aiServer: debug.OPEN_PORTS.AI } : {}),
            ...(debug?.OPEN_PORTS?.DB ? { db: debug.OPEN_PORTS.DB } : {}),
          },
        }
      : undefined,
  };

  const data = dump(config);

  writeFileSync("install.yaml", data);

  logger.info("install.yaml is created based on config.py. Migration completed.");
};
