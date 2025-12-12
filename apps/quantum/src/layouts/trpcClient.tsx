"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink, TRPCClientError } from "@trpc/client";
import { message } from "antd";
import { join } from "path";
import { useState } from "react";
import { AppRouter } from "src/server/trpc/router";
import { trpc } from "src/utils/trpc";
import superjson from "superjson";

const MAX_RETRIES = 3;

export function ClientProvider(props: { basePath: string; children: React.ReactNode }) {

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry(failureCount, error) {
          const { data } = error as TRPCClientError<AppRouter>;
          if (data?.code && data?.code === "UNAUTHORIZED") {
            window.location.href = join(props.basePath, "/api/auth");
            return false;
          }

          if (failureCount >= MAX_RETRIES) {
            return false;
          }

          return true;
        },
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        const { data, message: msg } = error as TRPCClientError<AppRouter>;
        if (data?.code && data?.code === "UNAUTHORIZED") {
          window.location.href = join(props.basePath, "/api/auth");
        } else if (msg) {
          message.error(msg);
        } else if (data?.code && query?.meta?.[data?.code]) {
          const msg = query?.meta?.[data?.code] as string;
          message.error(msg);
        } else {
          message.error("There have been some issues, please try again later!");
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, variables, context, mutation) => {
        const { data, message: errMessage } = error as TRPCClientError<AppRouter>;
        const { onError } = mutation.options;
        if (data?.code && data?.code === "UNAUTHORIZED") {
          window.location.href = join(props.basePath, "/api/auth");
        } else if (data?.path?.startsWith("file") && data?.code === "PRECONDITION_FAILED"
         && errMessage.startsWith("SSH_ERROR:")) {
          message.error("Unable to connect to the login node as a user. Please confirm if your home "
            + "directory permissions are 700, 750, or 755, or if you have permission to perform operations here");
        } else if (data?.path?.startsWith("file") && data?.code === "BAD_REQUEST"
        && errMessage.startsWith("SFTP_ERROR:")) {
          message.error(errMessage || "SFTP operation failed, please confirm if you have the permission to operate");
        } else if (!onError) {
          message.error("There have been some issues, please try again later!");
        }
      },
    }),
  }));

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        loggerLink({
          enabled: () => process.env.NODE_ENV === "development",
        }),
        httpBatchLink({
          url: join(props.basePath, "/api/trpc"),
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
