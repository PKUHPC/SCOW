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

// @ts-check

const withPlugins = require("next-compose-plugins");

const analyze = process.env.ANALYZE === "true";

const { buildRuntimeConfig } = require("./config.js");

const BASE_PATH = process.env.BASE_PATH || "/";


module.exports = async (phase) => {

  global.__CONFIG__ = {
    BASE_PATH,
  };

  const runtimeConfig = await buildRuntimeConfig(phase, BASE_PATH);

  /**
   * @type {import("next").NextConfig}
   */
  const config = {
    ...runtimeConfig,
    basePath: BASE_PATH === "/" ? undefined : BASE_PATH,
    assetPrefix: BASE_PATH === "/" ? undefined : BASE_PATH,
    webpack(config, options) {
      config.plugins.forEach((i) => {
        if (i instanceof options.webpack.DefinePlugin) {
          if (i.definitions["process.env.__NEXT_ROUTER_BASEPATH"]) {
            i.definitions["process.env.__NEXT_ROUTER_BASEPATH"] =
              "(typeof window === \"undefined\" ? global : window).__CONFIG__?.BASE_PATH";
          }
        }
      });

      // // 添加SVG处理规则
      // config.module.rules.push({
      //   test: /\.svg$/,
      //   use: [
      //     {
      //       loader: "@svgr/webpack",
      //       options: {
      //         icon: true,
      //       },
      //     },
      //   ],
      // });

      return config;
    },
    skipTrailingSlashRedirect: true,
    transpilePackages: ["antd", "@ant-design/icons"],
  };

  return withPlugins([
    analyze ? [require("@next/bundle-analyzer")()] : undefined,
  ].filter((x) => x), config)(phase, { defaultConfig: {} });
};

