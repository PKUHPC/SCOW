import { jsonFetch, route } from "@ddadaal/next-typed-api-routes-runtime";
import { authenticate } from "src/auth/server";
import { publicConfig, runtimeConfig } from "src/utils/config";

export interface ChangePasswordSchema {

  method: "PATCH";

  body: {
    oldPassword: string;
    /**
     * @pattern ^(?=.*\d)(?=.*[a-zA-Z])(?=.*[`~!@#\$%^&*()_+\-[\];',./{}|:"<>?]).{8,}$
     */
    newPassword: string;
  };

  responses: {
    /** 更改成功 */
    204: null;

    /** 密码不正确 */
    412: null;

    /** 本功能在当前配置下不可用。 */
    501: null;
  }
}


export default /* #__PURE__*/route<ChangePasswordSchema>("ChangePasswordSchema", async (req, res) => {

  if (!publicConfig.ENABLE_CHANGE_PASSWORD) {
    return { 501: null };
  }

  const auth = authenticate(() => true);

  const info = await auth(req, res);

  if (!info) { return; }

  const { newPassword, oldPassword } = req.body;

  return await jsonFetch({
    method: "PATCH",
    path: `${runtimeConfig.AUTH_INTERNAL_URL}/password`,
    body: {
      identityId: info.identityId,
      newPassword,
      oldPassword,
    },
  })
    .then(() => ({ 204: null }))
    .catch((e) => ({ [e.status]: null }));

});
