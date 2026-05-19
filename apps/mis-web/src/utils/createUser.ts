import { getRuntimeI18nConfigText, publicConfig } from "src/utils/config";

export const useBuiltinCreateUser = () => {
  return (
    publicConfig.CREATE_USER_CONFIG.authSupportsCreateUser &&
    publicConfig.CREATE_USER_CONFIG.misConfig.enabled &&
    publicConfig.CREATE_USER_CONFIG.misConfig.type === "builtin"
  );
};

export const getUserIdRule = (languageId: string) => {
  if (!useBuiltinCreateUser()) {
    return undefined;
  }

  const pattern =
    publicConfig.CREATE_USER_CONFIG.misConfig.builtin?.userIdPattern ??
    publicConfig.CREATE_USER_CONFIG.misConfig.userIdPattern;

  const errorMessage = publicConfig.CREATE_USER_CONFIG.misConfig.builtin?.userIdPattern
    ? getRuntimeI18nConfigText(languageId, "createUserBuiltinErrorMessage")
    : getRuntimeI18nConfigText(languageId, "createUserErrorMessage");

  if (pattern) {
    return {
      pattern: new RegExp(pattern.regex),
      message: errorMessage,
    };
  } else {
    return undefined;
  }
};

export const createUserParams = (token: string) => new URLSearchParams({ type: "createUser", token }).toString();
export const addUserToAccountParams = (accountName: string, userId: string, userName: string, token: string) =>
  new URLSearchParams({ type: "addUserToAccount", accountName, userId, userName, token }).toString();
