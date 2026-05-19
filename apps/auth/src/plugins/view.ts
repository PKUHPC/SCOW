import view from "@fastify/view";
import fp from "fastify-plugin";
import { Liquid } from "liquidjs";

export const viewPlugin = fp(async (f) => {
  const liquid = new Liquid({
    extname: ".liquid",
  });

  await f.register(view, {
    engine: { liquid },
    root: "views",
  });
});
