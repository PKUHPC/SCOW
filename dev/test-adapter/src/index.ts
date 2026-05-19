import { createServer } from "src/app";

async function main() {
  const server = await createServer();

  await server.start();
}

void main();
