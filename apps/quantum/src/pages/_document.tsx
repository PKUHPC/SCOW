import { createCache, extractStyle, StyleProvider } from "@ant-design/cssinjs/lib";
import Document, { DocumentContext } from "next/document";
import { ServerStyleSheet } from "styled-components";


export default class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
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
}
