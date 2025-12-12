"use client";

import { joinWithUrl } from "@scow/utils";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink, TRPCClientError } from "@trpc/react-query";
import { message } from "antd";
import { join } from "path";
import { useState } from "react";
import { ForbiddenPage } from "src/components/ForbiddenPage";
import { trpc } from "src/server/trpc/api";
import { AppRouter } from "src/server/trpc/router";
import superjson from "superjson";

const MAX_RETRIES = 3;

export function TrpcClientProvider(props: { baseUrl: string; basePath: string; children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry(failureCount, error) {
          const { data } = error as TRPCClientError<AppRouter>;
          if (data?.code && data?.code === "UNAUTHORIZED") {
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
          return <ForbiddenPage />;
        } else if (msg) {
          message.error(msg);
        } else if (data?.code && query?.meta?.[data?.code]) {
          const msg = query?.meta?.[data?.code] as string;
          message.error(msg);
        } else {
          message.error("Something went wrong, please try again later!");
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, variables, context, mutation) => {
        const { data, message: errMessage } = error as TRPCClientError<AppRouter>;
        const { onError } = mutation.options;
        if (data?.code && data?.code === "UNAUTHORIZED") {
          return <ForbiddenPage />;
        } else if (errMessage) {
          message.error(errMessage);
        } else if (!onError) {
          message.error("Something went wrong, please try again later!");
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
          url: typeof window === "undefined" ? joinWithUrl(props.baseUrl, props.basePath, "/api/trpc")
            : join(props.basePath, "/api/trpc"),
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
