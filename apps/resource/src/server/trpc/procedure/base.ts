import { trpc } from "src/server/trpc/def";
import { withAuthContext } from "src/server/trpc/middleware/with-auth-context";
import { withLoggerContext } from "src/server/trpc/middleware/with-logger-context";

import { withAdminAuthContext } from "../middleware/with-admin-auth-context";

export const baseProcedure = trpc.procedure;

export const authProcedure = baseProcedure.use(withLoggerContext).use(withAuthContext);

export const adminAuthProcedure = baseProcedure.use(withLoggerContext).use(withAdminAuthContext);
