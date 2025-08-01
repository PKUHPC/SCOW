import { trpc } from "src/server/trpc/def";
import { withAuthContext } from "src/server/trpc/middleware/withAuthContext";
import { withOrmContext } from "src/server/trpc/middleware/withOrmContext";

export const baseProcedure = trpc.procedure;

export const authProcedure = baseProcedure.use(withAuthContext);
export const procedure = baseProcedure.use(withOrmContext.unstable_pipe(withAuthContext));

