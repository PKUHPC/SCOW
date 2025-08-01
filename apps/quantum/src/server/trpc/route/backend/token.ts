import { UserToken } from "src/server/entities/UserToken";
import { router } from "src/server/trpc/def";
import { procedure } from "src/server/trpc/procedure/base";

export const tokenRouter = router({
  getUserToken: procedure
    .query(async ({ ctx: { orm, user } }) => {

      const em = orm.em.fork();

      const userToken = await em.findOne(UserToken, { userId: user.identityId });
      if (!userToken) {
        const newToken = new UserToken({
          userId: user.identityId,
          token: crypto.randomUUID(),
        });

        await em.persistAndFlush(newToken);
        return { token: newToken.token };
      }

      return { token: userToken.token };
    }),

});
