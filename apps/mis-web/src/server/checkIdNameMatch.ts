import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { getClient } from "src/utils/client";
import { handlegRPCError } from "src/utils/server";

export type CheckNameMatchResult = "OK" | "NotMatch" | "NotFound";

export async function checkNameMatch(identityId: string, name: string): Promise<CheckNameMatchResult> {
  const client = getClient(UserServiceClient);

  return await asyncUnaryCall(client, "checkUserNameMatch", {
    name,
    userId: identityId,
  })
    .then(({ match }) => {
      return match ? "OK" : ("NotMatch" as const);
    })
    .catch(
      handlegRPCError({
        [status.NOT_FOUND]: () => "NotFound" as const,
      }),
    );
}
