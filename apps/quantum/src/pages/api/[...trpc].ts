import { NextApiRequest, NextApiResponse } from "next";
import cors from "nextjs-cors";
import { createContext } from "src/server/trpc/context";
import { appRouter } from "src/server/trpc/router";
import { createOpenApiNextHandler } from "trpc-to-openapi";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  // Setup CORS
  await cors(req, res);

  // Handle incoming OpenAPI requests
  return createOpenApiNextHandler({
    router: appRouter,
    createContext,
    onError({ error, path, input }) {
      console.error("Something went wrong", {
        error,
        path,
        input,
      });
    },
  })(req, res);
};

export default handler;
