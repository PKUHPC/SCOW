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

import "antd/dist/reset.css";
import "src/styles/globals.css";

import { DarkModeCookie } from "@scow/lib-web/build/layouts/darkMode";
import { cookies, headers } from "next/headers";
import { join } from "path";
import React from "react";
import { ClientLayout } from "src/app/clientLayout";
import { ServerClientProvider } from "src/app/trpcClient.server";
import { BASE_PATH } from "src/utils/processEnv";

export default function MyApp({ children }: { children: React.ReactNode }) {

  const cookie = cookies();
  const header = headers();

  const darkModeCookie = cookie.get("scow-dark");
  const languageCookie = cookie.get("language")?.value;
  const acceptLanguageHeader = header.get("accept-language");

  const dark = darkModeCookie ? JSON.parse(darkModeCookie.value) as DarkModeCookie : undefined;

  return (
    <html>
      <head>
        <meta name="format-detection" content="telephone=no" />
        <link href={join(BASE_PATH, "manifest.json")} rel="manifest" id="manifest" />
        <link href={join(BASE_PATH, "/api/icon?type=favicon")} rel="icon" type="image/x-icon" />
      </head>
      <ServerClientProvider>
        <ClientLayout
          initialDark={dark}
          languageCookie={languageCookie}
          acceptLanguageHeader={acceptLanguageHeader}
        >
          {children}
        </ClientLayout>
      </ServerClientProvider>
    </html>
  );

}


