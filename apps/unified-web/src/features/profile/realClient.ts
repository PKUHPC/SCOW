import type { ProfileApi, ProfileData, ProfileUser } from "src/features/profile/types";

import axios from "axios";
import { createRestClient } from "src/api/http";
import { ProfileApiError } from "src/features/profile/types";

const client = createRestClient("mis");

interface MisInitialConfig extends Omit<ProfileData, "user"> {
  userInfo?: ProfileUser;
}

const toProfileError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return new ProfileApiError("UNKNOWN");

  switch (error.response?.status) {
    case 400:
      return new ProfileApiError(error.response.data?.code === "PASSWORD_NOT_VALID" ? "PASSWORD_NOT_VALID" : "UNKNOWN");
    case 404:
      return new ProfileApiError("USER_NOT_FOUND");
    case 501:
      return new ProfileApiError("UNAVAILABLE");
    default:
      return new ProfileApiError("UNKNOWN");
  }
};

const clearUserCookie = () => {
  document.cookie = "SCOW_USER=; Max-Age=0; Path=/; SameSite=Lax";
};

export const realProfileClient: ProfileApi = {
  async getProfileData() {
    const response = (await client.get<MisInitialConfig>("/getAppInitialConfig")).data;
    return {
      user: response.userInfo,
      enableChangePassword: response.enableChangePassword,
      passwordPattern: response.passwordPattern,
      passwordPatternMessage: response.passwordPatternMessage,
    };
  },
  async changeEmail(newEmail) {
    try {
      await client.patch("/profile/changeEmail", { newEmail });
    } catch (error) {
      throw toProfileError(error);
    }
  },
  async changePassword(oldPassword, newPassword) {
    try {
      const checkResult = (
        await client.get<{ success: boolean }>("/profile/checkPassword", {
          params: { password: oldPassword },
        })
      ).data;
      if (!checkResult.success) throw new ProfileApiError("OLD_PASSWORD_INCORRECT");
      await client.patch("/profile/changePassword", { newPassword });
    } catch (error) {
      if (error instanceof ProfileApiError) throw error;
      throw toProfileError(error);
    }
  },
  async logout() {
    try {
      await client.delete("/auth/logout");
    } catch (error) {
      console.error("Failed to notify the server of logout", error);
    } finally {
      clearUserCookie();
    }
  },
};
