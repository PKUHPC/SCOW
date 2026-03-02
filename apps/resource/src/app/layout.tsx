import "src/styles/globals.css";

import { DEFAULT_PRIMARY_COLOR } from "@scow/config/build/ui";
import React from "react";

import { ClientLayout } from "./clientLayout";
import { ServerClientProvider } from "./ServerClientProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <html>
      <body>
        <ServerClientProvider>
          <ClientLayout defaultPrimaryColor={DEFAULT_PRIMARY_COLOR}>
            {children}
          </ClientLayout>
        </ServerClientProvider>
      </body>
    </html>
  );
}
