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

      fetch(url)
        .then(async (res) => {
          console.log("Call completed. Response: ", await res.text());
        })
        .catch((e) => {
          console.error("Error when calling proxy url to initialize ws proxy server", e);
        });
    });
  }

  /** @type {import('next').NextConfig} */
  const nextConfig = {
    compiler: {
      styledComponents: true,
    },
    basePath: BASE_PATH === "/" ? undefined : BASE_PATH,
    assetPrefix: BASE_PATH === "/" ? undefined : BASE_PATH,
    skipTrailingSlashRedirect: true,
    transpilePackages: ["antd", "@ant-design/icons"],
  };

  return nextConfig;
};
