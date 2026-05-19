import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";
import path from "path";

export const staticPlugin = fp(async (fp) => {
  await fp.register(fastifyStatic, {
    root: path.join(process.cwd(), "public"),
    prefix: "/public/assets/", // optional: default '/'
  });
});
