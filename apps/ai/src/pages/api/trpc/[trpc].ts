import { createNextApiHandler } from "@trpc/server/adapters/next";
import { createContext } from "src/server/trpc/context";
import { appRouter } from "src/server/trpc/router";

export default createNextApiHandler({
  router: appRouter,
  createContext,
  onError({ error }) {
    if (error.code === "INTERNAL_SERVER_ERROR") {
      // send to bug reporting
      console.error("Something went wrong", error);
    }
  },
  /**
   * Enable query batching
   */
  batching: {
    enabled: true,
  },
});
