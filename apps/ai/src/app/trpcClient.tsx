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

"use client";

import { joinWithUrl } from "@scow/utils";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, loggerLink, splitLink, TRPCClientError } from "@trpc/client";
import { message } from "antd";
import { join } from "path";
import { useState } from "react";
import { AppRouter } from "src/server/trpc/router";
import { trpc } from "src/utils/trpc";
import superjson from "superjson";

const MAX_RETRIES = 3;

declare module "@trpc/client" {
  interface TRPCRequestOptions {
    meta?: {
      /** 设为 true 时，此请求绕过 httpBatchLink，直接走 httpLink */
      noBatch?: boolean;
    };
  }
}

export function ClientProvider(props: { baseUrl: string; basePath: string; children: React.ReactNode }) {

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
        const silent = query?.meta?.silent;

        if (data?.code && data?.code === "UNAUTHORIZED") {
          window.location.href = join(props.basePath, "/api/auth");
        } else if (silent) {
          return;
        }
        else if (msg) {
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

  const apiUrl = {
    url: typeof window === "undefined" ? joinWithUrl(props.baseUrl, props.basePath, "/api/trpc")
      : join(props.basePath, "/api/trpc"),
  };

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        loggerLink({
          enabled: () => process.env.NODE_ENV === "development",
        }),
        splitLink({
          // 条件：如果标了 noBatch，或者是特定路径，就走 httpLink（单发）
          condition: (op) =>
            ((op.context as { meta?: { noBatch?: boolean } }).meta?.noBatch === true),
          true: httpLink(apiUrl), // 单个请求
          false: httpBatchLink(apiUrl), // 仍然合并其它请求
        }),
      ],
      transformer: superjson,
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
