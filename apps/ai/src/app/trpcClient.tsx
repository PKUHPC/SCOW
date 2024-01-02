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
import { httpBatchLink, loggerLink, TRPCClientError } from "@trpc/client";
import { message } from "antd";
import { join } from "path";
import { useState } from "react";
import { AppRouter } from "src/server/trpc/router";
import { trpc } from "src/utils/trpc";
import superjson from "superjson";

export function ClientProvider(props: { baseUrl: string; basePath: string; children: React.ReactNode }) {

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        const { data } = error as TRPCClientError<AppRouter>;

        if (data?.code && data?.code === "UNAUTHORIZED") {
          window.location.href = join(props.basePath, "/api/auth");
        } else if (data?.code && query?.meta?.[data?.code]) {
          const msg = query?.meta?.[data?.code] as string;
          message.error(msg);
        } else {
          message.error("出了一些问题，请稍后再试！");
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, variables, context, mutation) => {
        const { data } = error as TRPCClientError<AppRouter>;
        const { onError } = mutation.options;
        if (data?.code && data?.code === "UNAUTHORIZED") {
          window.location.href = join(props.basePath, "/api/auth");
        } else if (!onError) {
          message.error("出了一些问题，请稍后再试！");
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
          url: joinWithUrl(props.baseUrl, props.basePath, "/api/trpc"),
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
