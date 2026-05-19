import "nprogress/nprogress.css";
import "antd/dist/reset.css";
import "src/styles/globals.css";
import { Loading } from "@scow/lib-web/build/layouts/base/Loading";
import { DarkModeCookie } from "@scow/lib-web/build/layouts/darkMode";
import App, { AppContext, AppInitialProps, AppProps } from "next/app";
import Head from "next/head";
import { join } from "path";
import { PublicConfigProvider } from "src/context/PublicConfigContext"; // 已导入
import { ClientLayout } from "src/layouts/ClientLayout";
import { ClientProvider } from "src/layouts/trpcClient";
import { BASE_PATH } from "src/utils/processEnv";
import { trpc } from "src/utils/trpc";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="format-detection" content="telephone=no" />
        <link href={join(BASE_PATH, "/manifest.json")} rel="manifest" id="manifest" />
        <link rel="icon" type="image/x-icon" href={join(BASE_PATH, "/api/icon?type=favicon")}></link>
        <script
          id="__CONFIG__"
          dangerouslySetInnerHTML={{
            __html: `
              window.__CONFIG__ = ${JSON.stringify({
                BASE_PATH: BASE_PATH === "/" ? "" : BASE_PATH,
              })};
            `,
          }}
        />
      </Head>
      <ClientProvider basePath={BASE_PATH}>
        {/* ✅ 包裹 PublicConfigProvider */}
        <PublicConfigProvider>
          <AppInner>
            <Component {...pageProps} />
          </AppInner>
        </PublicConfigProvider>
      </ClientProvider>
    </>
  );
}

function AppInner({ children }: { children: React.ReactNode }) {
  const publicConfigQuery = trpc.config.publicConfig.useQuery();

  if (!publicConfigQuery.data) {
    return <Loading />;
  }

  const { acceptLanguageHeader, darkModeCookie, languageCookie } = publicConfigQuery.data;

  const dark = darkModeCookie ? (JSON.parse(darkModeCookie) as DarkModeCookie) : undefined;

  return (
    <ClientLayout acceptLanguageHeader={acceptLanguageHeader} dark={dark} languageCookie={languageCookie}>
      {children}
    </ClientLayout>
  );
}

MyApp.getInitialProps = async (context: AppContext): Promise<AppInitialProps> => {
  const ctx = await App.getInitialProps(context);

  return ctx;
};
