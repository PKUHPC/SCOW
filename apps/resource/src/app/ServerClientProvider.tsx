import { unstable_noStore as noStore } from "next/cache";
import { BASE_PATH } from "src/utils/processEnv";

import { TrpcClientProvider } from "./TrpcClientProvider";

export function getBaseUrl() {
  if (typeof window !== "undefined")
    // browser should use relative path
    return "";
  if (process.env.VERCEL_URL)
    // reference for vercel.com
    return `https://${process.env.VERCEL_URL}`;
  if (process.env.RENDER_INTERNAL_HOSTNAME)
    // reference for render.com
    return `http://${process.env.RENDER_INTERNAL_HOSTNAME}:${process.env.PORT}`;
  if (process.env.NODE_ENV === "development") {
    // assume localhost
    return `http://localhost:${process.env.PORT ?? 3000}`;
  }

  return "";
}

export const ServerClientProvider = (props: { children: React.ReactNode }) => {
  noStore();

  return (
    <TrpcClientProvider baseUrl={getBaseUrl()} basePath={BASE_PATH}>
      {props.children}
    </TrpcClientProvider>
  );
};
