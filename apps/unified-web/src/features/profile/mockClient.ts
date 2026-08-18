import type { ProfileApi, ProfileData } from "src/features/profile/types";

import { ProfileApiError } from "src/features/profile/types";

let profileData: ProfileData = {
  user: {
    identityId: "demo_admin",
    name: "SCOW 演示用户",
    tenantRoles: [0],
    platformRoles: [0],
    email: "demo@example.com",
    phone: "13800000000",
    organization: "SCOW",
    createTime: "2024-01-01T08:00:00.000Z",
  },
  enableChangePassword: true,
  passwordPattern: ".{8,}",
  passwordPatternMessage: {
    i18n: {
      default: "密码至少需要 8 个字符",
      en: "The password must contain at least 8 characters",
    },
  },
};

const wait = () => new Promise((resolve) => setTimeout(resolve, 200));

export const mockProfileClient: ProfileApi = {
  async getProfileData() {
    await wait();
    return structuredClone(profileData);
  },
  async changeEmail(newEmail) {
    await wait();
    if (!profileData.user) throw new ProfileApiError("USER_NOT_FOUND");
    profileData = { ...profileData, user: { ...profileData.user, email: newEmail } };
  },
  async changePassword(oldPassword, newPassword) {
    await wait();
    if (oldPassword !== "password") throw new ProfileApiError("OLD_PASSWORD_INCORRECT");
    if (profileData.passwordPattern && !new RegExp(profileData.passwordPattern).test(newPassword)) {
      throw new ProfileApiError("PASSWORD_NOT_VALID");
    }
  },
  async logout() {
    await wait();
    profileData = { ...profileData, user: undefined };
  },
};
