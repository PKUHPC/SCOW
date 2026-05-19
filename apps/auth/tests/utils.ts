import { authConfig } from "src/config/auth";

export const testUserUsername = "test";
export const testUserPassword = "test";

export const allowedCallbackUrl = "http://" + authConfig.allowedCallbackHostnames[0] + "/callback";
export const notAllowedCallbackUrl = "http://baddomain.com:29392/callback";

export const createFormData = (values: Record<string, string>) => {
  const formData = new URLSearchParams();
  Object.entries(values).forEach(([k, v]) => {
    formData.append(k, v);
  });

  const body = formData.toString();

  return {
    payload: body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  };
};
