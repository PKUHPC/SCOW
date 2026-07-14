import { trpc } from "src/server/trpc/def";
import { withAuthContext } from "src/server/trpc/middleware/withAuthContext";
import { withOrmContext } from "src/server/trpc/middleware/withOrmContext";
import { withRequestLogContext } from "src/server/trpc/middleware/withRequestLogContext";

export const baseProcedure = trpc.procedure.use(withRequestLogContext);

export const authProcedure = baseProcedure.use(withAuthContext);
export const procedure = baseProcedure.use(withOrmContext.unstable_pipe(withAuthContext));
