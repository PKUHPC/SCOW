import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "src/server/trpc/router";

export const trpc = createTRPCReact<AppRouter>({


});
