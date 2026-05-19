import { getCapabilitiesRoute } from "src/routes/capabilities";
import { changeEmailRoute } from "src/routes/changeEmail";
import { changePasswordRoute } from "src/routes/changePassword";
import { changePasswordUserSelfRoute } from "src/routes/changePassword";
import { checkPasswordRoute } from "src/routes/checkPassword";
import { createUserRoute } from "src/routes/createUser";
import { deleteUserRoute } from "src/routes/deleteUser";
import { getLockedUsersRoute } from "src/routes/getLockedUsers";
import { getUserRoute } from "src/routes/getUser";
import { logoutRoute } from "src/routes/logout";
import { unlockUserRoute } from "src/routes/unlockUser";
import { updatePasswordFlagRoute } from "src/routes/updatePasswordResetFlag";

import { authRoute } from "./auth";
import { authCallbackRoute } from "./callback";
import { validateTokenRoute } from "./validateToken";

export const routes = [
  authRoute,
  authCallbackRoute,
  validateTokenRoute,
  createUserRoute,
  changePasswordRoute,
  changePasswordUserSelfRoute,
  logoutRoute,
  getCapabilitiesRoute,
  getUserRoute,
  getLockedUsersRoute,
  changeEmailRoute,
  checkPasswordRoute,
  deleteUserRoute,
  unlockUserRoute,
  updatePasswordFlagRoute,
];
