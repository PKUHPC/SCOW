import { inferRouterOutputs } from "@trpc/server";
import { AppRouter } from "src/server/trpc/router";

export type ModelInterface = inferRouterOutputs<AppRouter>["model"]["list"]["items"][0];
export type ModelVersionInterface = inferRouterOutputs<AppRouter>["model"]["versionList"]["items"][0];
