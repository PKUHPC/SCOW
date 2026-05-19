import type { AppRouter } from "src/server/trpc/router";

import { createTRPCReact } from "@trpc/react-query";

export const trpc = createTRPCReact<AppRouter>({});
