import { omitConfigSpec } from "@scow/lib-config";
import { readFileSync } from "fs";
import Handlebars from "handlebars";
import { type config } from "src/env";

export function getNginxConfig(envConfig: typeof config): string {
  const templateSrc = readFileSync("assets/nginx.conf.hbs", "utf8");
  const template = Handlebars.compile(templateSrc, { noEscape: true });
  return template(omitConfigSpec(envConfig));
}
