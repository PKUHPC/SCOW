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
    compiler: {
      styledComponents: true,
    },
    skipTrailingSlashRedirect: true,
    transpilePackages: ["antd", "@ant-design/icons"],
  };

  return withPlugins(
    [analyze ? [require("@next/bundle-analyzer")()] : undefined].filter((x) => x),
    config,
  )(phase, { defaultConfig: {} });
};
