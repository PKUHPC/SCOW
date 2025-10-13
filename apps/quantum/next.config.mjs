import { readVersionFile } from "@scow/utils/build/version.js";
import os from "os";
import path from "path";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "/";

export default async () => {

  global.__CONFIG__ = {
    BASE_PATH,
  }
  const building = process.env.BUILDING === "1";

  if (!building) {
    console.log("Running @scow/quantum");
    console.log("Version", readVersionFile());

    // HACK setup ws proxy
    setTimeout(() => {
      const url = `http://localhost:${process.env.PORT || 3000}${path.join(BASE_PATH, "/api/setup")}`;
      console.log("Calling setup url to initialize proxy and shell server", url);

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

    typescript: {
      tsconfigPath: "tsconfig.next.json",
    },
    experimental: {
      instrumentationHook: true,
    },
    swcMinify: false,
    basePath: BASE_PATH === "/" ? undefined : BASE_PATH,
    assetPrefix: BASE_PATH === "/" ? undefined : BASE_PATH,
    publicRuntimeConfig: {
      BASE_PATH: BASE_PATH,
    },
    webpack: (config, options) => {
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
      config.module.rules.push({
        test: /\.md$/,
        // This is the asset module.
        type: 'asset/source',
      });

      config.plugins.forEach((i) => {
        if (i instanceof options.webpack.DefinePlugin) {
          if (i.definitions["process.env.__NEXT_ROUTER_BASEPATH"]) {
            i.definitions["process.env.__NEXT_ROUTER_BASEPATH"] =
              "(typeof window === \"undefined\" ? global : window).__CONFIG__?.BASE_PATH";
          }
        }
      });
      return config;
    },
    skipTrailingSlashRedirect: true,
    transpilePackages: ["antd", "@ant-design/icons"],

  };

  console.log("nextConfig", nextConfig);

  return nextConfig;
};
