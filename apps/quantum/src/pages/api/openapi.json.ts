import { NextApiRequest, NextApiResponse } from "next";
import { openApiDocument } from "src/server/trpc/openapi";

// Respond with our OpenAPI schema
const handler = (req: NextApiRequest, res: NextApiResponse) => {
  res.status(200).send(openApiDocument);
};

export default handler;
