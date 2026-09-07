import { createCache, extractStyle, StyleProvider } from "@ant-design/cssinjs/lib";
import Document, { Head, Html, Main, NextScript } from "next/document";
import { publicConfig } from "src/utils/config";
import { ServerStyleSheet } from "styled-components";

const serializePublicConfig = () =>
  JSON.stringify(publicConfig)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const sheet = new ServerStyleSheet();
    const originalRenderPage = ctx.renderPage;

    const antdCache = createCache();

    try {
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => (props) =>
            sheet.collectStyles(
              <StyleProvider cache={antdCache}>
                <App {...props} />
              </StyleProvider>,
            ),
        });

      const initialProps = await Document.getInitialProps(ctx);
      // Generate the css string for the styles coming from jss
      const antdCss = extractStyle(antdCache);
      return {
        ...initialProps,
        styles: [
          initialProps.styles,
          sheet.getStyleElement(),
          <style key="antd" dangerouslySetInnerHTML={{ __html: antdCss }} />,
        ],
      };
    } finally {
      sheet.seal();
    }
  }

  render() {
    return (
      <Html>
        <Head />
        <body>
          <script
            id="__SCOW_RUNTIME_CONFIG__"
            dangerouslySetInnerHTML={{
              __html: `globalThis.__SCOW_RUNTIME_CONFIG__ = { serverRuntimeConfig: {}, publicRuntimeConfig: ${serializePublicConfig()} };`,
            }}
          />
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
