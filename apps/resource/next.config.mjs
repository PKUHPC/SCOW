const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "/";

/** @type {import('next').NextConfig} */

export default () => {
  global.__CONFIG__ = {
    BASE_PATH,
  };

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
