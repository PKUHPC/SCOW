import { createServer } from "src/app";
import { createPriceItems } from "src/tasks/createBillingItems";
import { fetchJobs } from "src/tasks/fetch";
import { migrationUp } from "src/tasks/migrationUp";
import { fetchStatistics } from "src/tasks/statistic";

async function main() {
  const server = await createServer();

  const args = process.argv.slice(1);

  // run tasks
  if (args.length > 1) {
    const [_scriptName, command] = args;

    const logger = server.logger.child({ task: command });

    const em = server.ext.orm.em.fork();

    switch (command) {
      case "fetchJobs":
        await fetchJobs(em, logger, server.ext);
        break;

      case "createPriceItems":
        await createPriceItems(em, logger);
        break;

      case "migrationUp":
        await migrationUp(server.ext.orm);
        break;

      case "fetchStatistics":
        await fetchStatistics(em, logger);
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
