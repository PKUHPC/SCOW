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

import os from "os";
import { join } from "path";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "/";

const building = process.env.BUILDING === "1";

export default async () => {

  global.__CONFIG__ = {
    BASE_PATH,
  };

  if (!building) {
    // HACK setup ws proxy
    setTimeout(() => {
      const url = `http://localhost:${process.env.PORT || 3000}${join(BASE_PATH, "/api/setup")}`;
      console.log("Calling setup url to initialize proxy and job shell server", url);

      fetch(url).then(async (res) => {
        console.log("Call completed. Response: ", await res.text());
      }).catch((e) => {
        console.error("Error when calling proxy url to initialize ws proxy server", e);
      });
    });

  }

  /** @type {import('next').NextConfig} */
  const nextConfig = {
    compiler: {
      styledComponents: true,
    },
    experimental: {
      serverMinification: false,
    },
    basePath: BASE_PATH === "/" ? undefined : BASE_PATH,
    assetPrefix: BASE_PATH === "/" ? undefined : BASE_PATH,
    webpack: (config) => {
      config.resolve.extensionAlias = {
        ".js": [".ts", ".tsx", ".js"],
        ".jsx": [".ts", ".tsx", ".js"],
      };
      config.module.rules.push({
        test: /\.node$/,
        use: [
          {
            loader: "nextjs-node-loader",
            options: {
              flags: os.constants.dlopen.RTLD_NOW,
              outputPath: config.output.path,
            },
          },
        ],
      });

      // config.plugins.forEach((i) => {
      //   if (i instanceof webpack.DefinePlugin) {
      //     if (i.definitions["process.env.__NEXT_ROUTER_BASEPATH"]) {
      //       i.definitions["process.env.__NEXT_ROUTER_BASEPATH"] =
      //         "(typeof window === \"undefined\" ? global : window).__CONFIG__?.BASE_PATH";
      //     }
      //   }
      // });
      return config;
    },
    compiler: {
      styledComponents: true,
    },
    skipTrailingSlashRedirect: true,
    transpilePackages: ["antd", "@ant-design/icons"],
  };

  return nextConfig;
};
