import { bool, host, num, port, regex, str, url, Validator } from "@scow/config";
import dotenv from "dotenv";
import fs from "fs";
import os from "os";
import path, { join, resolve } from "path";

process.env.NODE_ENV = "development";

const docNames = {
  [str.name]: "字符串",
  [host.name]: "主机名",
  [port.name]: "端口号",
  [url.name]: "URL",
  [num.name]: "数字",
  [bool.name]: "布尔值",
  [regex.name]: "正则表达式",
};

export function getDocFromSpec(spec: Record<string, Validator<any>>) {
  let docs = `
| 名字 | 类型 | 描述 | 默认值 |
| -- | -- | -- | -- |
`;

  Object.entries(spec).forEach(([key, [func, spec]]) => {
    docs += "|";
    docs += [
      `\`${key}\``,
      docNames[func.name],
      // @ts-ignore

      // eslint-disable-next-line @stylistic/max-len
      `${spec.desc ? spec.desc.replaceAll("\n", "<br/>") : ""}${spec.choices ? "<br/>可选项：" + spec.choices.join(",") : ""}${spec.example ? "<br/>示例：" + spec.example : ""}`,
      "default" in spec
        ? spec.default === undefined
          ? "不设置"
          : typeof spec.default === "string"
            ? spec.default.replace(os.homedir(), "~")
            : spec.default
        : "**必填**",
    ].join("|");
    docs += "|\n";
  });

  return docs;
}

export function genConfigTable(pack: string, configFile = "src/config/env") {
  const appPath = resolve(join("../apps", pack));
  dotenv.config({ path: join(appPath, "env/.env.dev") });

  const { config } = require(join(appPath, configFile));

  const docs = getDocFromSpec(config._specs);

  return docs;
}

interface EnvConfig {
  app: string;
  configFile?: string;
  md: string;
}

const config = [
  { app: "auth", md: "refs/env/auth.md" },
  { app: "mis-server", md: "refs/env/mis-server.md" },
  { app: "mis-web", configFile: "config", md: "refs/env/mis-web.md" },
  { app: "portal-web", configFile: "config", md: "refs/env/portal-web.md" },
] as EnvConfig[];

const TABLE_START = "<!-- ENV TABLE START -->";
const TABLE_END = "<!-- ENV TABLE END -->";

for (const { app, configFile, md } of config) {
  const mdPath = path.join("docs", md);

  console.log(`Writing ${app} env config to ${mdPath}`);

  const docs = genConfigTable(app, configFile);

  const content = fs.readFileSync(mdPath, "utf-8");

  const beginning = content.substring(0, content.indexOf(TABLE_START) - 1);

  const ending = content.substring(content.indexOf(TABLE_END) + TABLE_END.length + 1);

  const newContent = [beginning, TABLE_START, docs, TABLE_END, ending].join("\n");

  fs.writeFileSync(mdPath, newContent, { encoding: "utf8" });
}
