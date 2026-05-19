import { createServer } from "src/app";
import { migrationUp } from "src/tasks/migrationUp";

async function main() {
  const server = await createServer();

  const args = process.argv.slice(1);

  // run tasks
  if (args.length > 1) {
    const [_scriptName, command] = args;

    const logger = server.logger.child({ task: command });

    switch (command) {
      case "migrationUp":
        await migrationUp(server.ext.orm);
        break;
      default:
        logger.error("Unexpected task name %s", command);
        process.exit(1);
    }

    process.exit(0);
  }

  await server.start();
}

void main();
