import "antd/dist/reset.css";
import "src/styles/globals.css";
import { DarkModeCookie } from "@scow/lib-web/build/layouts/darkMode";
import { cookies, headers } from "next/headers";
import { join } from "path";
import React from "react";
import { ClientLayout } from "src/app/clientLayout";
import { ServerClientProvider } from "src/app/trpcClient.server";
import { BASE_PATH } from "src/utils/processEnv";

export default async function MyApp({ children }: { children: React.ReactNode }) {
  const cookie = await cookies();
  const header = await headers();

  const darkModeCookie = cookie.get("scow-dark");
  const languageCookie = cookie.get("language")?.value;
  const acceptLanguageHeader = header.get("accept-language");

  const dark = darkModeCookie ? (JSON.parse(darkModeCookie.value) as DarkModeCookie) : undefined;

  return (
    <html>
      <head>
        <meta name="format-detection" content="telephone=no" />
        <link href={join(BASE_PATH, "manifest.json")} rel="manifest" id="manifest" />
        <link href={join(BASE_PATH, "/api/icon?type=favicon")} rel="icon" type="image/x-icon" />
      </head>
      <body>
        <ServerClientProvider>
          <ClientLayout initialDark={dark} languageCookie={languageCookie} acceptLanguageHeader={acceptLanguageHeader}>
            {children}
          </ClientLayout>
        </ServerClientProvider>
      </body>
    </html>
  );
}
