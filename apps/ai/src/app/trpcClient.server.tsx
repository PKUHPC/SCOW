import { unstable_noStore as noStore } from "next/cache";
import { ClientProvider } from "src/app/trpcClient";
import { BASE_PATH } from "src/utils/processEnv";

function getBaseUrl() {
  if (typeof window !== "undefined")
    // browser should use relative path
    return "";
  if (process.env.VERCEL_URL)
    // reference for vercel.com
    return `https://${process.env.VERCEL_URL}`;
  if (process.env.RENDER_INTERNAL_HOSTNAME)
    // reference for render.com
    return `http://${process.env.RENDER_INTERNAL_HOSTNAME}:${process.env.PORT}`;
  // assume localhost
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const ServerClientProvider = (props: { children: React.ReactNode }) => {
  noStore();

  return (
    <ClientProvider baseUrl={getBaseUrl()} basePath={BASE_PATH}>
      {props.children}
    </ClientProvider>
  );
};
