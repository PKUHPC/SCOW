import { BASE_PATH } from "src/utils/processEnv";

import { ClientLayout } from "./client-layout";
import { ServerClientProvider } from "./server-client-provider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ServerClientProvider basePath={BASE_PATH}>
          <ClientLayout basePath={BASE_PATH}>{children}</ClientLayout>
        </ServerClientProvider>
      </body>
    </html>
  );
}
