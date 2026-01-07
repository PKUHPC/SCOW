import { readVersionFile } from "@scow/utils/build/version.js";
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
    turbopack: {
      rules: {
        "*.md": {
          loaders: ["raw-loader"],
          as: "*.js",
        },
      },
    },
    basePath: BASE_PATH === "/" ? undefined : BASE_PATH,
    assetPrefix: BASE_PATH === "/" ? undefined : BASE_PATH,
    publicRuntimeConfig: {
      BASE_PATH: BASE_PATH,
    },
    skipTrailingSlashRedirect: true,
    transpilePackages: ["antd", "@ant-design/icons"],

  };

  return nextConfig;
};
